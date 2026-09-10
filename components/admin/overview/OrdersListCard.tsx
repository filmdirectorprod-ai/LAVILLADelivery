// components/admin/overview/OrdersListCard.tsx
// La carte claire de la colonne de droite (la carte crème du modèle) : liste
// compacte des commandes filtrées par les pastilles de l'en-tête. Une liste
// plutôt qu'un tableau, parce que la colonne est étroite.
//
// L'admin inverse les jetons d'encre en blanc pour ses cartes sombres ; cette
// carte est blanche, elle les redéfinit donc localement en turquoise foncé
// (#0F606B, 7:1 sur blanc) pour elle et ses descendants.
import type { CSSProperties } from 'react';
import { formatDH } from '@/lib/format';
import { orderStatusLabel, orderStatusPill } from '@/lib/order-status';
import type { Order } from '@/lib/types';

export interface OrderListRow {
  order: Order;
  driverName: string | null;
}

export interface OrdersListCardProps {
  title: string;
  emptyText: string;
  rows: OrderListRow[];
}

const LIGHT_CARD = {
  background: '#ffffff',
  borderRadius: 24,
  padding: '18px 18px 8px',
  boxShadow: '0 14px 40px -18px rgba(0, 0, 0, 0.55)',
  color: '#0f606b',
  '--ink': '#0f606b',
  '--muted': 'rgba(15, 96, 107, 0.72)',
  '--line': 'rgba(15, 96, 107, 0.12)',
  '--soft': 'rgba(19, 124, 139, 0.08)',
  '--brand-d': '#0f606b',
} as CSSProperties;

export function OrdersListCard({ title, emptyText, rows }: OrdersListCardProps) {
  return (
    <section style={LIGHT_CARD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 15, color: 'var(--ink)', margin: 0 }}>{title}</h2>
        <span
          style={{
            fontFamily: 'var(--ui-font)',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--ink)',
            background: 'var(--soft)',
            borderRadius: 999,
            padding: '3px 10px',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {rows.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: '26px 4px 22px', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', textAlign: 'center' }}>{emptyText}</div>
      ) : (
        <div style={{ maxHeight: 420, overflowY: 'auto', margin: '0 -4px', padding: '0 4px' }}>
          {rows.map(({ order, driverName }) => {
            const pill = orderStatusPill(order.status);
            return (
              <div
                key={order.id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 2px', borderTop: '1px solid var(--line)' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--ui-font)', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{order.code}</div>
                  <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {order.mode === 'livraison' ? 'Livraison' : 'Retrait'} · {driverName ?? 'Non assigné'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatDH(order.total_dh)}
                  </div>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: 3,
                      fontFamily: 'var(--ui-font)',
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 9px',
                      borderRadius: 999,
                      background: pill.bg,
                      color: pill.fg,
                    }}
                  >
                    {orderStatusLabel(order.status)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
