'use client';
// Segmented control (Livraison/Retrait, Pâtisserie/Restaurant).
// Ported verbatim from the prototype (ui.jsx).
import type { CSSProperties, ReactNode } from 'react';

export interface SegmentedOption {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
}

export interface SegmentedProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  style?: CSSProperties;
}

export function Segmented({ options, value, onChange, style = {} }: SegmentedProps) {
  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--soft)',
        borderRadius: 999,
        padding: 4,
        position: 'relative',
        ...style,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              flex: 1,
              padding: '10px 8px',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              background: active ? '#fff' : 'transparent',
              color: active ? 'var(--brand)' : 'var(--muted)',
              fontFamily: 'var(--ui-font)',
              fontSize: 13.5,
              fontWeight: active ? 600 : 500,
              boxShadow: active ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              transition: 'all .18s ease',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
