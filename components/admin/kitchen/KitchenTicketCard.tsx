// components/admin/kitchen/KitchenTicketCard.tsx
// One kanban ticket on the Cuisine board: order code, late badge, station + mode
// chips, customer, ETA, the items to prepare, and a single contextual action
// (start / mark ready / hand off) supplied by the parent column. Pure
// presentational — the action is a callback.
'use client';
import type { KitchenTicket } from '@/lib/kitchen';
import { STATION_LABEL } from '@/lib/kitchen';
import { Icon } from '@/components/ui/Icon';

export interface KitchenAction {
  label: string;
  color: string;
  onClick: (orderId: string) => void;
}

export interface KitchenTicketCardProps {
  ticket: KitchenTicket;
  busy: boolean;
  action: KitchenAction | null;
}

function etaLabel(min: number | null): { text: string; late: boolean } | null {
  if (min == null) return null;
  if (min < 0) return { text: `En retard de ${Math.abs(min)} min`, late: true };
  if (min === 0) return { text: "À l'heure", late: false };
  return { text: `Prête dans ~${min} min`, late: false };
}

export function KitchenTicketCard({ ticket, busy, action }: KitchenTicketCardProps) {
  const { order, items, customerName, itemCount, station, late } = ticket;
  const eta = etaLabel(ticket.minutesRemaining);

  return (
    <div
      style={{
        background: '#fff',
        border: late ? '1px solid rgba(210,75,75,0.45)' : '1px solid var(--line)',
        borderRadius: 16,
        boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{order.code}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {late && (
            <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: 'rgba(210,75,75,0.12)', color: '#d24b4b' }}>
              En retard
            </span>
          )}
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: 'rgba(168,151,35,0.14)', color: 'var(--gold)' }}>
            {order.mode === 'livraison' ? 'Livraison' : 'Retrait'}
          </span>
        </div>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--ui-font)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            <Icon name="user" size={14} color="var(--muted)" />
            {customerName}
          </span>
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)' }}>{STATION_LABEL[station]}</span>
        </div>

        {eta && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--ui-font)', fontSize: 12, color: eta.late ? '#d24b4b' : 'var(--muted)' }}>
            <Icon name="clock" size={13} color={eta.late ? '#d24b4b' : 'var(--muted)'} />
            {eta.text}
          </span>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
          {items.map((it) => (
            <div key={it.id} style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--ink)' }}>
              <strong>{it.qty}×</strong> {it.name_snapshot}
            </div>
          ))}
          {items.length === 0 && (
            <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>Aucun article.</span>
          )}
        </div>

        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
          {itemCount} article{itemCount > 1 ? 's' : ''}
        </span>
      </div>

      {action && (
        <div style={{ padding: '0 16px 14px' }}>
          <button
            onClick={() => action.onClick(order.id)}
            disabled={busy}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: 11,
              padding: '11px',
              cursor: busy ? 'default' : 'pointer',
              fontFamily: 'var(--ui-font)',
              fontWeight: 600,
              fontSize: 13.5,
              color: '#fff',
              background: action.color,
              opacity: busy ? 0.6 : 1,
            }}
          >
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
}
