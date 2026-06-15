'use client';
// Driver sign-in — distinct from the customer /auth screen. Dark teal + gold
// "Espace livreur" theme, email/password only (drivers are provisioned by La
// Villa, so no self sign-up and no social login). On success the driver lands
// on /driver. Unauthenticated hits to /driver/* are routed here by middleware.
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Btn } from '@/components/ui/Btn';
import { Icon } from '@/components/ui/Icon';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';

const fieldWrap: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  border: '1.5px solid var(--line)',
  borderRadius: 14,
  padding: '13px 14px',
  marginTop: 7,
  background: '#fff',
};
const fieldStyle: React.CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  fontFamily: 'var(--ui-font)',
  fontSize: 15,
  color: 'var(--ink)',
  background: 'transparent',
};
const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--ui-font)',
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--muted)',
};

export default function DriverAuthPage() {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createClient>>();
  const getSupabase = () => (supabaseRef.current ??= createClient());

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!email || !password) {
      setError('Renseignez votre e-mail et votre mot de passe.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace('/driver');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la connexion.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--brand-d)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        padding: `${SAFE_TOP + 28}px 24px ${SAFE_BOTTOM + 24}px`,
      }}
    >
      {/* Brand + role header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: '10px 14px', boxShadow: '0 8px 22px -12px rgba(0,0,0,0.6)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo.png"
            alt="La Villa — Maison de Qualité, depuis 2007"
            style={{ width: 150, height: 'auto', display: 'block' }}
          />
        </div>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: 'rgba(168,151,35,0.20)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 6,
          }}
        >
          <Icon name="scooter" size={30} color="var(--gold)" />
        </div>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 23, color: '#fff', margin: 0 }}>
          Espace livreur
        </h1>
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 14, color: 'rgba(255,255,255,0.72)', margin: 0, textAlign: 'center', lineHeight: 1.5 }}>
          Connectez-vous avec votre compte livreur La Villa.
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          background: '#fff',
          borderRadius: 22,
          padding: '22px 20px',
          marginTop: 26,
          boxShadow: '0 20px 50px -24px rgba(0,0,0,0.55)',
        }}
      >
        <label style={labelStyle}>E-mail</label>
        <div style={fieldWrap}>
          <Icon name="user" size={17} color="var(--muted)" />
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="livreur@lavilla.ma"
            style={fieldStyle}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={labelStyle}>Mot de passe</label>
          <div style={fieldWrap}>
            <Icon name="settings" size={17} color="var(--muted)" />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={fieldStyle}
            />
          </div>
        </div>

        {error && (
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: '#C0392B', fontWeight: 600, marginTop: 12 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <Btn full size="lg" variant="gold" onClick={submit} disabled={busy}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </Btn>
        </div>
      </div>

      {/* Footer: link back to the customer app */}
      <button
        onClick={() => router.push('/auth')}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--ui-font)',
          fontSize: 13.5,
          color: 'rgba(255,255,255,0.8)',
          marginTop: 22,
          textAlign: 'center',
        }}
      >
        Vous êtes client ?{' '}
        <span style={{ color: 'var(--gold)', fontWeight: 700 }}>Connexion client</span>
      </button>
    </div>
  );
}
