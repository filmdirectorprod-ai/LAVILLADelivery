// Shown when a signed-in non-staff user hits /admin. Friendly dead-end, no nav.
// Rendered outside AdminChrome, so it carries .lv-admin-root itself to get the
// admin ground and ink tokens.
import Link from 'next/link';
import { GlassPanel } from '@/components/admin/ui/Glass';

export function AdminGate() {
  return (
    <div
      className="lv-admin-root"
      style={{
        minHeight: '100dvh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        boxSizing: 'border-box',
        background: 'var(--a-ground)',
      }}
    >
      <GlassPanel padding="32px 28px" style={{ maxWidth: 420, textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 24, letterSpacing: '-0.01em', color: 'var(--ink)', margin: 0 }}>Accès réservé</h1>
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--muted)', margin: '10px 0 22px', lineHeight: 1.5 }}>
          Cet espace est réservé à l’administration de La Villa.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            fontFamily: 'var(--ui-font)',
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--a-on-white)',
            background: '#ffffff',
            borderRadius: 999,
            padding: '11px 22px',
            textDecoration: 'none',
          }}
        >
          Retour à l’application
        </Link>
      </GlassPanel>
    </div>
  );
}
