'use client';
// Category pill. Ported verbatim from the prototype (ui.jsx).
import type { CSSProperties, ReactNode } from 'react';

export interface ChipProps {
  children?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

export function Chip({ children, active, onClick, style = {} }: ChipProps) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '9px 16px',
        borderRadius: 999,
        cursor: 'pointer',
        fontFamily: 'var(--ui-font)',
        fontSize: 13.5,
        fontWeight: active ? 600 : 500,
        background: active ? 'var(--brand)' : '#fff',
        color: active ? '#fff' : 'var(--ink)',
        border: active ? '1.5px solid var(--brand)' : '1.5px solid var(--line)',
        transition: 'all .15s ease',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
