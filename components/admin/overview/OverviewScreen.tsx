// components/admin/overview/OverviewScreen.tsx
// Live container for the admin Vue d'ensemble, composed like the visionOS
// reference: a header row with the large title, a progress ring and three large
// light-weight figures; status filter chips; one big glass panel holding the
// hourly activity, the status breakdown and four detail stats; and a right
// column with the live driver card (dark) and the filtered orders list (light).
//
// Renders the server snapshot first, then subscribes to postgres_changes on
// orders / order_tracking / drivers / reviews and refetches the same raw shapes.
// Every derived number comes from lib/admin-overview.ts so server and client
// agree.
'use client';
import { useCallback, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isActiveOrderStatus } from '@/lib/order-status';
import {
  bucketOrdersByHour,
  computeOverviewDetail,
  computeOverviewKpis,
  driversToPositions,
  startOfTodayISO,
} from '@/lib/admin-overview';
import type { AdminOverviewData } from '@/lib/queries';
import type { Order, OrderTracking } from '@/lib/types';
import { HourlyChart } from './HourlyChart';
import { StatusBreakdown } from './StatusBreakdown';
import { ProgressRing } from './ProgressRing';
import { HeroStat, MiniStat } from './HeroStat';
import { OrdersListCard, type OrderListRow } from './OrdersListCard';
import { BranchesInfo } from '@/components/ui/BranchesInfo';
import { useRealtime, type RealtimeChangePayload } from '@/lib/use-realtime';
import { createTrackingGate } from '@/lib/tracking-gate';
import { fetchAllIn } from '@/lib/fetch-in-chunks';
import dynamic from 'next/dynamic';

// Loaded on demand — the admin overview renders long before the map matters.
const LiveDriverMap = dynamic(() => import('./LiveDriverMap').then((m) => m.LiveDriverMap), {
  ssr: false,
});

type Filter = 'active' | 'all' | 'pending' | 'preparing' | 'ready' | 'en_route' | 'delivered' | 'cancelled';

// Real filters, not decoration: they drive the orders list in the right column.
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'active', label: 'En cours' },
  { key: 'all', label: 'Toutes' },
  { key: 'pending', label: 'En attente' },
  { key: 'preparing', label: 'En préparation' },
  { key: 'ready', label: 'Prêtes' },
  { key: 'en_route', label: 'En route' },
  { key: 'delivered', label: 'Livrées' },
  { key: 'cancelled', label: 'Annulées' },
];

function matches(filter: Filter, status: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'active') return isActiveOrderStatus(status);
  return status === filter;
}

/** Whole dirhams for the large figures; the exact amount stays in the tooltip. */
const amount = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n));

