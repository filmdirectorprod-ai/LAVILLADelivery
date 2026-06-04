'use client';
// Bottom tab bar. Ported verbatim from the prototype (ui.jsx).
import { Icon } from './ui/Icon';

export type TabId = 'home' | 'search' | 'cart' | 'orders' | 'profile';

export interface TabBarProps {
  active: TabId;
  onNav: (id: TabId) => void;
  cartCount?: number;
  safeBottom?: number;
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'home', label: 'Accueil', icon: 'home' },
  { id: 'search', label: 'Recherche', icon: 'search' },
  { id: 'cart', label: 'Panier', icon: 'bag' },
  { id: 'orders', label: 'Commandes', icon: 'receipt' },
  { id: 'profile', label: 'Profil', icon: 'user' },
];

export function TabBar({ active, onNav, cartCount = 0, safeBottom = 12 }: TabBarProps) {
  return (
    <div
      style={{
        flexShrink: 0,
        background: '#fff',
        borderTop: '1px solid var(--line)',
        padding: `8px 6px ${safeBottom}px`,
        display: 'flex',
        justifyContent: 'space-around',
        boxShadow: '0 -6px 20px -14px rgba(0,0,0,0.25)',
      }}
    >
      {TABS.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onNav(t.id)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              position: 'relative',
            }}
          >
            <div style={{ position: 'relative' }}>
              <Icon
                name={t.icon}
                size={23}
                color={on ? 'var(--brand)' : 'var(--muted)'}
                fill={on && (t.id === 'home' || t.id === 'search') ? false : on}
                strokeWidth={on ? 2 : 1.8}
              />
              {t.id === 'cart' && cartCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -9,
                    minWidth: 17,
                    height: 17,
                    padding: '0 4px',
                    borderRadius: 999,
                    background: 'var(--gold)',
                    color: '#fff',
                    fontSize: 10.5,
                    fontWeight: 700,
                    fontFamily: 'var(--ui-font)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1.5px solid #fff',
                  }}
                >
                  {cartCount}
                </span>
              )}
            </div>
            <span
              style={{
                fontFamily: 'var(--ui-font)',
                fontSize: 10.5,
                fontWeight: on ? 600 : 500,
                color: on ? 'var(--brand)' : 'var(--muted)',
              }}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
