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
      {/* Un seul défileur : la barre est collante À L'INTÉRIEUR, pour que le
          contenu glisse dessous et que le verre dépoli ait quelque chose à
          flouter — c'est tout l'effet d'une barre de navigation iOS. */}
      <main style={{ flex: 1, minWidth: 0, overflow: 'auto', background: 'var(--a-ground)' }}>
        <header
          className="lv-ios-bar"
          style={{ position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', gap: 16, padding: '10px 20px' }}
        >
          <Image
            src="/brand/logo-ondark.png"
            alt="La Villa — Maison de Qualité, depuis 2007"
            width={104}
            height={53}
            priority
            style={{ width: 104, height: 'auto', display: 'block', flexShrink: 0 }}
          />

          {/* Contrôle segmenté : les sections tiennent sur une ligne et défilent
              latéralement sur un écran étroit. */}
          <nav
            className="lv-ios-segmented"
            style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 2, overflowX: 'auto', scrollbarWidth: 'none' }}
          >
            {ADMIN_NAV.map((item) => {
              const active = isActiveNav(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={active ? 'lv-ios-segment is-active' : 'lv-ios-segment'}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  <Icon name={item.icon} size={15} color={active ? 'var(--a-accent)' : 'var(--a-muted)'} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <NotificationBell />
            <div
              title={`${managerName} · ${agencyLabel}`}
              style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--a-panel-2)', borderRadius: 'var(--a-r-pill)', padding: '5px 5px 5px 12px' }}
            >
              <div style={{ minWidth: 0, textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13, color: 'var(--a-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                  {managerName}
                </div>
                <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11, color: 'var(--a-muted)', whiteSpace: 'nowrap' }}>{agencyLabel}</div>
              </div>
              <button
                onClick={signOut}
                title="Se déconnecter"
                aria-label="Se déconnecter"
                style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 999, border: 'none', background: 'rgba(255, 255, 255, 0.16)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="logout" size={15} color="var(--a-text)" />
              </button>
            </div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
