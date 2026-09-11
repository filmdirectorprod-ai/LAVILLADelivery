// components/admin/drivers/DriverCard.tsx
// One livreur card: identity (name + vehicle), status pill, rating and phone,
// today's deliveries + earnings, the current run, app access and the actions.
// Pure presentational — all data is prop-driven.
import { Icon } from '@/components/ui/Icon';
import { formatAmount } from '@/lib/format';
import { orderStatusLabel } from '@/lib/order-status';
import { isDriverOnline, driverStatus, type DriverStatus } from '@/lib/admin-presence';
import type { DriverRow } from '@/lib/admin-drivers';
import { MiniStat } from '@/components/admin/overview/HeroStat';
import { GhostButton, GlassPanel, IconTile, Pill, SubPanel, type PillTone } from '@/components/admin/ui/Glass';

const STATUS_UI: Record<DriverStatus, { label: string; tone: PillTone }> = {
  delivering: { label: 'En livraison', tone: 'solid' },
  available: { label: 'Disponible', tone: 'outline' },
  offline: { label: 'Hors ligne', tone: 'muted' },
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
  const text = { fontFamily: 'var(--ui-font)' } as const;

  return (
    <GlassPanel padding={0} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '18px 18px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <IconTile name="scooter" size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ ...text, margin: 0, fontWeight: 600, fontSize: 16, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{driver.name}</h3>
          <div style={{ ...text, fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{driver.vehicle || 'Véhicule non précisé'}</div>
        </div>
        <Pill tone={status.tone}>{status.label}</Pill>
      </div>

      <div style={{ padding: '12px 18px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="star" size={15} color="var(--a-accent)" fill />
        <span style={{ ...text, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{Number(driver.rating ?? 0).toFixed(1)}</span>
        {driver.phone && (
          <a href={`tel:${driver.phone.replace(/[^0-9+]/g, '')}`} style={{ ...text, fontSize: 12.5, color: 'var(--muted)', marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
            <Icon name="phone" size={14} color="var(--muted)" />
            {driver.phone}
          </a>
        )}
      </div>

      <div style={{ padding: '16px 18px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <MiniStat label={`Livraison${deliveries > 1 ? 's' : ''} aujourd'hui`} value={String(deliveries)} />
        <MiniStat label="Gains du jour" value={formatAmount(earnings)} unit="DH" />
      </div>

      <div style={{ padding: '14px 18px 16px' }}>
        {currentRoute ? (
          <SubPanel style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 14 }}>
            <Icon name="scooter" size={16} color="var(--ink)" />
            <span style={{ ...text, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{currentRoute.code}</span>
            <span style={{ ...text, fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>{orderStatusLabel(currentRoute.status)}</span>
          </SubPanel>
        ) : (
          <div style={{ ...text, fontSize: 12, color: 'var(--muted)' }}>{online ? 'Disponible — aucune course en cours' : lastSeenLabel(driver.last_seen)}</div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--line)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {hasAccount ? (
          <span style={{ ...text, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
            <Icon name="check" size={14} color="var(--ink)" /> Accès actif
          </span>
        ) : (
          <span style={{ ...text, fontSize: 12, fontWeight: 600, color: 'var(--a-accent)' }}>Pas d&apos;accès</span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          {!hasAccount && (
            <GhostButton onClick={onCreateAccess} aria-label={`Créer un accès pour ${driver.name}`} style={{ padding: '6px 11px', fontSize: 12 }}>
              + Accès
            </GhostButton>
          )}
          <GhostButton onClick={onEdit} aria-label={`Modifier ${driver.name}`} style={{ padding: '6px 11px', fontSize: 12 }}>
            Modifier
          </GhostButton>
          <GhostButton onClick={onDelete} aria-label={`Supprimer ${driver.name}`} style={{ padding: '6px 9px' }}>
            <Icon name="x" size={13} color="var(--ink)" />
          </GhostButton>
        </div>
      </div>
    </GlassPanel>
  );
}
