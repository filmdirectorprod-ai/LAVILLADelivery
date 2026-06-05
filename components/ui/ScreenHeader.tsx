'use client';
// Shared dark top bar for secondary screens (back button + title + optional
// right slot). Matches the prototype's section headers (e.g. LoyaltyScreen).
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { SAFE_TOP } from '@/lib/layout';
import { Icon } from './Icon';

export interface ScreenHeaderProps {
  title: string;
  /** Destination for the back button. Defaults to the profile hub. */
  back?: string;
  right?: ReactNode;
}

export function ScreenHeader({ title, back = '/profile', right }: ScreenHeaderProps) {
  const router = useRouter();
  return (
    <div
      style={{
        padding: `${SAFE_TOP + 4}px 16px 12px`,
        background: 'var(--brand-d)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <button
        onClick={() => router.push(back)}
        aria-label="Retour"
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          border: 'none',
          background: 'rgba(255,255,255,0.16)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name="left" size={20} color="#fff" />
      </button>
      <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 19, color: '#fff', margin: 0, flex: 1 }}>
        {title}
      </h1>
      {right}
    </div>
  );
}
