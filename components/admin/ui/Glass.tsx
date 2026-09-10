// components/admin/ui/Glass.tsx
// Building blocks shared by the enriched admin pages, in the language of the
// Vue d'ensemble: glass panels on the dark ground, well sub-panels, filter chips,
// white primary pills, outlined ghost buttons, a switch and a usage meter.
// Colours come from the admin tokens only — the ink tokens are white inside the
// admin, so everything here reads on the dark cards.
'use client';
import type { CSSProperties, ReactNode } from 'react';

export function GlassPanel({ children, style, padding = 22 }: { children: ReactNode; style?: CSSProperties; padding?: number | string }) {
  return (
    <section
      style={{
        background: 'var(--a-card)',
        border: '1px solid var(--a-glass-line)',
        borderRadius: 26,
        padding,
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function SubPanel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ background: 'var(--soft)', borderRadius: 20, padding: 18, minWidth: 0, ...style }}>{children}</div>;
}

export function PanelTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
      <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 15, color: 'var(--ink)', margin: 0 }}>{children}</h2>
      {aside != null && <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)' }}>{aside}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 44, lineHeight: 1.05, letterSpacing: '-0.025em', color: 'var(--a-text)', margin: 0 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--a-muted)', margin: '10px 0 0', maxWidth: 640 }}>{subtitle}</p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

export function Chip({ on, onClick, children, count, title }: { on: boolean; onClick: () => void; children: ReactNode; count?: number; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '8px 14px',
        borderRadius: 999,
        border: on ? '1px solid #ffffff' : '1px solid var(--a-glass-line)',
        background: on ? '#ffffff' : 'transparent',
        color: on ? 'var(--a-on-white)' : 'var(--ink)',
        fontFamily: 'var(--ui-font)',
        fontSize: 13,
        fontWeight: on ? 600 : 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background-color 0.2s ease, color 0.2s ease',
      }}
    >
      {children}
      {count != null && <span style={{ fontSize: 11.5, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{count}</span>}
    </button>
  );
}

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  style?: CSSProperties;
  type?: 'button' | 'submit';
  'aria-label'?: string;
};

/** The one filled action of a section: a white pill with turquoise text. */
export function PrimaryButton({ children, onClick, disabled, title, style, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={rest['aria-label']}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        border: 'none',
        borderRadius: 999,
        padding: '10px 18px',
        background: '#ffffff',
        color: 'var(--a-on-white)',
        fontFamily: 'var(--ui-font)',
        fontSize: 13.5,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Secondary actions: an outlined glass pill. */
export function GhostButton({ children, onClick, disabled, title, style, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={rest['aria-label']}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        border: '1px solid var(--a-glass-line)',
        borderRadius: 999,
        padding: '8px 14px',
        background: 'transparent',
        color: 'var(--ink)',
        fontFamily: 'var(--ui-font)',
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** On/off switch. Gold track when on: the gold carries no text here, only the
 *  state, which is the role the strict palette leaves it. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: 42,
        height: 24,
        flexShrink: 0,
        border: 'none',
        borderRadius: 999,
        padding: 0,
        background: checked ? 'var(--a-accent)' : 'rgba(255, 255, 255, 0.18)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'background-color 0.2s ease',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          width: 18,
          height: 18,
          borderRadius: 999,
          background: '#ffffff',
          transition: 'left 0.2s ease',
        }}
      />
    </button>
  );
}

/** Thin quota gauge; turns gold once full. */
export function Meter({ ratio, label }: { ratio: number; label: string }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} style={{ height: 6, borderRadius: 999, background: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: pct >= 100 ? 'var(--a-accent)' : '#ffffff', transition: 'width 0.3s ease' }} />
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ padding: '30px 16px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--ui-font)', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
      {hint && <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

/** Shared form field look for the dark cards. */
export const fieldStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'var(--ui-font)',
  fontSize: 14,
  padding: '10px 12px',
  border: '1px solid var(--a-glass-line)',
  borderRadius: 12,
  background: 'rgba(255, 255, 255, 0.06)',
  color: 'var(--ink)',
  outline: 'none',
};

export const labelStyle: CSSProperties = {
  display: 'block',
  fontFamily: 'var(--ui-font)',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--muted)',
  marginBottom: 6,
};
