// components/admin/drivers/DriversScreen.tsx
// Live container for the admin Livreurs screen. Renders the server snapshot of the
// driver roster, then subscribes to postgres_changes on drivers / order_tracking /
// orders and refetches the same raw shapes on any change — so a driver going
// online or completing a delivery updates the board in real time. All per-driver
// stats come from lib/admin-drivers.ts so server and client agree.
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { startOfTodayISO } from '@/lib/admin-overview';
import { buildDriverRows } from '@/lib/admin-drivers';
import type { AdminDriversData } from '@/lib/queries';
import type { Driver } from '@/lib/types';
import { DriverCard } from './DriverCard';

type RawOrder = { id: string; status: string; delivery_fee_dh: number };
type RawTracking = { order_id: string; driver_id: string | null };

export function DriversScreen({ initial }: { initial: AdminDriversData }) {
  const [rows, setRows] = useState<AdminDriversData['rows']>(initial.rows);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const since = startOfTodayISO(); // shared UTC boundary — matches the server paint
    const [driversRes, ordersRes, trackingRes] = await Promise.all([
      supabase.from('drivers').select('*').order('name'),
      supabase
        .from('orders')
        .select('id, status, delivery_fee_dh')
        .eq('status', 'delivered')
        .gte('placed_at', since),
      supabase.from('order_tracking').select('order_id, driver_id').not('driver_id', 'is', null),
    ]);
    setRows(
      buildDriverRows(
        (driversRes.data ?? []) as Driver[],
        (ordersRes.data ?? []) as RawOrder[],
        (trackingRes.data ?? []) as RawTracking[],
      ),
    );
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-drivers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_tracking' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const onlineCount = useMemo(() => rows.filter((r) => r.driver.is_online).length, [rows]);

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>Livreurs</h1>
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
          {onlineCount} en ligne sur {rows.length} livreur{rows.length > 1 ? 's' : ''}
        </p>
      </div>

      {rows.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: '40px 22px', textAlign: 'center', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>
          Aucun livreur enregistré.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18, alignItems: 'start' }}>
          {rows.map((row) => (
            <DriverCard key={row.driver.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
