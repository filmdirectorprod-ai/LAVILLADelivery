// components/admin/orders/OrdersAdminScreen.tsx
// Live container for the admin Commandes screen, in the language of the Vue
// d'ensemble: headline figures (to confirm, in progress, today's revenue and
// basket), an alert for orders waiting too long, filter chips with counts, agency
// chips, a search on code or customer, and the orders table in a glass panel with
// each open order's waiting time, an inline driver assignment, "Vérifier" / "Prête"
// / "Annuler" actions, sales CSV export and the optional "Affectation auto" mode
// that round-robins unassigned ready orders across online drivers.
//
// Subscribes to postgres_changes on orders / order_items / order_tracking and
// refetches the same raw shapes — rebuilt via lib/admin-orders.ts so server and
// client agree. Staff writes go through the 0015 RPCs, then a refetch.
'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatAmount, formatDH } from '@/lib/format';
import { orderStatusLabel } from '@/lib/order-status';
import { useBranches } from '@/lib/use-branches';
import { startOfTodayISO } from '@/lib/admin-overview';
import { slotShortLabel } from '@/lib/checkout-slots';
import {
  ORDER_WAIT_ALERT_MIN,
  ageLabel,
  buildAdminOrderRows,
  countOrdersByTab,
  isOrderWaitingLong,
  orderAgeMinutes,
  orderItemsSummary,
  orderMatchesTab,
  ordersHeadline,
  ordersToCsv,
  pickAutoAssignments,
  type AdminOrderRow,
  type OrderTab,
} from '@/lib/admin-orders';
import type { AdminOrdersData } from '@/lib/queries';
import type { Driver, Order, OrderItem, OrderTracking } from '@/lib/types';
import { OrderConfirmPanel } from './OrderConfirmPanel';
import { useRealtime, type RealtimeChangePayload } from '@/lib/use-realtime';
import { createTrackingGate } from '@/lib/tracking-gate';
import { useToast } from '@/lib/toast-store';
import { staffMessage } from '@/lib/order-error-messages';
import { fetchAllIn } from '@/lib/fetch-in-chunks';
import { HeroStat } from '@/components/admin/overview/HeroStat';
import { Chip, EmptyState, GhostButton, GlassPanel, Notice, PageHeader, Pill, PrimaryButton, SearchField, Switch, fieldStyle, orderStatusTone } from '@/components/admin/ui/Glass';

const TABS: { value: OrderTab; label: string }[] = [
  { value: 'toconfirm', label: 'À confirmer' },
  { value: 'all', label: 'Toutes' },
  { value: 'active', label: 'En cours' },
  { value: 'unassigned', label: 'À assigner' },
  { value: 'done', label: 'Terminées' },
];

const OPEN = new Set(['pending', 'preparing', 'ready', 'en_route']);

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' });
}

