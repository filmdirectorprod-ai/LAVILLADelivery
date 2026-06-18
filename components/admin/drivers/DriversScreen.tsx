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
import { buildDriverRows, driverRoutesToCsv } from '@/lib/admin-drivers';
import { isDriverOnline } from '@/lib/admin-presence';
import type { AdminDriversData } from '@/lib/queries';
import type { Driver } from '@/lib/types';
import { DriverCard } from './DriverCard';
import { DriverAccountModal } from './DriverAccountModal';
import { DriverEditModal } from './DriverEditModal';

type RawOrder = { id: string; status: string; delivery_fee_dh: number };
type AccountModal = { mode: 'new' } | { mode: 'link'; driver: { id: string; name: string } };
type RawTracking = { order_id: string; driver_id: string | null };
type RawActive = { id: string; code: string; status: string };

export function DriversScreen({ initial }: { initial: AdminDriversData }) {
  const [rows, setRows] = useState<AdminDriversData['rows']>(initial.rows);
  const [modal, setModal] = useState<AccountModal | null>(null);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [busy, setBusy] = useState(false);

  const onDelete = useCallback(
    async (driver: Driver) => {
      if (!window.confirm(`Supprimer le livreur « ${driver.name} » ? Son compte de connexion sera aussi supprimé. Cette action est irréversible.`)) return;
      setBusy(true);
      const supabase = createClient();
      const { error } = await supabase.rpc('admin_delete_driver', { p_id: driver.id });
      setBusy(false);
      if (error) window.alert('Suppression échouée : ' + error.message);
    },
    [],
  );

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const since = startOfTodayISO(); // shared UTC boundary — matches the server paint
    const [driversRes, ordersRes, trackingRes, activeRes] = await Promise.all([
      supabase.from('drivers').select('*').order('name'),
      supabase
        .from('orders')
        .select('id, status, delivery_fee_dh')
        .eq('status', 'delivered')
        .gte('placed_at', since),
      supabase.from('order_tracking').select('order_id, driver_id').not('driver_id', 'is', null),
      supabase.from('orders').select('id, code, status').in('status', ['ready', 'en_route']),
    ]);
    setRows(
      buildDriverRows(
        (driversRes.data ?? []) as Driver[],
        (ordersRes.data ?? []) as RawOrder[],
        (trackingRes.data ?? []) as RawTracking[],
        (activeRes.data ?? []) as RawActive[],
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
    // Periodic refetch so a driver whose heartbeat went stale flips to offline
    // even without a new DB event (lib/admin-presence applies the freshness TTL).
    const tick = setInterval(refetch, 60_000);
    return () => {
      clearInterval(tick);
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const onlineCount = useMemo(() => rows.filter((r) => isDriverOnline(r.driver)).length, [rows]);
  const onRouteCount = useMemo(() => rows.filter((r) => r.currentRoute).length, [rows]);

  const exportRoutes = useCallback(() => {
    const csv = driverRoutesToCsv(rows);
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tournees-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [rows]);

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>Livreurs — tournées du jour</h1>
          <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
            {onlineCount} en ligne sur {rows.length} livreur{rows.length > 1 ? 's' : ''} · {onRouteCount} en course
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {rows.length > 0 && (
            <button
              type="button"
              onClick={exportRoutes}
              style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13, color: 'var(--ink)', background: '#fff' }}
            >
              Exporter tournées
            </button>
          )}
          <button
            type="button"
            onClick={() => setModal({ mode: 'new' })}
            style={{ border: 'none', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13, color: '#fff', background: 'var(--brand)' }}
          >
            + Nouveau livreur
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: '40px 22px', textAlign: 'center', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>
          Aucun livreur enregistré.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18, alignItems: 'start' }}>
          {rows.map((row) => (
            <DriverCard
              key={row.driver.id}
              row={row}
              onCreateAccess={() => setModal({ mode: 'link', driver: { id: row.driver.id, name: row.driver.name } })}
              onEdit={() => setEditDriver(row.driver)}
              onDelete={() => !busy && onDelete(row.driver)}
            />
          ))}
        </div>
      )}

      {modal && (
        <DriverAccountModal
          mode={modal.mode}
          driver={modal.mode === 'link' ? modal.driver : null}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            refetch();
          }}
        />
      )}

      {editDriver && (
        <DriverEditModal
          driver={editDriver}
          onClose={() => setEditDriver(null)}
          onDone={() => {
            setEditDriver(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
