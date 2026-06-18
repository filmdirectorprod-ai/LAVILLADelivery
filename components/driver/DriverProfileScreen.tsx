'use client';
// Driver profile — identity card, lifetime stats, and the entry points to
// Settings and logout. Client component: it owns the sign-out action and the
// row navigation.
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatDH } from '@/lib/format';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import { BranchesInfo } from '@/components/ui/BranchesInfo';
import type { Driver } from '@/lib/types';

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

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: `${SAFE_TOP + 10}px 18px 22px`, background: 'linear-gradient(150deg, var(--brand), var(--brand-d))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, border: '2.5px solid var(--gold)', padding: 2, flexShrink: 0 }}>
            <PhotoSlot
              label={driver.name}
              src={driver.avatar_url ?? undefined}
              style={{ width: '100%', height: '100%', borderRadius: 999 }}
              dim
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--ui-font)',
                fontWeight: 700,
                fontSize: 19,
                color: '#fff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {driver.name}
            </div>
            <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
              {driver.vehicle ?? 'Scooter'} · ⭐ {driver.rating.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: `16px 16px ${SAFE_BOTTOM + 16}px` }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <Stat label="Livraisons" value={String(totalDeliveries)} />
          <Stat label="Gains totaux" value={formatDH(totalEarnings)} />
          <Stat label="Note" value={driver.rating.toFixed(1)} />
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)' }}>
          <NavRow
            icon="phone"
            label="Téléphone"
            value={driver.phone ?? '—'}
          />
          <NavRow icon="settings" label="Paramètres" onClick={() => router.push('/driver/settings')} chevron />
          <NavRow icon="logout" label="Déconnexion" onClick={logout} danger last />
        </div>

        <div style={{ marginTop: 16 }}>
          <BranchesInfo title="Points de retrait La Villa" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: '14px 12px' }}>
      <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 17, color: 'var(--ink)' }}>{value}</div>
      <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function NavRow({
  icon,
  label,
  value,
  onClick,
  chevron,
  danger,
  last,
}: {
  icon: string;
  label: string;
  value?: string;
  onClick?: () => void;
  chevron?: boolean;
  danger?: boolean;
  last?: boolean;
}) {
  const color = danger ? '#d8453b' : 'var(--ink)';
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        background: 'none',
        border: 'none',
        borderBottom: last ? 'none' : '1px solid var(--line)',
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left',
      }}
    >
      <Icon name={icon} size={19} color={danger ? '#d8453b' : 'var(--brand)'} />
      <span style={{ flex: 1, fontFamily: 'var(--ui-font)', fontSize: 14.5, fontWeight: 600, color }}>{label}</span>
      {value && <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>{value}</span>}
      {chevron && <Icon name="right" size={18} color="var(--muted)" />}
    </button>
  );
}
