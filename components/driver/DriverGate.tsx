'use client';
// Shown when a signed-in user opens /driver but isn't a registered driver.
// Dead-ends gracefully with a route back to the customer app.
import { useRouter } from 'next/navigation';
import { Btn } from '@/components/ui/Btn';
import { Icon } from '@/components/ui/Icon';
import { SAFE_TOP } from '@/lib/layout';

export function DriverGate() {
  const router = useRouter();
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: `${SAFE_TOP + 20}px 28px`,
        textAlign: 'center',
        background: 'var(--brand-d)',
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: 'rgba(255,255,255,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="scooter" size={34} color="#fff" />
      </div>
      <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 21, color: '#fff', margin: 0 }}>
        Espace livreur
      </h1>
      <p style={{ fontFamily: 'var(--ui-font)', fontSize: 14.5, color: 'rgba(255,255,255,0.78)', margin: 0, lineHeight: 1.5 }}>
        Ce compte n’est pas enregistré comme livreur. Contactez La Villa pour
        activer l’accès livreur.
      </p>
      <Btn variant="gold" onClick={() => router.push('/')} style={{ marginTop: 8 }}>
        Retour à l’application
      </Btn>
    </div>
  );
}
