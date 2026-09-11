// components/admin/drivers/DriversScreen.tsx
// Live container for the admin Livreurs screen, in the language of the Vue
// d'ensemble: headline figures (online, on a run, today's deliveries and driver
// earnings), a notice for drivers without app access, the day's leaderboard,
// status chips with counts, a search, and the driver cards. Subscribes to
// postgres_changes on drivers / order_tracking / orders and refetches the same raw
// shapes on any change — so a driver going online or completing a delivery updates
// the board in real time. All per-driver stats come from lib/admin-drivers.ts so
// server and client agree.
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { startOfTodayISO } from '@/lib/admin-overview';
import { formatAmount } from '@/lib/format';
import { buildDriverRows, driverFilterCounts, driverRoutesToCsv, filterDriverRows, rosterTotals, type DriverFilter } from '@/lib/admin-drivers';
import type { AdminDriversData } from '@/lib/queries';
import type { Driver } from '@/lib/types';
import { DriverCard } from './DriverCard';
import { DriverAccountModal } from './DriverAccountModal';
import { DriverEditModal } from './DriverEditModal';
import { useRealtime } from '@/lib/use-realtime';
import { HeroStat } from '@/components/admin/overview/HeroStat';
import { Chip, EmptyState, GhostButton, GlassPanel, Notice, PageHeader, PanelTitle, PrimaryButton, SearchField } from '@/components/admin/ui/Glass';

type RawOrder = { id: string; status: string; delivery_fee_dh: number };
type AccountModal = { mode: 'new' } | { mode: 'link'; driver: { id: string; name: string } };
type RawTracking = { order_id: string; driver_id: string | null };
type RawActive = { id: string; code: string; status: string };

const FILTERS: { value: DriverFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'available', label: 'Disponibles' },
  { value: 'delivering', label: 'En livraison' },
  { value: 'offline', label: 'Hors ligne' },
];

export function DriversScreen({ initial }: { initial: AdminDriversData }) {
  const [rows, setRows] = useState<AdminDriversData['rows']>(initial.rows);
  const [modal, setModal] = useState<AccountModal | null>(null);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<DriverFilter>('all');
  const [query, setQuery] = useState('');

  const onDelete = useCallback(async (driver: Driver) => {
    if (!window.confirm(`Supprimer le livreur « ${driver.name} » ? Son compte de connexion sera aussi supprimé. Cette action est irréversible.`)) return;
    setBusy(true);
    const { error } = await createClient().rpc('admin_delete_driver', { p_id: driver.id });
    setBusy(false);
    if (error) window.alert('Suppression échouée : ' + error.message);
  }, []);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const since = startOfTodayISO(); // agency-midnight boundary — matches the server paint
    const [driversRes, ordersRes, trackingRes, activeRes] = await Promise.all([
      supabase.from('drivers').select('*').order('name'),
      supabase.from('orders').select('id, status, delivery_fee_dh').eq('status', 'delivered').gte('placed_at', since),
      supabase.from('order_tracking').select('order_id, driver_id').not('driver_id', 'is', null),
      supabase.from('orders').select('id, code, status').in('status', ['ready', 'en_route']),
    ]);
    setRows(buildDriverRows((driversRes.data ?? []) as Driver[], (ordersRes.data ?? []) as RawOrder[], (trackingRes.data ?? []) as RawTracking[], (activeRes.data ?? []) as RawActive[]));
  }, []);

  // One refetch per burst instead of three: a status change touches orders,
  // order_tracking and drivers within milliseconds of each other.
  useRealtime('admin-drivers', [{ table: 'drivers' }, { table: 'order_tracking' }, { table: 'orders' }], refetch);

  // Periodic refetch so a driver whose heartbeat went stale flips to offline
  // even without a new DB event (lib/admin-presence applies the freshness TTL).
  useEffect(() => {
    const tick = setInterval(refetch, 60_000);
    return () => clearInterval(tick);
  }, [refetch]);

  const totals = useMemo(() => rosterTotals(rows), [rows]);
  const counts = useMemo(() => driverFilterCounts(rows), [rows]);
  const visible = useMemo(() => filterDriverRows(rows, filter, query), [rows, filter, query]);
  const leaders = useMemo(() => rows.filter((r) => r.deliveries > 0).sort((a, b) => b.deliveries - a.deliveries || b.earnings - a.earnings).slice(0, 5), [rows]);
  const maxDeliveries = leaders[0]?.deliveries ?? 1;

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
    <div style={{ padding: '30px 32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Livreurs"
        subtitle="Tournées du jour, présence en direct et accès à l'application livreur."
        actions={
          <>
            {rows.length > 0 && <GhostButton onClick={exportRoutes}>Exporter tournées</GhostButton>}
            <PrimaryButton onClick={() => setModal({ mode: 'new' })}>+ Nouveau livreur</PrimaryButton>
          </>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px 56px' }}>
        <HeroStat label={`En ligne · ${rows.length} livreur${rows.length > 1 ? 's' : ''}`} value={String(totals.online)} />
        <HeroStat label="En course" value={String(totals.delivering)} />
        <HeroStat label="Livraisons du jour" value={String(totals.deliveries)} />
        <HeroStat label="Gains livreurs du jour" value={formatAmount(totals.earnings)} unit="DH" />
      </div>

      {totals.withoutAccess > 0 && (
        <Notice icon="user">
          {totals.withoutAccess} livreur{totals.withoutAccess > 1 ? "s n'ont" : " n'a"} pas encore d&apos;accès à l&apos;application.
        </Notice>
      )}

      {leaders.length > 0 && (
        <GlassPanel>
          <PanelTitle aside="livraisons terminées aujourd'hui">Classement du jour</PanelTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {leaders.map((r, i) => (
              <div key={r.driver.id} style={{ display: 'grid', gridTemplateColumns: '22px minmax(110px, 1fr) minmax(0, 2fr) 40px 90px', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.driver.name}</span>
                <div style={{ height: 8, borderRadius: 999, background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
                  <div style={{ width: `${(r.deliveries / maxDeliveries) * 100}%`, height: '100%', borderRadius: 999, background: i === 0 ? 'var(--a-accent)' : 'rgba(255, 255, 255, 0.6)' }} />
                </div>
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.deliveries}</span>
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatAmount(r.earnings)} DH</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div role="group" aria-label="Filtrer les livreurs" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <Chip key={f.value} on={filter === f.value} onClick={() => setFilter(f.value)} count={counts[f.value]}>
              {f.label}
            </Chip>
          ))}
        </div>
        <SearchField value={query} onChange={setQuery} label="Rechercher un livreur" placeholder="Nom, téléphone, véhicule…" style={{ maxWidth: 320, marginLeft: 'auto' }} />
      </div>

      {rows.length === 0 ? (
        <GlassPanel>
          <EmptyState title="Aucun livreur enregistré." hint="Ajoutez un premier livreur pour lui créer un accès." />
        </GlassPanel>
      ) : visible.length === 0 ? (
        <GlassPanel>
          <EmptyState title="Aucun livreur ne correspond." />
        </GlassPanel>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 18, alignItems: 'start' }}>
          {visible.map((row) => (
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
