'use client';
// Section header with optional action. Ported verbatim (ui.jsx).
import type { ReactNode } from 'react';

export interface SectionHeadProps {
  title: ReactNode;
  action?: ReactNode;
  onAction?: () => void;
}

export function SectionHead({ title, action, onAction }: SectionHeadProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        padding: '0 2px',
      }}
    >
      <h3
        style={{
          margin: 0,
          fontFamily: 'var(--ui-font)',
          fontWeight: 600,
          fontSize: 17,
          color: 'var(--ink)',
        }}
      >
        {title}
      </h3>
      {action && (
        <button
          onClick={onAction}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--ui-font)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--brand)',
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}
