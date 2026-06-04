'use client';
// COMPTE — profile hub. Ported from the prototype (screens-account.jsx Profile),
// driven by the real signed-in profile (loyalty balance + tier). Sign-out uses
// the browser Supabase client; menu rows route to the real screens.
import { useRouter } from 'next/navigation';
import type { Profile } from '@/lib/types';
import { tierFor, nextTierFor } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import { SAFE_TOP } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { PhotoSlot } from '@/components/ui/PhotoSlot';

export interface ProfileScreenProps {
  profile: Profile | null;
}

const MENU: [string, string, string | null][] = [
  ['pin', 'Gérer les adresses', null],
  ['card', 'Moyens de paiement', null],
  ['receipt', 'Mes commandes', '/orders'],
  ['heart', 'Favoris', '/search'],
  ['percent', 'Offres & promos', null],
  ['gift', 'Programme de fidélité', '/loyalty'],
  ['info', 'Aide / Support', null],
  ['settings', 'Paramètres', null],
];

export function ProfileScreen({ profile }: ProfileScreenProps) {
  const router = useRouter();
  const points = profile?.loyalty_points ?? 0;
  const tier = tierFor(points);
  const next = nextTierFor(points);
  const prog = next ? Math.min(1, (points - tier.min) / (next.min - tier.min)) : 1;

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth');
    router.refresh();
  };

  return (
    <div>
      <div style={{ padding: `${SAFE_TOP + 10}px 18px 22px`, background: 'linear-gradient(150deg, var(--brand), var(--brand-d))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, border: '2.5px solid var(--gold)', padding: 2, flexShrink: 0 }}>
            <PhotoSlot label={profile?.full_name ?? 'avatar'} src={profile?.avatar_url} style={{ width: '100%', height: '100%', borderRadius: 999 }} dim />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 19, color: '#fff' }}>
              {profile?.full_name ?? 'Bienvenue'}
            </div>
            <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
              {profile?.phone ?? 'La Villa'}
            </div>
          </div>
          <button style={{ width: 38, height: 38, borderRadius: 999, background: 'rgba(255,255,255,0.18)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="edit" size={18} color="#fff" />
          </button>
        </div>

        <button
          onClick={() => router.push('/loyalty')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(255,255,255,0.14)',
            border: 'none',
            textAlign: 'left',
            cursor: 'pointer',
            width: '100%',
            borderRadius: 16,
            padding: '13px 15px',
            marginTop: 16,
          }}
        >
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(168,151,35,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="gift" size={22} color="var(--gold)" fill />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: '#fff' }}>
              Palier {tier.label} · {points.toLocaleString('fr-FR')} points
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.25)', marginTop: 7, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(prog * 100)}%`, height: '100%', background: 'var(--gold)', transition: 'width .4s ease' }} />
            </div>
          </div>
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'rgba(255,255,255,0.85)', textAlign: 'right', lineHeight: 1.3 }}>
            {next ? (
              <>
                {next.min - points} pts
                <br />
                pour {next.label}
              </>
            ) : (
              'Palier max'
            )}
          </span>
        </button>
      </div>

      <div style={{ padding: '16px 18px 0' }}>
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
          {MENU.map(([icon, label, dest], i) => (
            <button
              key={label}
              onClick={() => dest && router.push(dest)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                width: '100%',
                padding: '14px 16px',
                cursor: dest ? 'pointer' : 'default',
                background: '#fff',
                border: 'none',
                borderTop: i ? '1px solid var(--line)' : 'none',
                opacity: dest ? 1 : 0.55,
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={icon} size={19} color="var(--brand)" />
              </div>
              <span style={{ flex: 1, textAlign: 'left', fontFamily: 'var(--ui-font)', fontSize: 14.5, fontWeight: 500, color: 'var(--ink)' }}>{label}</span>
              <Icon name="right" size={18} color="var(--muted)" />
            </button>
          ))}
        </div>
        <button
          onClick={signOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
            width: '100%',
            padding: '15px',
            marginTop: 14,
            background: '#fff',
            border: '1px solid var(--line)',
            borderRadius: 16,
            cursor: 'pointer',
            fontFamily: 'var(--ui-font)',
            fontSize: 14.5,
            fontWeight: 600,
            color: '#C0392B',
          }}
        >
          <Icon name="logout" size={19} color="#C0392B" /> Déconnexion
        </button>
        <div style={{ textAlign: 'center', fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)', margin: '16px 0 8px' }}>
          La Villa · Maison de qualité depuis 2007 · v1.0
        </div>
      </div>
    </div>
  );
}
