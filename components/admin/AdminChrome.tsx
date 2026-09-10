'use client';
// Desktop admin shell: fixed left sidebar with the section nav and the manager
// identity, plus a scrollable content area on a dark ground. The screens' own
// white cards then read as the lit surfaces, the way a control room does — the
// data is what glows. Marker class .lv-admin-root drops the phone-frame sizing
// and carries the dark tokens (see globals.css).
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ADMIN_NAV, isActiveNav } from '@/lib/admin-nav';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@/components/ui/Icon';
import { NotificationBell } from '@/components/admin/NotificationBell';
import Image from 'next/image';

export function AdminChrome({ children, managerName, agencyLabel = 'Gérant' }: { children: ReactNode; managerName: string; agencyLabel?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace('/auth/admin');
  }
  return (
    <div className="lv-admin-root" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', width: '100%' }}>
      {/* ── Barre supérieure ──────────────────────────────────────────────
          Navigation en pilules plutôt qu'en colonne : les sections tiennent sur
          une ligne, et toute la largeur revient aux données — ce que fait le
          modèle. La barre défile horizontalement sur un écran étroit. */}
      <header
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 20px',
          background: 'var(--a-panel)',
          borderBottom: '1px solid var(--a-line)',
        }}
      >
        <Image
          src="/brand/logo-ondark.png"
          alt="La Villa — Maison de Qualité, depuis 2007"
          width={116}
          height={59}
          priority
          style={{ width: 116, height: 'auto', display: 'block', flexShrink: 0 }}
        />

        <nav
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: 5,
            background: 'var(--a-ground)',
            borderRadius: 'var(--a-r-pill)',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {ADMIN_NAV.map((item) => {
            const active = isActiveNav(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 14px',
                  borderRadius: 'var(--a-r-pill)',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--ui-font)',
                  fontSize: 13.5,
                  fontWeight: active ? 700 : 500,
                  // Une seule pilule verte : la section ouverte. Le reste
                  // s'efface, comme dans le modèle.
                  color: active ? 'var(--a-accent-ink)' : 'var(--a-muted)',
                  background: active ? 'var(--a-accent)' : 'transparent',
                  flexShrink: 0,
                }}
              >
                <Icon name={item.icon} size={17} color={active ? 'var(--a-accent-ink)' : 'var(--a-muted)'} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <NotificationBell />
          <div
            title={`${managerName} · ${agencyLabel}`}
            style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--a-ground)', borderRadius: 'var(--a-r-pill)', padding: '6px 6px 6px 12px' }}
          >
            <div style={{ minWidth: 0, textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 12.5, color: 'var(--a-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                {managerName}
              </div>
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 10.5, color: 'var(--a-muted)', whiteSpace: 'nowrap' }}>{agencyLabel}</div>
            </div>
            <button
              onClick={signOut}
              title="Se déconnecter"
              aria-label="Se déconnecter"
              style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 999, border: 'none', background: 'var(--a-panel-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="logout" size={16} color="var(--a-muted)" />
            </button>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, minWidth: 0, overflow: 'auto', background: 'var(--a-ground)' }}>{children}</main>
    </div>
  );
}
