'use client';
// Quantity stepper. Ported verbatim from the prototype (ui.jsx).
import type { ReactNode } from 'react';
import { Icon } from './Icon';

export interface StepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  size?: 'sm' | 'md';
}

export function Stepper({ value, onChange, min = 1, size = 'md' }: StepperProps) {
  const d = size === 'sm' ? 28 : 34;
  const btn = (icon: ReactNode, fn: () => void) => (
    <button
      onClick={fn}
      style={{
        width: d,
        height: d,
        borderRadius: 999,
        border: '1.5px solid var(--line)',
        background: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--brand)',
      }}
    >
      {icon}
    </button>
  );
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
      {btn(<Icon name="minus" size={16} color="var(--brand)" />, () =>
        onChange(Math.max(min, value - 1)),
      )}
      <span
        style={{
          fontFamily: 'var(--ui-font)',
          fontWeight: 600,
          fontSize: 15,
          minWidth: 16,
          textAlign: 'center',
        }}
      >
        {value}
      </span>
      {btn(<Icon name="plus" size={16} color="var(--brand)" />, () => onChange(value + 1))}
    </div>
  );
}