const TH: CSSProperties = { textAlign: 'left', padding: '12px 18px', fontFamily: 'var(--ui-font)', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
const TD: CSSProperties = { padding: '13px 18px', fontFamily: 'var(--ui-font)', verticalAlign: 'middle' };

export function OrdersAdminScreen({ initial }: { initial: AdminOrdersData }) {
  const toast = useToast((t) => t.show);
  const [rows, setRows] = useState<AdminOrderRow[]>(initial.rows);
  const [drivers, setDrivers] = useState<Driver[]>(initial.drivers);
  const [tab, setTab] = useState<OrderTab>('toconfirm');
  const [query, setQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>(''); // '' = all agencies
  const branches = useBranches();
  const [busy, setBusy] = useState(false);
  const [autoAssign, setAutoAssign] = useState(false);
  const [confirmRow, setConfirmRow] = useState<AdminOrderRow | null>(null);
  // Waiting times move without any database event: tick once a minute.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data: orders } = await supabase.from('orders').select('*').order('placed_at', { ascending: false }).limit(200);
    const list = (orders ?? []) as Order[];
    const ids = list.map((o) => o.id);
    const [itemsRes, trackingRes, driversRes, profilesRes] = await Promise.all([
      // Chunked: 200 orders' line items otherwise cross Supabase's silent row cap.
      fetchAllIn<OrderItem>(supabase, 'order_items', '*', 'order_id', ids),
      fetchAllIn<OrderTracking>(supabase, 'order_tracking', '*', 'order_id', ids),
      supabase.from('drivers').select('*').order('name'),
      // Bornée aux clients de ces 200 commandes : « tous les profils » était
      // tronqué en silence à 1000 lignes et les commandes suivantes perdaient
      // leur nom de client. Même requête que le serveur (lib/queries.ts).
      fetchAllIn<{ id: string; full_name: string | null }>(
        supabase,
        'profiles',
        'id, full_name',
        'id',
        Array.from(new Set(list.map((o) => o.user_id).filter(Boolean))) as string[],
      ),
    ]);
    setDrivers((driversRes.data ?? []) as Driver[]);
    setRows(buildAdminOrderRows(list, itemsRes, trackingRes, (driversRes.data ?? []) as Driver[], profilesRes));
  }, []);

  // Cet écran ne montre aucune position : la porte écarte les écritures GPS du
  // livreur (une toutes les 4 s par course), qui rechargeaient sinon les 200
  // commandes et toutes leurs lignes au même rythme.
  const gate = useRef(createTrackingGate()).current;
  const onChange = useCallback(
    (payload: RealtimeChangePayload) => {
      if (payload.table === 'order_tracking' && !gate(payload)) return;
      refetch();
    },
    [gate, refetch],
  );

  useRealtime('admin-orders', [{ table: 'orders' }, { table: 'order_items' }, { table: 'order_tracking' }], onChange);

  const byBranch = useMemo(() => (branchFilter ? rows.filter((r) => r.order.branch_id === branchFilter) : rows), [rows, branchFilter]);
  const counts = useMemo(() => countOrdersByTab(byBranch), [byBranch]);
  const headline = useMemo(() => ordersHeadline(byBranch, startOfTodayISO(now), now), [byBranch, now]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return byBranch.filter((r) => orderMatchesTab(r, tab) && (!q || r.order.code.toLowerCase().includes(q) || (r.customerName ?? '').toLowerCase().includes(q)));
  }, [byBranch, tab, query]);

  // L'erreur était ignorée : confirmer, annuler ou assigner un livreur pouvait
  // échouer sans un mot, et l'écran se rechargeait comme si tout allait bien.
  const runRpc = useCallback(
    async (fn: string, params: Record<string, unknown>) => {
      setBusy(true);
      const { error } = await createClient().rpc(fn, params);
      setBusy(false);
      if (error) toast(staffMessage(error.message), 'alert');
      refetch();
    },
    [refetch, toast],
  );

  const onMarkReady = (orderId: string) => runRpc('admin_mark_order_ready', { p_order: orderId });
  const onAssignDriver = (orderId: string, driverId: string) => runRpc('admin_assign_driver', { p_order: orderId, p_driver: driverId });
  const onCancel = (o: Order) => {
    if (!window.confirm(`Annuler la commande ${o.code} ?`)) return;
    runRpc('admin_set_order_status', { p_order: o.id, p_status: 'cancelled' });
  };

  // Auto-assign: when on, round-robin unassigned ready/preparing orders across
  // online drivers. Guarded by a ref so the same order isn't dispatched twice while
  // a previous assignment + refetch is still settling.
  const inFlight = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!autoAssign || busy) return;
    const onlineIds = drivers.filter((d) => d.is_online).map((d) => d.id);
    const plan = pickAutoAssignments(rows, onlineIds).filter((a) => !inFlight.current.has(a.orderId));
    if (plan.length === 0) return;
    plan.forEach((a) => inFlight.current.add(a.orderId));
    (async () => {
      const supabase = createClient();
      let failed = 0;
      for (const a of plan) {
        const { error } = await supabase.rpc('admin_assign_driver', { p_order: a.orderId, p_driver: a.driverId });
        if (error) failed += 1;
      }
      plan.forEach((a) => inFlight.current.delete(a.orderId));
      // L'attribution automatique travaillait en silence : quand elle échouait,
      // les commandes restaient simplement non assignées, sans explication.
      if (failed > 0) {
        toast(
          `Attribution automatique : ${failed} commande${failed > 1 ? 's' : ''} n’a pas pu être confiée à un livreur.`,
          'alert',
        );
      }
      refetch();
    })();
  }, [autoAssign, busy, rows, drivers, refetch, toast]);

  const exportSales = useCallback(() => {
    const csv = ordersToCsv(visible);
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [visible]);

  return (
    <div style={{ padding: '30px 32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Commandes"
        subtitle={`${counts.toconfirm} à confirmer · ${counts.active} en cours · ${counts.unassigned} à assigner`}
        actions={
          <>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontFamily: 'var(--ui-font)', fontSize: 13, fontWeight: 600, color: 'var(--a-text)', marginRight: 6 }}>
              <Switch checked={autoAssign} onChange={setAutoAssign} label="Affectation auto" />
              Affectation auto
            </span>
            <GhostButton onClick={exportSales}>Exporter ventes</GhostButton>
          </>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px 56px' }}>
        <HeroStat label="À confirmer" value={String(counts.toconfirm)} />
        <HeroStat label="En cours" value={String(counts.active)} />
        <HeroStat label="Chiffre d'affaires du jour" value={formatAmount(headline.todayRevenue)} unit="DH" />
        <HeroStat label={`Panier moyen · ${headline.todayOrders} cmd`} value={formatAmount(headline.avgBasket)} unit="DH" />
      </div>

      {headline.waitingLong > 0 && (
        <Notice icon="clock">
          {headline.waitingLong} commande{headline.waitingLong > 1 ? 's ouvertes' : ' ouverte'} depuis plus de {ORDER_WAIT_ALERT_MIN} min.
        </Notice>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div role="group" aria-label="Filtrer les commandes" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <Chip key={t.value} on={tab === t.value} onClick={() => setTab(t.value)} count={counts[t.value]}>
              {t.label}
            </Chip>
          ))}
        </div>
        {branches.length > 1 && (
          <div role="group" aria-label="Filtrer par agence" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[{ id: '', name: 'Toutes les agences' }, ...branches].map((b) => (
              <Chip key={b.id || 'all'} on={branchFilter === b.id} onClick={() => setBranchFilter(b.id)}>
                {b.name.replace(/ —.*$/, '')}
              </Chip>
            ))}
          </div>
        )}
        <SearchField value={query} onChange={setQuery} label="Rechercher une commande" placeholder="Code ou client…" style={{ maxWidth: 320, marginLeft: 'auto' }} />
      </div>

      <GlassPanel padding={0} style={{ overflowX: 'auto' }}>
        {visible.length === 0 ? (
          <EmptyState title="Aucune commande." hint={query ? 'Essayez un autre code ou un autre nom.' : undefined} />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 940 }}>
            <thead>
              <tr>
                {['Commande', 'Client', 'Articles', 'Total', 'Livreur', 'Statut', ''].map((h, i) => (
                  <th key={i} style={TH}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const o = r.order;
                const canCancel = o.status !== 'delivered' && o.status !== 'cancelled';
                const canAssign = o.status === 'preparing' || o.status === 'ready' || o.status === 'en_route';
                const waitingLong = isOrderWaitingLong(o, now);
                return (
                  <tr key={o.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={TD}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{o.code}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, whiteSpace: 'nowrap' }}>
                        {timeLabel(o.placed_at)}
                        {OPEN.has(o.status) && (
                          <span style={{ color: waitingLong ? 'var(--a-accent)' : 'var(--muted)', fontWeight: waitingLong ? 600 : 400 }}> · {ageLabel(orderAgeMinutes(o, now))}</span>
                        )}
                        {slotShortLabel(o.slot_at, now) && (
                          <span style={{ color: 'var(--a-accent)', fontWeight: 600 }}> · {slotShortLabel(o.slot_at, now)}</span>
                        )}
                      </div>
                    </td>
                    <td style={TD}>
                      <div style={{ fontSize: 13.5, color: 'var(--ink)' }}>{r.customerName ?? '—'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                        {o.mode === 'livraison' ? 'Livraison' : 'Retrait'}
                        {o.payment_method === 'cod' ? ' · espèces' : o.payment_method === 'cashplus' ? ' · Cash Plus' : o.payment_method === 'virement' ? ' · virement' : ''}
                      </div>
                    </td>
                    <td style={{ ...TD, fontSize: 13, color: 'var(--ink)', maxWidth: 240 }}>{orderItemsSummary(r.items)}</td>
                    <td style={{ ...TD, fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{formatDH(o.total_dh)}</td>
                    <td style={TD}>
                      {canAssign ? (
                        <select
                          aria-label={`Livreur de la commande ${o.code}`}
                          value={r.tracking?.driver_id ?? ''}
                          disabled={busy}
                          onChange={(e) => e.target.value && onAssignDriver(o.id, e.target.value)}
                          style={{ ...fieldStyle, padding: '7px 10px', fontSize: 13, width: 'auto', maxWidth: 180 }}
                        >
                          <option value="">Assigner…</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                              {d.is_online ? ' · en ligne' : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{r.driverName ?? '—'}</span>
                      )}
                    </td>
                    <td style={TD}>
                      <Pill tone={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</Pill>
                    </td>
                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                        {o.status === 'pending' && <PrimaryButton onClick={() => setConfirmRow(r)}>Vérifier</PrimaryButton>}
                        {o.status === 'preparing' && (
                          <PrimaryButton disabled={busy} onClick={() => onMarkReady(o.id)}>
                            Prête
                          </PrimaryButton>
                        )}
                        {o.status !== 'pending' && canCancel && (
                          <GhostButton disabled={busy} onClick={() => onCancel(o)} aria-label={`Annuler la commande ${o.code}`}>
                            Annuler
                          </GhostButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </GlassPanel>

      {confirmRow && (
        <OrderConfirmPanel
          row={confirmRow}
          onClose={() => setConfirmRow(null)}
          onDone={() => {
            setConfirmRow(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
