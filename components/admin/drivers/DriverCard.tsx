// components/admin/drivers/DriverCard.tsx
// One livreur card: identity (name + vehicle), online presence dot, rating, and
// today's deliveries + earnings. Pure presentational — all data is prop-driven.
import { Icon } from '@/components/ui/Icon';
import { formatDH } from '@/lib/format';
import { orderStatusLabel } from '@/lib/order-status';
import type { DriverRow } from '@/lib/admin-drivers';

function lastSeenLabel(iso: string | null | undefined): string {
  if (!iso) return 'Jamais vu en ligne';
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return "Vu à l'instant";
  if (mins < 60) return `Vu il y a ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `Vu il y a ${h} h`;
  return `Vu il y a ${Math.floor(h / 24)} j`;
}

export interface DriverCardProps {
  row: DriverRow;
}

export function DriverCard({ row }: DriverCardProps) {
  const { driver, deliveries, earnings, currentRoute } = row;
  const online = !!driver.is_online;
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: 18,
        boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'var(--soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="scooter" size={22} color="var(--brand-d)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {driver.name}
          </div>
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
            {driver.vehicle || 'Véhicule non précisé'}
          </div>
        </div>
        <span
          style={{
            fontFamily: 'var(--ui-font)',
            fontSize: 11.5,
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 999,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: online ? 'rgba(19,124,139,0.12)' : 'var(--soft)',
            color: online ? 'var(--brand-d)' : 'var(--muted)',
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: 999, background: online ? '#2bb673' : 'var(--muted)' }} />
          {online ? 'En ligne' : 'Hors ligne'}
        </span>
      </div>

      <div style={{ padding: '0 18px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="star" size={15} color="var(--gold)" />
        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
          {driver.rating.toFixed(1)}
        </span>
        {driver.phone && (
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Icon name="phone" size={14} color="var(--muted)" />
            {driver.phone}
          </span>
        )}
      </div>

      <div style={{ padding: '14px 18px 16px', marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: 'var(--soft)', borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>{deliveries}</div>
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
            Livraison{deliveries > 1 ? 's' : ''} aujourd&apos;hui
          </div>
        </div>
        <div style={{ background: 'var(--soft)', borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>{formatDH(earnings)}</div>
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>Gains du jour</div>
        </div>
      </div>

      <div style={{ padding: '0 18px 16px' }}>
        {currentRoute ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(19,124,139,0.10)', borderRadius: 12, padding: '9px 12px' }}>
            <Icon name="scooter" size={16} color="var(--brand-d)" />
            <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--brand-d)' }}>{currentRoute.code}</span>
            <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--brand-d)', marginLeft: 'auto' }}>{orderStatusLabel(currentRoute.status)}</span>
          </div>
        ) : (
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)' }}>
            {online ? 'Disponible — aucune course en cours' : lastSeenLabel(driver.last_seen)}
          </div>
        )}
      </div>
    </div>
  );
}
