'use client';
// Affiché quand un compte connecté ouvre /driver sans être livreur. Même fond
// et mêmes cartes de verre que le reste de l'app livreur.
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { SAFE_TOP } from '@/lib/layout';
import { Panel, PrimaryAction, text } from '@/components/driver/ui/DriverUI';

export function DriverGate() {
  const router = useRouter();
  return (
    <div
      className="lv-driver-root"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        padding: `${SAFE_TOP + 20}px 24px`,
        textAlign: 'center',
      }}
    >
      <Panel style={{ padding: '28px 24px', maxWidth: 380 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 22,
            background: 'var(--soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <Icon name="scooter" size={34} color="var(--ink)" />
        </div>
        <h1 style={{ ...text, fontWeight: 600, fontSize: 22, color: 'var(--ink)', margin: 0 }}>Espace livreur</h1>
        <p style={{ ...text, fontSize: 14.5, color: 'var(--muted)', margin: '10px 0 20px', lineHeight: 1.5 }}>
          Ce compte n’est pas enregistré comme livreur. Contactez La Villa pour activer l’accès livreur.
        </p>
        <PrimaryAction onClick={() => router.push('/')}>Retour à l’application</PrimaryAction>
      </Panel>
    </div>
  );
}
