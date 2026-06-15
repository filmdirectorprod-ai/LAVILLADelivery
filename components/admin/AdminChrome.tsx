'use client';
// Desktop admin shell: fixed left sidebar (brand-d) with the section nav and the
// manager identity, plus a scrollable content area. Marker class .lv-admin-root
// tells globals.css to drop the phone-frame sizing.
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ADMIN_NAV, isActiveNav } from '@/lib/admin-nav';
import { Icon } from '@/components/ui/Icon';
import { NotificationBell } from '@/components/admin/NotificationBell';

export function AdminChrome({ children, managerName }: { children: ReactNode; managerName: string }) {
  const pathname = usePathname();
  return (
    <div className="lv-admin-root" style={{ display: 'flex', height: '100dvh', width: '100%' }}>
      <aside
        style={{
          width: 260,
          flexShrink: 0,
          background: 'var(--brand-d)',
          display: 'flex',
          flexDirection: 'column',
          padding: '22px 14px',
          overflow: 'auto',
        }}
      >
        <div style={{ padding: '0 10px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 2px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo.png"
              alt="La Villa — Maison de Qualité, depuis 2007"
              style={{ width: '100%', maxWidth: 190, height: 'auto', display: 'block' }}
            />
          </div>
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11, letterSpacing: 1.5, color: 'var(--gold)', fontWeight: 600, marginTop: 10, textAlign: 'center' }}>
            ADMINISTRATION
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {ADMIN_NAV.map((item) => {
            const active = isActiveNav(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 12px',
                  borderRadius: 12,
                  textDecoration: 'none',
                  fontFamily: 'var(--ui-font)',
                  fontSize: 14.5,
                  fontWeight: 600,
                  color: active ? 'var(--brand-d)' : 'rgba(255,255,255,0.85)',
                  background: active ? '#fff' : 'transparent',
                }}
              >
                <Icon name={item.icon} size={19} color={active ? 'var(--brand)' : 'rgba(255,255,255,0.85)'} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 10px 0', borderTop: '1px solid rgba(255,255,255,0.12)', marginTop: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 999, background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="user" size={18} color="#fff" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13.5, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {managerName}
            </div>
            <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>Gérant</div>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, overflow: 'auto', background: 'var(--soft)' }}>
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            padding: '12px 32px',
            background: 'rgba(246,247,247,0.92)',
            backdropFilter: 'blur(6px)',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <NotificationBell />
        </div>
        {children}
      </main>
    </div>
  );
}
