'use client';
// Profil livreur — carte d'identité, cumuls, accès aux réglages et déconnexion.
// Dans la langue de l'admin : panneaux de verre, grands chiffres fins.
// Correction : la note ne plante plus quand elle est vide, et la déconnexion
// passe en or (la charte n'a pas de rouge).
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatDH } from '@/lib/format';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import { BranchesInfo } from '@/components/ui/BranchesInfo';
import type { Driver } from '@/lib/types';
import { Figure, Panel, SectionTitle, text } from '@/components/driver/ui/DriverUI';

export function DriverProfileScreen({
  driver,
  totalDeliveries,
  totalEarnings,
}: {
  driver: Driver;
  totalDeliveries: number;
  totalEarnings: number;
}) {
  const router = useRouter();
  const note = Number(driver.rating ?? 0).toFixed(1);

  const logout = async () => {
    await createClient().auth.signOut();
    router.push('/auth');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      <div style={{ padding: `${SAFE_TOP + 12}px 16px 0`, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 64, height: 64, borderRadius: 999, border: '2px solid var(--a-accent)', padding: 2, flexShrink: 0 }}>
          <PhotoSlot label={driver.name} src={driver.avatar_url ?? undefined} style={{ width: '100%', height: '100%', borderRadius: 999 }} dim />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...text, fontWeight: 600, fontSize: 21, color: 'var(--a-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {driver.name}
          </div>
          <div style={{ ...text, fontSize: 13, color: 'var(--a-muted)', marginTop: 2 }}>
            {driver.vehicle ?? 'Scooter'} · note {note} / 5
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, padding: '22px 16px 0', flexWrap: 'wrap' }}>
        <Figure label="Livraisons" value={String(totalDeliveries)} />
        <Figure label="Gains cumulés" value={formatDH(totalEarnings).replace(' DH', '')} unit="DH" />
        <Figure label="Note" value={note} unit="/ 5" />
      </div>

      <div style={{ padding: `20px 16px ${SAFE_BOTTOM + 16}px`, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Panel padding={0}>
          <NavRow icon="phone" label="Téléphone" value={driver.phone ?? '—'} />
          <NavRow icon="settings" label="Paramètres" onClick={() => router.push('/driver/settings')} chevron />
          <NavRow icon="logout" label="Déconnexion" onClick={logout} accent last />
        </Panel>

        <div>
          <SectionTitle>Points de retrait</SectionTitle>
          <BranchesInfo title="Points de retrait La Villa" />
        </div>
      </div>
    </div>
  );
}

function NavRow({
  icon,
  label,
  value,
  onClick,
  chevron,
  accent,
  last,
}: {
  icon: string;
  label: string;
  value?: string;
  onClick?: () => void;
  chevron?: boolean;
  accent?: boolean;
  last?: boolean;
}) {
  const color = accent ? 'var(--a-accent)' : 'var(--ink)';
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{
        width: '100%',
        minHeight: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '15px 16px',
        background: 'none',
        border: 'none',
        borderBottom: last ? 'none' : '1px solid var(--line)',
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left',
      }}
    >
      <Icon name={icon} size={19} color={color} />
      <span style={{ ...text, flex: 1, fontSize: 15, fontWeight: 600, color }}>{label}</span>
      {value && <span style={{ ...text, fontSize: 13.5, color: 'var(--muted)' }}>{value}</span>}
      {chevron && <Icon name="right" size={18} color="var(--muted)" />}
    </button>
  );
}