export function OverviewScreen({
  initial,
  mapsKey,
}: {
  initial: AdminOverviewData;
  mapsKey: string | undefined;
}) {
  const [data, setData] = useState<AdminOverviewData>(initial);
  const [filter, setFilter] = useState<Filter>('active');

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const since = startOfTodayISO(); // agency-midnight boundary — matches the server paint
    const [ordersRes, driversRes, reviewsRes] = await Promise.all([
      supabase.from('orders').select('*').gte('placed_at', since).order('placed_at', { ascending: false }).limit(500),
      supabase.from('drivers').select('*'),
      // Moyenne des 500 avis les plus récents : sans limite ni tri, Supabase en
      // renvoyait 1000 dans un ordre indéfini et la note bougeait toute seule.
      supabase.from('reviews').select('rating').order('created_at', { ascending: false }).limit(500),
    ]);
    const orders = (ordersRes.data ?? []) as Order[];
    // Bornée aux commandes affichées, et sans exiger de position : la requête
    // d'avant écartait les lignes sans lat, donc une commande tout juste
    // attribuée restait « Non assigné » jusqu'au premier point GPS.
    const tracking = await fetchAllIn<Pick<OrderTracking, 'order_id' | 'driver_id'>>(
      supabase,
      'order_tracking',
      'order_id, driver_id',
      'order_id',
      orders.map((o) => o.id),
    );
    setData({
      orders,
      drivers: driversRes.data ?? [],
      ratings: (reviewsRes.data ?? []).map((r) => (r as { rating: number }).rating),
      tracking: tracking.filter((t) => t.driver_id),
    });
  }, []);

  // La carte lit drivers.lat/lng : cet écran n'a pas besoin des points GPS
  // écrits dans order_tracking toutes les 4 s par course. La porte les écarte —
  // sinon les quatre tables étaient re-tirées à ce rythme-là. Les attributions
  // et les étapes, elles, passent.
  const gate = useRef(createTrackingGate()).current;
  const onChange = useCallback(
    (payload: RealtimeChangePayload) => {
      if (payload.table === 'order_tracking' && !gate(payload)) return;
      refetch();
    },
    [gate, refetch],
  );

  useRealtime('admin-overview', [{ table: 'orders' }, { table: 'order_tracking' }, { table: 'drivers' }, { table: 'reviews' }], onChange);

  const kpis = useMemo(
    () => computeOverviewKpis({ orders: data.orders, drivers: data.drivers, ratings: data.ratings }),
    [data],
  );
  const buckets = useMemo(() => bucketOrdersByHour(data.orders), [data.orders]);
  const detail = useMemo(() => computeOverviewDetail(data.orders, buckets), [data.orders, buckets]);
  // Every online driver with a fresh GPS fix (streamed while online, not only
  // during a delivery). 0049.
  const positions = useMemo(() => driversToPositions(data.drivers), [data.drivers]);

  const rows: OrderListRow[] = useMemo(() => {
    const driverNameById = (id: string | null) => data.drivers.find((d) => d.id === id)?.name ?? null;
    const driverIdByOrder = (orderId: string) => data.tracking.find((t) => t.order_id === orderId)?.driver_id ?? null;
    return data.orders
      .filter((o) => matches(filter, o.status))
      .map((order) => ({ order, driverName: driverNameById(driverIdByOrder(order.id)) }));
  }, [data, filter]);

  const activeLabel = FILTERS.find((f) => f.key === filter)?.label ?? '';
  const listTitle =
    filter === 'active' ? 'Commandes en cours' : filter === 'all' ? 'Toutes les commandes du jour' : `Commandes · ${activeLabel}`;
  const emptyText =
    filter === 'active'
      ? "Aucune commande en cours pour l'instant."
      : filter === 'all'
        ? "Aucune commande aujourd'hui."
        : `Aucune commande « ${activeLabel.toLowerCase()} » aujourd'hui.`;

  return (
    <div style={{ padding: '30px 32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── En-tête : grand titre, anneau, trois grands chiffres ─────────── */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '24px 40px' }}>
        <div style={{ minWidth: 230 }}>
          <h1
            style={{
              fontFamily: 'var(--ui-font)',
              fontWeight: 600,
              fontSize: 44,
              lineHeight: 1.05,
              letterSpacing: '-0.025em',
              color: 'var(--a-text)',
              margin: 0,
            }}
          >
            Vue
            <br />
            d&apos;ensemble
          </h1>
          <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--a-muted)', margin: '10px 0 0' }}>
            <span className="lv-livedot" style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--a-accent)', display: 'inline-block' }} />
            Tableau de bord en temps réel
          </p>
        </div>

        <ProgressRing value={kpis.driversOnline} total={kpis.driversTotal} caption="livreurs en ligne" />

        <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '20px 48px' }}>
          <HeroStat label="Chiffre d'affaires du jour" value={amount(kpis.revenueToday)} unit="DH" title={`${kpis.revenueToday.toFixed(2)} DH`} />
          <HeroStat label="Commandes du jour" value={String(kpis.ordersToday)} />
          <HeroStat
            label={kpis.ratingCount === 0 ? 'Note clients' : `Note clients · ${kpis.ratingCount} avis`}
            value={kpis.ratingCount === 0 ? '—' : kpis.ratingAvg.toFixed(1)}
            unit={kpis.ratingCount === 0 ? undefined : '★'}
          />
        </div>
      </div>

      {/* ── Pastilles de filtre ─────────────────────────────────────────── */}
      <div role="group" aria-label="Filtrer les commandes par statut" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {FILTERS.map((f) => {
          const on = f.key === filter;
          const n = data.orders.filter((o) => matches(f.key, o.status)).length;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={on}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 14px',
                borderRadius: 999,
                border: on ? '1px solid #ffffff' : '1px solid var(--a-glass-line)',
                background: on ? '#ffffff' : 'transparent',
                color: on ? 'var(--a-on-white)' : 'var(--a-text)',
                fontFamily: 'var(--ui-font)',
                fontSize: 13,
                fontWeight: on ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background-color 0.2s ease, color 0.2s ease',
              }}
            >
              {f.label}
              <span style={{ fontSize: 11.5, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* ── Grand panneau de verre + colonne de droite ─────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)', gap: 22, alignItems: 'start' }}>
        <section
          style={{
            background: 'var(--a-card)',
            border: '1px solid var(--a-glass-line)',
            borderRadius: 28,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 14 }}>
            <HourlyChart buckets={buckets} />
            <StatusBreakdown counts={detail.statusCounts} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, padding: '0 6px 4px' }}>
            <MiniStat label="En cours" value={String(kpis.inProgress)} />
            <MiniStat label="Livrées" value={String(detail.delivered)} />
            <MiniStat label="Panier moyen" value={amount(detail.avgBasket)} unit="DH" title={`${detail.avgBasket.toFixed(2)} DH`} />
            <MiniStat
              label="Heure de pointe"
              value={detail.peakHour === null ? '—' : String(detail.peakHour).padStart(2, '0')}
              unit={detail.peakHour === null ? undefined : 'h'}
            />
          </div>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <LiveDriverMap apiKey={mapsKey} positions={positions} />
          <OrdersListCard title={listTitle} emptyText={emptyText} rows={rows} />
        </div>
      </div>

      <BranchesInfo />
    </div>
  );
}
