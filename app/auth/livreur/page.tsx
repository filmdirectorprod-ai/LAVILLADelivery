'use client';
// Connexion livreur — distincte de l'écran client. Même langue visuelle que
// l'admin : fond turquoise foncé, carte de verre, pilule blanche.
// Identifiant + mot de passe uniquement : les livreurs sont créés par La Villa,
// donc pas d'inscription ni de connexion sociale. En cas de succès, direction
// /driver ; le middleware renvoie ici les accès non connectés à /driver/*.
//
// Correction : le lien du bas proposait « Vous êtes livreur ? Connexion
// livreur » et renvoyait vers CETTE page — un reste de copier-coller de l'écran
// client. Il ramène désormais à l'espace client.
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@/components/ui/Icon';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { loginToEmail } from '@/lib/driver-credentials';
import Image from 'next/image';
import { FormError, Panel, PrimaryAction, fieldStyle, labelStyle, text } from '@/components/driver/ui/DriverUI';

export default function DriverAuthPage() {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createClient>>();
  const getSupabase = () => (supabaseRef.current ??= createClient());

  const [identifiant, setIdentifiant] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!identifiant || !password) {
      setError('Renseignez votre identifiant et votre mot de passe.');
      return;
    }
    setBusy(true);
    try {
      const { error: e } = await getSupabase().auth.signInWithPassword({
        email: loginToEmail(identifiant),
        password,
      });
      if (e) throw e;
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
      className="lv-driver-root"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        padding: `${SAFE_TOP + 28}px 24px ${SAFE_BOTTOM + 24}px`,
      }}
    >
      {/* Marque + rôle */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <Image
          src="/brand/logo-ondark.png"
          alt="La Villa — Maison de Qualité, depuis 2007"
          width={220}
          height={111}
          priority
          style={{ width: 220, height: 'auto', display: 'block' }}
        />
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: 'var(--soft)',
            border: '1px solid var(--a-glass-line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 6,
          }}
        >
          <Icon name="scooter" size={30} color="var(--a-text)" />
        </div>
        <h1 style={{ ...text, fontWeight: 600, fontSize: 24, color: 'var(--a-text)', margin: 0 }}>Espace livreur</h1>
        <p style={{ ...text, fontSize: 14, color: 'var(--a-muted)', margin: 0, textAlign: 'center', lineHeight: 1.5 }}>
          Connectez-vous avec votre compte livreur La Villa.
        </p>
      </div>

      {/* Carte */}
      <Panel style={{ marginTop: 26, padding: '22px 20px' }}>
        <label style={labelStyle} htmlFor="drv-login">
          Identifiant
        </label>
        <input
          id="drv-login"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={identifiant}
          onChange={(e) => setIdentifiant(e.target.value)}
          placeholder="votre identifiant"
          style={fieldStyle}
        />

        <div style={{ marginTop: 16 }}>
          <label style={labelStyle} htmlFor="drv-pass">
            Mot de passe
          </label>
          <input
            id="drv-pass"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="••••••••"
            style={fieldStyle}
          />
        </div>

        {error && <FormError>{error}</FormError>}

        <div style={{ marginTop: 20 }}>
          <PrimaryAction onClick={submit} disabled={busy}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </PrimaryAction>
        </div>
      </Panel>

      {/* Retour à l'espace client */}
      <button
        onClick={() => router.push('/auth')}
        style={{
          ...text,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13.5,
          color: 'var(--a-muted)',
          marginTop: 22,
          textAlign: 'center',
        }}
      >
        Vous êtes client ? <span style={{ color: 'var(--a-text)', fontWeight: 600 }}>Connexion client</span>
      </button>
    </div>
  );
}
