'use client';
// Shared route-level fallbacks: the skeleton Next shows while a Server Component
// page is fetching (loading.tsx) and the recovery screen it shows when one
// throws (error.tsx). Neither existed — a slow query left a blank screen and a
// failed one showed the framework's default error page.
import { SAFE_TOP } from '@/lib/layout';

/** Brand-tinted spinner, centred, for a route that is still fetching. */
export function RouteSkeleton({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        height: '100%',
        minHeight: 240,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: `${SAFE_TOP + 40}px 24px 40px`,
        background: 'var(--soft)',
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 999,
          border: '3px solid rgba(19,124,139,0.18)',
          borderTopColor: 'var(--brand)',
          animation: 'lv-spin 0.8s linear infinite',
        }}
      />
      <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)' }}>{label}</span>
      <style>{'@keyframes lv-spin { to { transform: rotate(360deg) } }'}</style>
    </div>
  );
}

/** Recovery screen for a route that threw. `reset` re-renders the segment. */
export function RouteError({ reset, label }: { reset: () => void; label?: string }) {
  return (
    <div
      style={{
        height: '100%',
        minHeight: 240,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: `${SAFE_TOP + 40}px 24px 40px`,
        textAlign: 'center',
        background: 'var(--soft)',
      }}
    >
      <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>
        {label ?? 'Une erreur est survenue'}
      </div>
      <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', margin: 0, maxWidth: 320 }}>
        La connexion a peut-être été interrompue. Réessayez — vos données sont intactes.
      </p>
      <button
        onClick={reset}
        style={{
          marginTop: 6,
          border: 'none',
          borderRadius: 12,
          padding: '11px 22px',
          cursor: 'pointer',
          fontFamily: 'var(--ui-font)',
          fontWeight: 600,
          fontSize: 14,
          color: '#fff',
          background: 'var(--brand)',
        }}
      >
        Réessayer
      </button>
    </div>
  );
}
