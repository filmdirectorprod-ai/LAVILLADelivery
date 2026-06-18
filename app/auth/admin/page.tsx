'use client';
// Admin (gérant) sign-in — a dedicated, full-width two-column screen, distinct from
// the customer (/auth) and driver (/auth/livreur) logins. Left: the login form
// (email/password + Google, since the gérant account is a Gmail). Right: a branded
// La Villa panel. Renders full-width via .lv-admin-root (globals.css lifts the phone
// frame). On success the gérant lands on /admin; middleware routes unauthenticated
// /admin/* here.
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const field: React.CSSProperties = {
  width: '100%',
  border: 'none',
  outline: 'none',
  fontFamily: 'var(--ui-font)',
  fontSize: 15,
  color: 'var(--ink)',
  background: 'transparent',
  padding: '6px 0',
};
const fieldBox: React.CSSProperties = {
  borderLeft: '3px solid var(--brand)',
  background: 'var(--soft)',
  padding: '10px 16px',
  marginTop: 10,
};
const fieldLabel: React.CSSProperties = { fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, color: 'var(--muted)' };

export default function AdminAuthPage() {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createClient>>();
  const getSupabase = () => (supabaseRef.current ??= createClient());

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setInfo(null);
    if (!email || !password) {
      setError('Renseignez votre e-mail et votre mot de passe.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace('/admin');
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
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/admin` },
    });
    if (error) {
      setBusy(false);
      setError(error.message);
    }
  }

  async function forgot() {
    setError(null);
    setInfo(null);
    if (!email) return setError('Saisissez votre e-mail puis cliquez « Mot de passe oublié ».');
    const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/admin`,
    });
    if (error) setError(error.message);
    else setInfo('E-mail de réinitialisation envoyé (vérifiez votre boîte).');
  }

  return (
    <div className="lv-admin-root" style={{ display: 'flex', minHeight: '100dvh', width: '100%', background: '#fff' }}>
      <style>{`@media (max-width: 860px){ .lv-admin-visual { display:none !important; } }`}</style>

      {/* Left — form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 28px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-client.png" alt="La Villa" style={{ width: 180, height: 'auto', display: 'block', marginBottom: 28 }} />

          <h1 className="font-display" style={{ fontSize: 40, fontWeight: 700, color: 'var(--brand)', margin: '0 0 10px', lineHeight: 1.05 }}>
            Espace gérant
          </h1>
          <p style={{ fontFamily: 'var(--ui-font)', fontSize: 14.5, color: 'var(--muted)', margin: '0 0 26px', lineHeight: 1.5 }}>
            Content de vous revoir — connectez-vous à l&apos;administration de La Villa.
          </p>

          <div style={fieldBox}>
            <label style={fieldLabel}>Adresse e-mail</label>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="gerant@lavilla.ma" style={field} />
          </div>
          <div style={fieldBox}>
            <label style={fieldLabel}>Mot de passe</label>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" style={field} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--ink)' }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Se souvenir de moi
            </label>
            <button onClick={forgot} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Mot de passe oublié
            </button>
          </div>

          {error && <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: '#C0392B', fontWeight: 600, marginTop: 16 }}>{error}</div>}
          {info && <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: '#2f9e6f', fontWeight: 600, marginTop: 16 }}>{info}</div>}

          <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
            <button onClick={submit} disabled={busy} style={{ flex: 1, border: 'none', borderRadius: 4, padding: '14px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14, letterSpacing: 1, color: '#fff', background: 'var(--brand-d)', opacity: busy ? 0.6 : 1 }}>
              {busy ? '…' : 'CONNEXION'}
            </button>
            <button onClick={google} disabled={busy} style={{ flex: 1, border: '1.5px solid var(--line)', borderRadius: 4, padding: '14px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14, letterSpacing: 0.5, color: 'var(--ink)', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#4285F4' }}>G</span> Google
            </button>
          </div>

          <button onClick={() => router.push('/auth')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)', marginTop: 22 }}>
            Vous êtes client ou livreur ? <span style={{ color: 'var(--brand)', fontWeight: 600 }}>Autre connexion</span>
          </button>
        </div>
      </div>

      {/* Right — branded visual */}
      <div
        className="lv-admin-visual"
        style={{ flex: 1, background: 'linear-gradient(155deg, var(--brand), var(--brand-d))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 40, position: 'relative', overflow: 'hidden' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.png" alt="La Villa" style={{ width: 'min(360px, 70%)', height: 'auto', display: 'block' }} />
        <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gold)' }}>
          Administration
        </div>
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', maxWidth: 360, lineHeight: 1.6, marginTop: 8 }}>
          Gérez les commandes, la cuisine, les livreurs et les zones — en temps réel.
        </p>
      </div>
    </div>
  );
}
