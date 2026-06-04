'use client';
// Authentication — real Supabase email/password + Google OAuth.
// Visual layout ported from the prototype (screens-home.jsx); the mock
// phone-OTP flow is replaced by real auth. Apple stays a visual mock.
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/lib/toast-store';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import { Btn } from '@/components/ui/Btn';
import { Icon } from '@/components/ui/Icon';
import { SAFE_TOP } from '@/lib/layout';

type Mode = 'signin' | 'signup';

const fieldStyle: React.CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  fontFamily: 'var(--ui-font)',
  fontSize: 15,
  color: 'var(--ink)',
  background: 'transparent',
};
const fieldWrap: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  border: '1.5px solid var(--line)',
  borderRadius: 14,
  padding: '13px 14px',
  marginTop: 7,
};
const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--ui-font)',
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--muted)',
};

export default function AuthPage() {
  const router = useRouter();
  // Lazily create the browser client only on first use (in a handler) so static
  // prerender never instantiates it (which would require env vars at build time).
  const supabaseRef = useRef<ReturnType<typeof createClient>>();
  const getSupabase = () => (supabaseRef.current ??= createClient());
  const toast = useToast((s) => s.show);

  const [mode, setMode] = useState<Mode>('signin');
  const [fullName, setFullName] = useState('');
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
      if (mode === 'signup') {
        const { error } = await getSupabase().auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        toast('Compte créé — bienvenue !');
      } else {
        const { error } = await getSupabase().auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.replace('/');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la connexion.');
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setBusy(false);
      setError(error.message);
    }
  }

  const social = (label: string, icon: React.ReactNode, dark: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '13px',
        borderRadius: 14,
        cursor: busy ? 'default' : 'pointer',
        fontFamily: 'var(--ui-font)',
        fontWeight: 600,
        fontSize: 14,
        background: dark ? '#111' : '#fff',
        color: dark ? '#fff' : 'var(--ink)',
        border: dark ? 'none' : '1.5px solid var(--line)',
      }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
      }}
    >
      <PhotoSlot label="Pâtisserie signature La Villa" style={{ height: '38%' }} />
      <button
        onClick={() => router.push('/onboarding')}
        style={{
          position: 'absolute',
          top: SAFE_TOP + 4,
          left: 16,
          width: 40,
          height: 40,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.9)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        }}
      >
        <Icon name="left" size={20} color="var(--ink)" />
      </button>

      <div
        style={{
          flex: 1,
          padding: '26px 24px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
        }}
      >
        <div className="font-display" style={{ fontSize: 28, fontWeight: 700, color: 'var(--brand)' }}>
          La Villa
        </div>
        <div
          style={{
            fontFamily: 'var(--ui-font)',
            fontSize: 12,
            color: 'var(--gold)',
            fontWeight: 600,
            letterSpacing: 1,
            marginTop: 2,
          }}
        >
          MAISON DE QUALITÉ · DEPUIS 2007
        </div>

        <h2
          style={{
            fontFamily: 'var(--ui-font)',
            fontWeight: 600,
            fontSize: 21,
            margin: '26px 0 6px',
            color: 'var(--ink)',
          }}
        >
          {mode === 'signin' ? 'Bienvenue' : 'Créer un compte'}
        </h2>
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--muted)', margin: '0 0 22px' }}>
          {mode === 'signin'
            ? 'Connectez-vous pour commander en quelques secondes.'
            : 'Rejoignez La Villa et cumulez des points à chaque commande.'}
        </p>

        {mode === 'signup' && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Nom complet</label>
            <div style={fieldWrap}>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Sofia El Amrani"
                style={fieldStyle}
              />
            </div>
          </div>
        )}

        <label style={labelStyle}>E-mail</label>
        <div style={fieldWrap}>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
            style={fieldStyle}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={labelStyle}>Mot de passe</label>
          <div style={fieldWrap}>
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={fieldStyle}
            />
          </div>
        </div>

        {error && (
          <div
            style={{
              fontFamily: 'var(--ui-font)',
              fontSize: 12.5,
              color: '#C0392B',
              fontWeight: 600,
              marginTop: 12,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <Btn full size="lg" onClick={submit} disabled={busy}>
            {mode === 'signin' ? 'Se connecter' : "S'inscrire"}
          </Btn>
        </div>

        <button
          onClick={() => {
            setError(null);
            setMode(mode === 'signin' ? 'signup' : 'signin');
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--ui-font)',
            fontSize: 13.5,
            color: 'var(--muted)',
            marginTop: 16,
            textAlign: 'center',
          }}
        >
          {mode === 'signin' ? (
            <>
              Pas encore de compte ?{' '}
              <span style={{ color: 'var(--brand)', fontWeight: 600 }}>Inscrivez-vous</span>
            </>
          ) : (
            <>
              Déjà membre ?{' '}
              <span style={{ color: 'var(--brand)', fontWeight: 600 }}>Connectez-vous</span>
            </>
          )}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)' }}>
            ou continuer avec
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {social(
            'Google',
            <span style={{ fontWeight: 800, fontSize: 16, color: '#4285F4' }}>G</span>,
            false,
            google,
          )}
          {social('Apple', <Icon name="apple" size={18} color="#fff" fill />, true, () =>
            toast('Apple — bientôt disponible'),
          )}
        </div>
      </div>
    </div>
  );
}
