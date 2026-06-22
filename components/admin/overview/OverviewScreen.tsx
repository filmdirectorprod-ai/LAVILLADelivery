// components/admin/overview/OverviewScreen.tsx
// Live container for the admin Vue d'ensemble. Renders the server snapshot first,
// then subscribes to postgres_changes on orders / order_tracking / drivers /
// reviews and refetches the same raw shapes on any change — the exact refetch
// pattern used by DriverRequestsScreen. All derived numbers come from
// lib/admin-overview.ts so server and client agree.
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDH } from '@/lib/format';
import { isInProgressOrderStatus } from '@/lib/order-status';
import {
  bucketOrdersByHour,
  computeOverviewKpis,
  driversToPositions,
  startOfTodayISO,
} from '@/lib/admin-overview';
import type { AdminOverviewData } from '@/lib/queries';
import type { Order } from '@/lib/types';
import { KpiCard } from './KpiCard';
import { HourlyChart } from './HourlyChart';
import { InProgressTable, type InProgressRow } from './InProgressTable';
import { LiveDriverMap } from './LiveDriverMap';
import { BranchesInfo } from '@/components/ui/BranchesInfo';

export function OverviewScreen({
  initial,
  mapsKey,
}: {
  initial: AdminOverviewData;
  mapsKey: string | undefined;
}) {
  const [data, setData] = useState<AdminOverviewData>(initial);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const since = startOfTodayISO(); // shared UTC boundary — matches the server paint
    const [ordersRes, driversRes, reviewsRes, trackingRes] = await Promise.all([
      supabase.from('orders').select('*').gte('placed_at', since).order('placed_at', { ascending: false }),
      supabase.from('drivers').select('*'),
      supabase.from('reviews').select('rating'),
      supabase
        .from('order_tracking')
        .select('order_id, driver_id, lat, lng, updated_at')
        .not('driver_id', 'is', null)
        .not('lat', 'is', null),
    ]);
    setData({
      orders: ordersRes.data ?? [],
      drivers: driversRes.data ?? [],
      ratings: (reviewsRes.data ?? []).map((r) => (r as { rating: number }).rating),
      tracking: trackingRes.data ?? [],
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_tracking' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, refetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const kpis = useMemo(
    () => computeOverviewKpis({ orders: data.orders, drivers: data.drivers, ratings: data.ratings }),
    [data],
  );
  const buckets = useMemo(() => bucketOrdersByHour(data.orders), [data.orders]);
  // Every online driver with a fresh GPS fix (streamed while online, not only
  // during a delivery). 0049.
  const positions = useMemo(() => driversToPositions(data.drivers), [data.drivers]);

  const inProgressRows: InProgressRow[] = useMemo(() => {
    const driverNameById = (id: string | null) =>
      data.drivers.find((d) => d.id === id)?.name ?? null;
    const driverIdByOrder = (orderId: string) =>
      data.tracking.find((t) => t.order_id === orderId)?.driver_id ?? null;
    return data.orders
      .filter((o: Order) => isInProgressOrderStatus(o.status))
      .map((order) => ({ order, driverName: driverNameById(driverIdByOrder(order.id)) }));
  }, [data]);

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>
          Vue d&apos;ensemble
        </h1>
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
          Tableau de bord en temps réel
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <KpiCard
          icon="receipt"
          label="Commandes du jour"
          value={String(kpis.ordersToday)}
          sub={`${kpis.inProgress} en cours`}
          accent
        />
        <KpiCard icon="cash" label="Chiffre d'affaires du jour" value={formatDH(kpis.revenueToday)} />
        <KpiCard
          icon="scooter"
          label="Livreurs en ligne"
          value={`${kpis.driversOnline}/${kpis.driversTotal}`}
        />
        <KpiCard
          icon="star"
          label="Note clients"
          value={kpis.ratingCount === 0 ? '—' : kpis.ratingAvg.toFixed(1)}
          sub={kpis.ratingCount === 0 ? undefined : `${kpis.ratingCount} avis`}
        />
      </div>

      <HourlyChart buckets={buckets} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 22, alignItems: 'start' }}>
        <LiveDriverMap apiKey={mapsKey} positions={positions} />
        <InProgressTable rows={inProgressRows} />
      </div>

      <BranchesInfo />
    </div>
  );
}
