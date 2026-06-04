// Premium / diet badge. Ported verbatim from the prototype (ui.jsx).
import type { CSSProperties, ReactNode } from 'react';

export interface BadgeProps {
  children?: ReactNode;
  gold?: boolean;
  style?: CSSProperties;
}

export function Badge({ children, gold = false, style = {} }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 9px',
        borderRadius: 999,
        fontFamily: 'var(--ui-font)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.2,
        background: gold ? 'rgba(168,151,35,0.12)' : 'var(--soft)',
        color: gold ? 'var(--gold)' : 'var(--muted)',
        border: gold ? '1px solid rgba(168,151,35,0.3)' : '1px solid var(--line)',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
