// components/admin/orders/OrdersAdminScreen.tsx
// Live container for the admin Commandes screen. Renders the server snapshot,
// subscribes to postgres_changes on orders / order_items / order_tracking, and
// refetches the same raw shapes — rebuilt via lib/admin-orders.ts so server and
// client agree. Staff writes go through the 0015 RPCs, then a refetch.
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDH } from '@/lib/format';
import { orderStatusLabel, orderStatusPill, ACTIVE_ORDER_STATUSES } from '@/lib/order-status';
import { buildAdminOrderRows, filterAdminOrders, type AdminOrderRow } from '@/lib/admin-orders';
import type { AdminOrdersData } from '@/lib/queries';
import type { Driver, Order, OrderItem, OrderStatus, OrderTracking } from '@/lib/types';
import { OrderDetailPanel } from './OrderDetailPanel';

const STATUS_TABS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'preparing', label: 'En préparation' },
  { value: 'ready', label: 'Prêtes' },
  { value: 'en_route', label: 'En route' },
  { value: 'delivered', label: 'Livrées' },
  { value: 'cancelled', label: 'Annulées' },
];

export function OrdersAdminScreen({ initial }: { initial: AdminOrdersData }) {
  const [rows, setRows] = useState<AdminOrderRow[]>(initial.rows);
  const [drivers, setDrivers] = useState<Driver[]>(initial.drivers);
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(initial.rows[0]?.order.id ?? null);
  const [busy, setBusy] = useState(false);

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

  const visible = useMemo(() => filterAdminOrders(rows, { status, query }), [rows, status, query]);
  const selected = useMemo(() => rows.find((r) => r.order.id === selectedId) ?? null, [rows, selectedId]);

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

  const activeCount = rows.filter((r) => (ACTIVE_ORDER_STATUSES as string[]).includes(r.order.status)).length;

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>Commandes</h1>
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
          {activeCount} commande{activeCount > 1 ? 's' : ''} active{activeCount > 1 ? 's' : ''}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatus(t.value)}
              style={{
                border: '1px solid var(--line)',
                borderRadius: 999,
                padding: '7px 14px',
                cursor: 'pointer',
                fontFamily: 'var(--ui-font)',
                fontSize: 13,
                fontWeight: 600,
                background: status === t.value ? 'var(--brand)' : '#fff',
                color: status === t.value ? '#fff' : 'var(--muted)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un code…"
          style={{ marginLeft: 'auto', border: '1px solid var(--line)', borderRadius: 12, padding: '9px 14px', fontFamily: 'var(--ui-font)', fontSize: 14, minWidth: 220 }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 22, alignItems: 'start' }}>
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
          {visible.length === 0 ? (
            <div style={{ padding: '28px 22px', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', textAlign: 'center' }}>
              Aucune commande.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Commande', 'Client', 'Total', 'Statut'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 18px', fontFamily: 'var(--ui-font)', fontSize: 11.5, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--muted)', background: 'var(--soft)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const pill = orderStatusPill(r.order.status);
                  const isSel = r.order.id === selectedId;
                  return (
                    <tr
                      key={r.order.id}
                      onClick={() => setSelectedId(r.order.id)}
                      style={{ borderTop: '1px solid var(--line)', cursor: 'pointer', background: isSel ? 'var(--soft)' : '#fff' }}
                    >
                      <td style={{ padding: '13px 18px', fontFamily: 'var(--ui-font)', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{r.order.code}</td>
                      <td style={{ padding: '13px 18px', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>{r.customerName ?? '—'}</td>
                      <td style={{ padding: '13px 18px', fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--ink)' }}>{formatDH(r.order.total_dh)}</td>
                      <td style={{ padding: '13px 18px' }}>
                        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: pill.bg, color: pill.fg }}>
                          {orderStatusLabel(r.order.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <OrderDetailPanel
          row={selected}
          drivers={drivers}
          busy={busy}
          onMarkReady={onMarkReady}
          onAssignDriver={onAssignDriver}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
}
