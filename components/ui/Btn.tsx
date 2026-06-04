'use client';
// Button primitive. Ported verbatim from the prototype (ui.jsx).
import type { CSSProperties, ReactNode } from 'react';

export type BtnVariant = 'primary' | 'gold' | 'outline' | 'ghost';
export type BtnSize = 'sm' | 'md' | 'lg';

export interface BtnProps {
  children?: ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  full?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
  icon?: ReactNode;
}

export function Btn({
  children,
  variant = 'primary',
  size = 'md',
  full = false,
  onClick,
  disabled,
  style = {},
  icon,
}: BtnProps) {
  const pad = size === 'lg' ? '16px 22px' : size === 'sm' ? '9px 14px' : '13px 18px';
  const fs = size === 'lg' ? 16.5 : size === 'sm' ? 13.5 : 15.5;
  const variants: Record<BtnVariant, CSSProperties> = {
    primary: { background: 'var(--brand)', color: '#fff', border: 'none' },
    gold: { background: 'var(--gold)', color: '#fff', border: 'none' },
    outline: { background: 'transparent', color: 'var(--brand)', border: '1.5px solid var(--brand)' },
    ghost: { background: 'var(--soft)', color: 'var(--ink)', border: 'none' },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        ...variants[variant],
        padding: pad,
        fontSize: fs,
        fontWeight: 600,
        fontFamily: 'var(--ui-font)',
        borderRadius: 999,
        width: full ? '100%' : undefined,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'transform .12s ease, filter .15s ease',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        boxShadow: variant === 'primary' ? '0 8px 20px -8px var(--brand)' : 'none',
        ...style,
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.975)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {icon}
      {children}
    </button>
  );
}
