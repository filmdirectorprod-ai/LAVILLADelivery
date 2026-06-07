// components/admin/orders/OrdersAdminScreen.tsx
// Live container for the admin Commandes screen. Renders the server snapshot as a
// full-width table with count-badge tabs (Toutes / En cours / À assigner /
// Terminées), an inline per-row driver assignment, a "Marquer prête" action, sales
// CSV export, and an optional "Affectation auto" mode that round-robins unassigned
// ready orders across online drivers. Subscribes to postgres_changes on orders /
// order_items / order_tracking and refetches the same raw shapes — rebuilt via
// lib/admin-orders.ts so server and client agree. Staff writes go through the 0015
// RPCs, then a refetch.
'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDH } from '@/lib/format';
import { orderStatusLabel, orderStatusPill } from '@/lib/order-status';
import {
  buildAdminOrderRows,
  filterAdminOrdersByTab,
  countOrdersByTab,
  orderItemsSummary,
  ordersToCsv,
  pickAutoAssignments,
  type AdminOrderRow,
  type OrderTab,
} from '@/lib/admin-orders';
import type { AdminOrdersData } from '@/lib/queries';
import type { Driver, Order, OrderItem, OrderTracking } from '@/lib/types';

const TABS: { value: OrderTab; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'active', label: 'En cours' },
  { value: 'unassigned', label: 'À assigner' },
  { value: 'done', label: 'Terminées' },
];

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function OrdersAdminScreen({ initial }: { initial: AdminOrdersData }) {
  const [rows, setRows] = useState<AdminOrderRow[]>(initial.rows);
  const [drivers, setDrivers] = useState<Driver[]>(initial.drivers);
  const [tab, setTab] = useState<OrderTab>('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [autoAssign, setAutoAssign] = useState(false);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .order('placed_at', { ascending: false })
      .limit(200);
    const list = (orders ?? []) as Order[];
    const ids = list.map((o) => o.id);
    const [itemsRes, trackingRes, driversRes, profilesRes] = await Promise.all([
      ids.length ? supabase.from('order_items').select('*').in('order_id', ids) : Promise.resolve({ data: [] as OrderItem[] }),
      ids.length ? supabase.from('order_tracking').select('*').in('order_id', ids) : Promise.resolve({ data: [] as OrderTracking[] }),
      supabase.from('drivers').select('*').order('name'),
      supabase.from('profiles').select('id, full_name'),
    ]);
    setDrivers((driversRes.data ?? []) as Driver[]);
    setRows(
      buildAdminOrderRows(
        list,
        (itemsRes.data ?? []) as OrderItem[],
        (trackingRes.data ?? []) as OrderTracking[],
        (driversRes.data ?? []) as Driver[],
        (profilesRes.data ?? []) as { id: string; full_name: string | null }[],
      ),
    );
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_tracking' }, refetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const counts = useMemo(() => countOrdersByTab(rows), [rows]);
  const visible = useMemo(() => filterAdminOrdersByTab(rows, tab, query), [rows, tab, query]);

  const runRpc = useCallback(
    async (fn: string, params: Record<string, unknown>) => {
      setBusy(true);
      const supabase = createClient();
      await supabase.rpc(fn, params);
      setBusy(false);
      refetch();
    },
    [refetch],
  );

  const onMarkReady = (orderId: string) => runRpc('admin_mark_order_ready', { p_order: orderId });
  const onAssignDriver = (orderId: string, driverId: string) => runRpc('admin_assign_driver', { p_order: orderId, p_driver: driverId });
  const onCancel = (orderId: string) => runRpc('admin_set_order_status', { p_order: orderId, p_status: 'cancelled' });

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
      for (const a of plan) {
        await supabase.rpc('admin_assign_driver', { p_order: a.orderId, p_driver: a.driverId });
      }
      plan.forEach((a) => inFlight.current.delete(a.orderId));
      refetch();
    })();
  }, [autoAssign, busy, rows, drivers, refetch]);

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
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>Commandes</h1>
          <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
            {counts.active} en cours · {counts.unassigned} à assigner
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--ui-font)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            <input type="checkbox" checked={autoAssign} onChange={(e) => setAutoAssign(e.target.checked)} />
            Affectation auto
          </label>
          <button
            type="button"
            onClick={exportSales}
            style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13, color: 'var(--ink)', background: '#fff' }}
          >
            Exporter ventes
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map((t) => {
            const active = tab === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 999,
                  padding: '7px 14px',
                  cursor: 'pointer',
                  fontFamily: 'var(--ui-font)',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  background: active ? 'var(--brand)' : '#fff',
                  color: active ? '#fff' : 'var(--muted)',
                }}
              >
                {t.label}
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: active ? 'rgba(255,255,255,0.22)' : 'var(--soft)', color: active ? '#fff' : 'var(--muted)' }}>
                  {counts[t.value]}
                </span>
              </button>
            );
          })}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un code…"
          style={{ marginLeft: 'auto', border: '1px solid var(--line)', borderRadius: 12, padding: '9px 14px', fontFamily: 'var(--ui-font)', fontSize: 14, minWidth: 220 }}
        />
      </div>

      <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)', overflowX: 'auto' }}>
        {visible.length === 0 ? (
          <div style={{ padding: '36px 22px', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', textAlign: 'center' }}>
            Aucune commande.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
            <thead>
              <tr>
                {['Commande', 'Client', 'Articles', 'Total', 'Livreur', 'Statut', ''].map((h, i) => (
                  <th key={i} style={{ textAlign: 'left', padding: '12px 18px', fontFamily: 'var(--ui-font)', fontSize: 11.5, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--muted)', background: 'var(--soft)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const pill = orderStatusPill(r.order.status);
                const canCancel = r.order.status !== 'delivered' && r.order.status !== 'cancelled';
                const canAssign = r.order.status === 'preparing' || r.order.status === 'ready' || r.order.status === 'en_route';
                return (
                  <tr key={r.order.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px 18px' }}>
                      <div style={{ fontFamily: 'var(--ui-font)', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{r.order.code}</div>
                      <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{timeLabel(r.order.placed_at)}</div>
                    </td>
                    <td style={{ padding: '12px 18px', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>{r.customerName ?? '—'}</td>
                    <td style={{ padding: '12px 18px', fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--ink)', maxWidth: 220 }}>{orderItemsSummary(r.items)}</td>
                    <td style={{ padding: '12px 18px', fontFamily: 'var(--ui-font)', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{formatDH(r.order.total_dh)}</td>
                    <td style={{ padding: '12px 18px' }}>
                      {canAssign ? (
                        <select
                          value={r.tracking?.driver_id ?? ''}
                          disabled={busy}
                          onChange={(e) => e.target.value && onAssignDriver(r.order.id, e.target.value)}
                          style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '7px 10px', fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--ink)', background: '#fff', maxWidth: 170 }}
                        >
                          <option value="">Assigner…</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}{d.is_online ? ' ·●' : ''}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)' }}>{r.driverName ?? '—'}</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: pill.bg, color: pill.fg }}>
                        {orderStatusLabel(r.order.status)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                        {r.order.status === 'preparing' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onMarkReady(r.order.id)}
                            style={{ border: 'none', borderRadius: 8, padding: '6px 12px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: '#fff', background: 'var(--brand)', opacity: busy ? 0.6 : 1 }}
                          >
                            Prête
                          </button>
                        )}
                        {canCancel && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onCancel(r.order.id)}
                            title="Annuler la commande"
                            style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: '#a23', background: '#fff', opacity: busy ? 0.6 : 1 }}
                          >
                            Annuler
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
