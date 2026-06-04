'use client';
// Shared shell for the in-app (authenticated) screens. Replaces the prototype's
// AppInstance chrome (app.jsx): a scroll container, a floating cart button on
// browse routes, and the bottom TabBar on the five tab routes. Route group only
// — it does not affect URLs.
import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useCart, cartCount, cartSubtotal } from '@/lib/cart-store';
import { formatDH } from '@/lib/format';
import { SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { TabBar, type TabId } from '@/components/TabBar';

const TAB_ROUTES: Record<string, TabId> = {
  '/': 'home',
  '/search': 'search',
  '/cart': 'cart',
  '/orders': 'orders',
  '/profile': 'profile',
};

/** Routes that show the floating cart pill (browse surfaces). */
const FLOAT_ROUTES = new Set(['/', '/search', '/ramadan']);

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const items = useCart((s) => s.items);
  const count = cartCount(items);

  const activeTab = TAB_ROUTES[pathname];
  const showTab = activeTab !== undefined;
  const showFloat = FLOAT_ROUTES.has(pathname) && count > 0;
  const isHome = pathname === '/';

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          position: 'relative',
          background: isHome ? 'var(--soft)' : '#fff',
        }}
      >
        {children}
      </div>

      {showFloat && (
        <button
          onClick={() => router.push('/cart')}
          style={{
            position: 'absolute',
            right: 16,
            bottom: showTab ? 78 : SAFE_BOTTOM + 14,
            zIndex: 30,
            height: 52,
            padding: '0 18px 0 16px',
            borderRadius: 999,
            background: 'var(--brand)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 12px 28px -8px var(--brand)',
          }}
        >
          <div style={{ position: 'relative' }}>
            <Icon name="bag" size={22} color="#fff" />
            <span
              style={{
                position: 'absolute',
                top: -7,
                right: -9,
                minWidth: 17,
                height: 17,
                padding: '0 3px',
                borderRadius: 999,
                background: 'var(--gold)',
                color: '#fff',
                fontSize: 10.5,
                fontWeight: 700,
                fontFamily: 'var(--ui-font)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid var(--brand)',
              }}
            >
              {count}
            </span>
          </div>
          <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14.5, color: '#fff' }}>
            {formatDH(cartSubtotal(items))}
          </span>
        </button>
      )}

      {showTab && (
        <TabBar
          active={activeTab}
          onNav={(t) => router.push(t === 'home' ? '/' : `/${t}`)}
          cartCount={count}
          safeBottom={SAFE_BOTTOM}
        />
      )}
    </div>
  );
}
