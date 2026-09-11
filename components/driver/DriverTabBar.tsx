'use client';
// Barre d'onglets du bas — verre dépoli sur le fond turquoise foncé, dans la
// langue de l'admin. L'onglet actif est une pilule blanche à texte turquoise
// (le contrôle segmenté iOS de l'admin), pas un simple texte coloré : sur fond
// sombre, la couleur seule ne suffisait pas à marquer l'état.
import { usePathname, useRouter } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SAFE_BOTTOM } from '@/lib/layout';

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: '/driver', label: 'Accueil', icon: 'home' },
  { href: '/driver/requests', label: 'Demandes', icon: 'bell' },
  { href: '/driver/earnings', label: 'Tournée', icon: 'cash' },
  { href: '/driver/history', label: 'Historique', icon: 'clock' },
  { href: '/driver/profile', label: 'Profil', icon: 'user' },
];

export function DriverTabBar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav
      className="lv-driver-tabbar"
      style={{
        padding: `8px 8px ${SAFE_BOTTOM + 6}px`,
        display: 'flex',
        justifyContent: 'space-around',
        gap: 4,
        flexShrink: 0,
      }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <button
            key={tab.href}
            onClick={() => router.push(tab.href)}
            aria-current={active ? 'page' : undefined}
            style={{
              flex: 1,
              minHeight: 52,
              border: 'none',
              borderRadius: 16,
              background: active ? '#ffffff' : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: '6px 2px',
              transition: 'background-color 0.2s ease',
            }}
          >
            <Icon name={tab.icon} size={21} color={active ? 'var(--a-on-white)' : 'var(--a-muted)'} />
            <span
              style={{
                fontFamily: 'var(--ui-font)',
                fontSize: 10.5,
                fontWeight: 600,
                color: active ? 'var(--a-on-white)' : 'var(--a-muted)',
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
