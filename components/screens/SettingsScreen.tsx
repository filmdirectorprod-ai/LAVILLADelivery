'use client';
// PARAMÈTRES — notification preferences (persisted to profiles.settings),
// language (display only for now), help shortcut, sign-out, and account info.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Profile, ProfileSettings } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/lib/toast-store';
import { SAFE_BOTTOM } from '@/lib/layout';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Icon } from '@/components/ui/Icon';

const SUPPORT_EMAIL = 'contact@lavilla.ma';

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      style={{
        width: 44,
        height: 26,
        borderRadius: 999,
        background: on ? 'var(--brand)' : 'var(--line)',
        position: 'relative',
        transition: 'background .2s ease',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: 999,
          background: '#fff',
          transition: 'left .2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        }}
      />
    </span>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 13,
  width: '100%',
  padding: '14px 15px',
  background: '#fff',
  border: 'none',
  textAlign: 'left',
  cursor: 'pointer',
};
const iconBox: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 9,
  background: 'var(--soft)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid var(--line)',
  borderRadius: 16,
  overflow: 'hidden',
};
const sectionLabel: React.CSSProperties = {
  fontFamily: 'var(--ui-font)',
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  margin: '20px 4px 8px',
};

export interface SettingsScreenProps {
  profile: Profile | null;
}

export function SettingsScreen({ profile }: SettingsScreenProps) {
  const router = useRouter();
  const toast = useToast((s) => s.show);

  const initial = profile?.settings ?? {};
  const [settings, setSettings] = useState<ProfileSettings>({
    notify_orders: initial.notify_orders ?? true,
    notify_promos: initial.notify_promos ?? true,
  });
  const [busy, setBusy] = useState(false);

  async function toggle(key: 'notify_orders' | 'notify_promos') {
    if (busy) return;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next); // optimistic
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from('profiles').update({ settings: next }).eq('id', user.id);
      if (error) {
        setSettings(settings); // revert
        toast('Échec de l’enregistrement');
      }
    }
    setBusy(false);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth');
    router.refresh();
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ScreenHeader title="Paramètres" />
      <div style={{ flex: 1, overflow: 'auto', padding: `8px 18px ${SAFE_BOTTOM + 24}px` }}>
        <div style={sectionLabel}>Notifications</div>
        <div style={cardStyle}>
          <button style={rowStyle} onClick={() => toggle('notify_orders')}>
            <div style={iconBox}>
              <Icon name="bell" size={18} color="var(--brand)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 14.5, fontWeight: 500, color: 'var(--ink)' }}>Suivi de commande</div>
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>Statut de préparation et de livraison</div>
            </div>
            <Toggle on={!!settings.notify_orders} />
          </button>
          <div style={{ height: 1, background: 'var(--line)' }} />
          <button style={rowStyle} onClick={() => toggle('notify_promos')}>
            <div style={iconBox}>
              <Icon name="percent" size={18} color="var(--brand)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 14.5, fontWeight: 500, color: 'var(--ink)' }}>Offres & nouveautés</div>
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>Promotions et éditions limitées</div>
            </div>
            <Toggle on={!!settings.notify_promos} />
          </button>
        </div>

        <div style={sectionLabel}>Préférences</div>
        <div style={cardStyle}>
          <div style={{ ...rowStyle, cursor: 'default' }}>
            <div style={iconBox}>
              <Icon name="info" size={18} color="var(--brand)" />
            </div>
            <div style={{ flex: 1, fontFamily: 'var(--ui-font)', fontSize: 14.5, fontWeight: 500, color: 'var(--ink)' }}>Langue</div>
            <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>Français</span>
          </div>
          <div style={{ height: 1, background: 'var(--line)' }} />
          <button style={rowStyle} onClick={() => router.push('/profile/help')}>
            <div style={iconBox}>
              <Icon name="message" size={18} color="var(--brand)" />
            </div>
            <span style={{ flex: 1, fontFamily: 'var(--ui-font)', fontSize: 14.5, fontWeight: 500, color: 'var(--ink)' }}>Aide / Support</span>
            <Icon name="right" size={18} color="var(--muted)" />
          </button>
        </div>

        <div style={sectionLabel}>Compte</div>
        <div style={cardStyle}>
          <button style={rowStyle} onClick={() => router.push('/profile/edit')}>
            <div style={iconBox}>
              <Icon name="user" size={18} color="var(--brand)" />
            </div>
            <span style={{ flex: 1, fontFamily: 'var(--ui-font)', fontSize: 14.5, fontWeight: 500, color: 'var(--ink)' }}>Modifier le profil</span>
            <Icon name="right" size={18} color="var(--muted)" />
          </button>
          <div style={{ height: 1, background: 'var(--line)' }} />
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Suppression de mon compte La Villa')}`}
            style={{ ...rowStyle, textDecoration: 'none' }}
          >
            <div style={iconBox}>
              <Icon name="x" size={18} color="#C0392B" />
            </div>
            <span style={{ flex: 1, fontFamily: 'var(--ui-font)', fontSize: 14.5, fontWeight: 500, color: '#C0392B' }}>Supprimer mon compte</span>
            <Icon name="right" size={18} color="var(--muted)" />
          </a>
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
            marginTop: 18,
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

        <div style={{ textAlign: 'center', fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)', margin: '18px 0 8px' }}>
          La Villa · Maison de qualité depuis 2007 · v1.0
        </div>
      </div>
    </div>
  );
}
