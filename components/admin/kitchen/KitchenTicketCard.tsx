// components/admin/kitchen/KitchenTicketCard.tsx
// One kanban ticket on the Cuisine board: order code, late badge, mode, customer,
// station, ETA, the items to prepare, and a single contextual action (mark ready /
// hand off) supplied by the parent column. Pure presentational — the action is a
// callback.
'use client';
import type { KitchenTicket } from '@/lib/kitchen';
import { STATION_LABEL } from '@/lib/kitchen';
import { Icon } from '@/components/ui/Icon';
import { Pill, PrimaryButton, SubPanel } from '@/components/admin/ui/Glass';

export interface KitchenAction {
  label: string;
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
    <SubPanel style={{ display: 'flex', flexDirection: 'column', gap: 10, border: late ? '1px solid var(--a-accent)' : '1px solid transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>{order.code}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {late && <Pill tone="accent">En retard</Pill>}
          <Pill tone="outline">{order.mode === 'livraison' ? 'Livraison' : 'Retrait'}</Pill>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--ui-font)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
          <Icon name="user" size={14} color="var(--muted)" />
          {customerName}
        </span>
        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)' }}>{STATION_LABEL[station]}</span>
      </div>

      {eta && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: eta.late ? 600 : 400, color: eta.late ? 'var(--a-accent)' : 'var(--muted)' }}>
          <Icon name="clock" size={13} color={eta.late ? 'var(--a-accent)' : 'var(--muted)'} />
          {eta.text}
        </span>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
        {items.map((it) => (
          <div key={it.id} style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--ink)' }}>
            <strong style={{ fontWeight: 600 }}>{it.qty}×</strong> {it.name_snapshot}
          </div>
        ))}
        {items.length === 0 && <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>Aucun article.</span>}
        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
          {itemCount} article{itemCount > 1 ? 's' : ''}
        </span>
      </div>

      {action && (
        <PrimaryButton onClick={() => action.onClick(order.id)} disabled={busy} style={{ width: '100%' }} aria-label={`${action.label} — ${order.code}`}>
          {action.label}
        </PrimaryButton>
      )}
    </SubPanel>
  );
}
