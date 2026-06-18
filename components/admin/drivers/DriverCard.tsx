// components/admin/drivers/DriverCard.tsx
// One livreur card: identity (name + vehicle), online presence dot, rating, and
// today's deliveries + earnings. Pure presentational — all data is prop-driven.
import { Icon } from '@/components/ui/Icon';
import { formatDH } from '@/lib/format';
import { orderStatusLabel } from '@/lib/order-status';
import { isDriverOnline, driverStatus, type DriverStatus } from '@/lib/admin-presence';
import type { DriverRow } from '@/lib/admin-drivers';

const STATUS_UI: Record<DriverStatus, { label: string; bg: string; fg: string; dot: string }> = {
  delivering: { label: 'En livraison', bg: 'rgba(168,151,35,0.16)', fg: '#8a7a14', dot: 'var(--gold)' },
  available: { label: 'Disponible', bg: 'rgba(47,158,111,0.14)', fg: '#2f9e6f', dot: '#2bb673' },
  offline: { label: 'Hors ligne', bg: 'var(--soft)', fg: 'var(--muted)', dot: 'var(--muted)' },
};

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
  /** Open the "create login" modal for this driver (shown when it has no account). */
  onCreateAccess?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function DriverCard({ row, onCreateAccess, onEdit, onDelete }: DriverCardProps) {
  const { driver, deliveries, earnings, currentRoute } = row;
  const online = isDriverOnline(driver);
  const status = STATUS_UI[driverStatus(driver, Boolean(currentRoute))];
  const hasAccount = Boolean(driver.user_id);
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
            background: status.bg,
            color: status.fg,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: 999, background: status.dot }} />
          {status.label}
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

      <div style={{ borderTop: '1px solid var(--line)', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        {hasAccount ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, color: '#2f9e6f' }}>
            <Icon name="check" size={14} color="#2f9e6f" /> Accès actif
          </span>
        ) : (
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)' }}>Pas d&apos;accès</span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          {!hasAccount && (
            <button type="button" onClick={onCreateAccess} style={actionBtn('var(--brand)')}>
              <Icon name="plus" size={13} color="var(--brand)" /> Accès
            </button>
          )}
          <button type="button" onClick={onEdit} style={actionBtn('var(--ink)')}>
            <Icon name="edit" size={13} color="var(--ink)" /> Modifier
          </button>
          <button type="button" onClick={onDelete} style={actionBtn('#C0392B')}>
            <Icon name="x" size={13} color="#C0392B" /> Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

function actionBtn(color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    border: '1px solid var(--line)',
    borderRadius: 9,
    padding: '6px 10px',
    cursor: 'pointer',
    fontFamily: 'var(--ui-font)',
    fontWeight: 600,
    fontSize: 12,
    color,
    background: '#fff',
  };
}
