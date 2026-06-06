'use client';
// Bottom navigation for the driver app — mirrors the customer TabBar styling but
// with the four livreur destinations. Shown only on the top-level driver screens
// (see DriverChrome); hidden on order-detail and settings so those get the full
// height for their own back-button headers.
import { usePathname, useRouter } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SAFE_BOTTOM } from '@/lib/layout';

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: '/driver', label: 'Accueil', icon: 'home' },
  { href: '/driver/history', label: 'Historique', icon: 'clock' },
  { href: '/driver/earnings', label: 'Gains', icon: 'cash' },
  { href: '/driver/profile', label: 'Profil', icon: 'user' },
];

export function DriverTabBar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav
      style={{
        background: '#fff',
        borderTop: '1px solid var(--line)',
        padding: `8px 6px ${SAFE_BOTTOM}px`,
        display: 'flex',
        justifyContent: 'space-around',
        boxShadow: '0 -6px 20px -14px rgba(0,0,0,0.25)',
        flexShrink: 0,
      }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <button
            key={tab.href}
            onClick={() => router.push(tab.href)}
            style={{
              flex: 1,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '2px 0',
            }}
          >
            <Icon name={tab.icon} size={23} color={active ? 'var(--brand)' : 'var(--muted)'} />
            <span
              style={{
                fontFamily: 'var(--ui-font)',
                fontSize: 10.5,
                fontWeight: active ? 700 : 500,
                color: active ? 'var(--brand)' : 'var(--muted)',
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
