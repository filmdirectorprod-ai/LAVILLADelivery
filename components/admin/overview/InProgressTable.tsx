// components/admin/overview/InProgressTable.tsx
// Table of in-progress orders (preparing / en_route) for the overview. Shows the
// order code, mode, total, status pill and assigned driver. Prop-driven.
import { formatDH } from '@/lib/format';
import type { Order } from '@/lib/types';

export interface InProgressRow {
  order: Order;
  driverName: string | null;
}

export interface InProgressTableProps {
  rows: InProgressRow[];
}

const STATUS_LABEL: Record<string, string> = {
  preparing: 'En préparation',
  en_route: 'En route',
};

export function InProgressTable({ rows }: InProgressTableProps) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: 18,
        boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
        <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 16, color: 'var(--ink)', margin: 0 }}>
          Commandes en cours
        </h2>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: '28px 22px', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', textAlign: 'center' }}>
          Aucune commande en cours pour l&apos;instant.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Commande', 'Mode', 'Total', 'Statut', 'Livreur'].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: '12px 22px',
                    fontFamily: 'var(--ui-font)',
                    fontSize: 11.5,
                    fontWeight: 600,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                    background: 'var(--soft)',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ order, driverName }) => (
              <tr key={order.id} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '14px 22px', fontFamily: 'var(--ui-font)', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                  {order.code}
                </td>
                <td style={{ padding: '14px 22px', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>
                  {order.mode === 'livraison' ? 'Livraison' : 'Retrait'}
                </td>
                <td style={{ padding: '14px 22px', fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--ink)' }}>
                  {formatDH(order.total_dh)}
                </td>
                <td style={{ padding: '14px 22px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--ui-font)',
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: order.status === 'en_route' ? 'rgba(19,124,139,0.12)' : 'rgba(168,151,35,0.14)',
                      color: order.status === 'en_route' ? 'var(--brand-d)' : 'var(--gold)',
                    }}
                  >
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                </td>
                <td style={{ padding: '14px 22px', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: driverName ? 'var(--ink)' : 'var(--muted)' }}>
                  {driverName ?? 'Non assigné'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
