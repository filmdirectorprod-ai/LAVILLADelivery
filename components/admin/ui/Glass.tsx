// components/admin/ui/Glass.tsx
// Building blocks shared by the enriched admin pages, in the language of the
// Vue d'ensemble: glass panels on the dark ground, well sub-panels, filter chips,
// white primary pills, outlined ghost buttons, a switch and a usage meter.
// Colours come from the admin tokens only — the ink tokens are white inside the
// admin, so everything here reads on the dark cards.
'use client';
import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';

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

export type PillTone = 'solid' | 'outline' | 'accent' | 'muted';

const PILL_TONE: Record<PillTone, CSSProperties> = {
  solid: { background: '#ffffff', color: 'var(--a-on-white)', border: '1px solid #ffffff' },
  outline: { background: 'transparent', color: 'var(--ink)', border: '1px solid var(--a-glass-line)' },
  accent: { background: 'transparent', color: 'var(--a-accent)', border: '1px solid var(--a-accent)' },
  muted: { background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)' },
};

/** Small state label. White = live / needs a driver, gold = needs a look,
 *  outline = in progress, muted = finished. */
export function Pill({ children, tone = 'outline', title }: { children: ReactNode; tone?: PillTone; title?: string }) {
  return (
    <span
      title={title}
      style={{
        ...PILL_TONE[tone],
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--ui-font)',
        fontSize: 11.5,
        fontWeight: 600,
        padding: '3px 10px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

/** Order status → pill tone, in the admin palette. Le pendant sur fond clair est
 *  orderStatusPill (lib/order-status) : même vocabulaire, même palette stricte,
 *  seul le support change. */
export function orderStatusTone(status: string): PillTone {
  switch (status) {
    case 'pending':
      return 'accent';
    case 'ready':
      return 'solid';
    case 'preparing':
    case 'en_route':
      return 'outline';
    default:
      return 'muted';
  }
}

/** Rounded square holding an icon, for card headers. */
export function IconTile({ name, size = 40 }: { name: IconName; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.32, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon name={name} size={Math.round(size * 0.45)} color="var(--ink)" />
    </div>
  );
}

/** "Temps réel" badge for live screens. */
export function LiveBadge() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--a-text)', border: '1px solid var(--a-glass-line)', padding: '7px 13px', borderRadius: 999 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: '#ffffff', boxShadow: '0 0 0 3px rgba(255, 255, 255, 0.2)' }} />
      Temps réel
    </span>
  );
}

/** A line that asks for attention (late orders, saturation): gold outline. */
export function Notice({ children, icon = 'info' }: { children: ReactNode; icon?: IconName }) {
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--a-accent)', borderRadius: 18, padding: '12px 16px', background: 'rgba(0, 0, 0, 0.35)' }}>
      <Icon name={icon} size={18} color="var(--a-accent)" />
      <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, fontWeight: 600, color: 'var(--a-text)' }}>{children}</span>
    </div>
  );
}

/** Search input with an accessible name. */
export function SearchField({ value, onChange, label, placeholder, style }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string; style?: CSSProperties }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      placeholder={placeholder ?? `${label}…`}
      style={{ ...fieldStyle, width: 'auto', flex: '1 1 220px', ...style }}
    />
  );
}

/** Centered glass sheet over a dimmed page. Escape and a click outside close it. */
export function Modal({ title, onClose, children, width = 480 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: `min(${width}px, 100%)`,
          maxHeight: '92vh',
          overflow: 'auto',
          background: 'linear-gradient(rgba(0, 0, 0, 0.62), rgba(0, 0, 0, 0.62)), var(--a-ground)',
          border: '1px solid var(--a-glass-line)',
          borderRadius: 26,
          padding: 24,
          boxShadow: '0 30px 80px -30px rgba(0, 0, 0, 0.8)',
          color: 'var(--ink)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 19, color: 'var(--ink)', margin: 0 }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{ border: '1px solid var(--a-glass-line)', background: 'transparent', borderRadius: 999, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="x" size={15} color="var(--ink)" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Error line under a form. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <div role="alert" style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--a-accent)', marginTop: 12 }}>
      {children}
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
