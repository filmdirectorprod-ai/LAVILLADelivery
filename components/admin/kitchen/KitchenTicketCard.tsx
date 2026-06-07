// components/admin/kitchen/KitchenTicketCard.tsx
// One kitchen ticket: order code, time waiting, mode, the items to prepare, and a
// "Marquer prête" action. Pure presentational — the action is a callback.
'use client';
import type { KitchenTicket } from '@/lib/queries';

function waitedLabel(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Depuis ${mins} min`;
  const h = Math.floor(mins / 60);
  return `Depuis ${h} h`;
}

export interface KitchenTicketCardProps {
  ticket: KitchenTicket;
  busy: boolean;
  onMarkReady: (orderId: string) => void;
}

export function KitchenTicketCard({ ticket, busy, onMarkReady }: KitchenTicketCardProps) {
  const { order, items } = ticket;
  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{order.code}</span>
        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: 'rgba(168,151,35,0.14)', color: 'var(--gold)' }}>
          {order.mode === 'livraison' ? 'Livraison' : 'Retrait'}
        </span>
      </div>
      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)' }}>{waitedLabel(order.placed_at)}</span>
        {items.map((it) => (
          <div key={it.id} style={{ fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>
            {it.qty} × {it.name_snapshot}
          </div>
        ))}
        {items.length === 0 && (
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)' }}>Aucun article.</span>
        )}
      </div>
      <div style={{ padding: '0 18px 16px' }}>
        <button
          onClick={() => onMarkReady(order.id)}
          disabled={busy}
          style={{ width: '100%', border: 'none', borderRadius: 12, padding: '12px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: '#fff', background: 'var(--brand)', opacity: busy ? 0.6 : 1 }}
        >
          Marquer prête
        </button>
      </div>
    </div>
  );
}
