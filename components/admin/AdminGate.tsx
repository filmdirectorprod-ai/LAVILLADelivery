// Shown when a signed-in non-staff user hits /admin. Friendly dead-end, no nav.
import Link from 'next/link';

export function AdminGate() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--soft)',
      }}
    >
      <div
        style={{
          background: '#fff',
          border: '1px solid var(--line)',
          borderRadius: 18,
          boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)',
          padding: '28px 24px',
          maxWidth: 420,
          textAlign: 'center',
        }}
      >
        <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 18, color: 'var(--ink)' }}>
          Accès réservé
        </div>
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', margin: '8px 0 18px' }}>
          Cet espace est réservé à l’administration de La Villa.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            fontFamily: 'var(--ui-font)',
            fontWeight: 600,
            fontSize: 14,
            color: '#fff',
            background: 'var(--brand)',
            borderRadius: 999,
            padding: '11px 22px',
            textDecoration: 'none',
          }}
        >
          Retour à l’application
        </Link>
      </div>
    </div>
  );
}
