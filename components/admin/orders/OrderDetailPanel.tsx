// components/admin/orders/OrderDetailPanel.tsx
// Right-hand detail for the selected order: customer, items, totals, plus staff
// actions (mark ready, assign driver, cancel). Pure presentational — every write
// is delegated to a callback so the container owns the RPC + refetch.
'use client';
import { formatDH } from '@/lib/format';
import { orderStatusLabel, orderStatusPill } from '@/lib/order-status';
import type { AdminOrderRow } from '@/lib/admin-orders';
import type { Driver } from '@/lib/types';

export interface OrderDetailPanelProps {
  row: AdminOrderRow | null;
  drivers: Driver[];
  busy: boolean;
  onMarkReady: (orderId: string) => void;
  onAssignDriver: (orderId: string, driverId: string) => void;
  onCancel: (orderId: string) => void;
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid var(--line)',
  borderRadius: 18,
  boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)',
  overflow: 'hidden',
  alignSelf: 'start',
};

export function OrderDetailPanel({ row, drivers, busy, onMarkReady, onAssignDriver, onCancel }: OrderDetailPanelProps) {
  if (!row) {
    return (
      <div style={{ ...cardStyle, padding: '40px 22px', textAlign: 'center' }}>
        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>
          Sélectionnez une commande pour voir le détail.
        </span>
      </div>
    );
  }

  const { order, items, customerName, driverName } = row;
  const pill = orderStatusPill(order.status);
  const canCancel = order.status !== 'delivered' && order.status !== 'cancelled';

  return (
    <div style={cardStyle}>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 18, color: 'var(--ink)', margin: 0 }}>{order.code}</h2>
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>
            {customerName ?? 'Client'} · {order.mode === 'livraison' ? 'Livraison' : 'Retrait'}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: pill.bg, color: pill.fg }}>
          {orderStatusLabel(order.status)}
        </span>
      </div>

      <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it) => (
          <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--ink)' }}>
            <span>{it.qty} × {it.name_snapshot}</span>
            <span style={{ color: 'var(--muted)' }}>{formatDH(it.price_snapshot * it.qty)}</span>
          </div>
        ))}
        {items.length === 0 && (
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)' }}>Aucun article.</span>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 4, fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>
          <span>Total</span>
          <span>{formatDH(order.total_dh)}</span>
        </div>
        {order.address && (
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>{order.address}</div>
        )}
      </div>

      <div style={{ padding: '0 22px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {order.status === 'preparing' && (
          <button
            onClick={() => onMarkReady(order.id)}
            disabled={busy}
            style={{ width: '100%', border: 'none', borderRadius: 12, padding: '12px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: '#fff', background: 'var(--brand)', opacity: busy ? 0.6 : 1 }}
          >
            Marquer prête
          </button>
        )}

        <label style={{ fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
          Livreur {driverName ? `· ${driverName}` : '· non assigné'}
        </label>
        <select
          value={row.tracking?.driver_id ?? ''}
          disabled={busy}
          onChange={(e) => e.target.value && onAssignDriver(order.id, e.target.value)}
          style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 12, padding: '11px 12px', fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--ink)', background: '#fff' }}
        >
          <option value="">Assigner un livreur…</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        {canCancel && (
          <button
            onClick={() => onCancel(order.id)}
            disabled={busy}
            style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 12, padding: '11px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13.5, color: '#a23', background: '#fff', opacity: busy ? 0.6 : 1 }}
          >
            Annuler la commande
          </button>
        )}
      </div>
    </div>
  );
}
