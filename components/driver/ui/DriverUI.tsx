'use client';
// components/driver/ui/DriverUI.tsx
// Les briques de l'app livreur, dans la langue de l'admin : panneaux de verre
// sur le fond turquoise foncé, grands chiffres fins, pastilles d'état. Même
// palette stricte (turquoise / or / blanc) — l'or ne porte jamais de texte en
// aplat, le blanc marque l'état actif. Pensé pour le pouce : cibles ≥ 44 px.
import type { CSSProperties, ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SAFE_TOP } from '@/lib/layout';

export const text = { fontFamily: 'var(--ui-font)' } as const;

/** Carte de verre. Le marqueur --a-card active flou + liseré (globals.css). */
export function Panel({ children, style, padding = 16 }: { children: ReactNode; style?: CSSProperties; padding?: number | string }) {
  return (
    <section
      style={{
        background: 'var(--a-card)',
        border: '1px solid var(--a-glass-line)',
        borderRadius: 20,
        padding,
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

/** Puits à l'intérieur d'une carte (sous-bloc). */
export function Well({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ background: 'var(--soft)', borderRadius: 16, padding: 14, minWidth: 0, ...style }}>{children}</div>;
}

/** En-tête d'écran : titre, sous-titre, retour optionnel, action à droite. */
export function DriverHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <div style={{ padding: `${SAFE_TOP + 10}px 16px 16px`, display: 'flex', alignItems: 'center', gap: 12 }}>
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Retour"
          style={{ width: 42, height: 42, borderRadius: 999, border: '1px solid var(--a-glass-line)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <Icon name="left" size={20} color="var(--a-text)" />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ ...text, margin: 0, fontWeight: 600, fontSize: 27, letterSpacing: '-0.02em', color: 'var(--a-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </h1>
        {subtitle && <div style={{ ...text, fontSize: 13, color: 'var(--a-muted)', marginTop: 3 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

/** Grand chiffre fin, comme la Vue d'ensemble. */
export function Figure({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...text, fontSize: 12, color: 'var(--a-muted)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ ...text, fontSize: 32, fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--a-text)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {value}
        {unit && <sup style={{ fontSize: '0.34em', fontWeight: 500, color: 'var(--a-muted)', marginLeft: 3, top: '-0.9em', position: 'relative' }}>{unit}</sup>}
      </div>
    </div>
  );
}

/** Tuile chiffrée dans une carte de verre. */
export function StatTile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <Panel style={{ flex: 1, padding: '14px 14px' }}>
      <Figure label={label} value={value} unit={unit} />
    </Panel>
  );
}

export type PillTone = 'solid' | 'outline' | 'accent' | 'muted';

const PILL: Record<PillTone, CSSProperties> = {
  solid: { background: '#ffffff', color: 'var(--a-on-white)', border: '1px solid #ffffff' },
  outline: { background: 'transparent', color: 'var(--ink)', border: '1px solid var(--a-glass-line)' },
  accent: { background: 'transparent', color: 'var(--a-accent)', border: '1px solid var(--a-accent)' },
  muted: { background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)' },
};

export function Pill({ children, tone = 'outline' }: { children: ReactNode; tone?: PillTone }) {
  return (
    <span style={{ ...PILL[tone], ...text, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

/** Action principale : pilule blanche à texte turquoise. */
export function PrimaryAction({ children, onClick, disabled, full = true, style, ...rest }: { children: ReactNode; onClick?: () => void; disabled?: boolean; full?: boolean; style?: CSSProperties; 'aria-label'?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={rest['aria-label']}
      style={{
        ...text,
        width: full ? '100%' : undefined,
        minHeight: 52,
        border: 'none',
        borderRadius: 999,
        padding: '14px 22px',
        background: '#ffffff',
        color: 'var(--a-on-white)',
        fontSize: 16,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Action secondaire : pilule de verre. */
export function GhostAction({ children, onClick, disabled, full, style, ...rest }: { children: ReactNode; onClick?: () => void; disabled?: boolean; full?: boolean; style?: CSSProperties; 'aria-label'?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={rest['aria-label']}
      style={{
        ...text,
        width: full ? '100%' : undefined,
        minHeight: 46,
        border: '1px solid var(--a-glass-line)',
        borderRadius: 999,
        padding: '11px 18px',
        background: 'transparent',
        color: 'var(--ink)',
        fontSize: 14.5,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Interrupteur. Or quand il est actif — il ne porte pas de texte. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: 50,
        height: 30,
        flexShrink: 0,
        border: 'none',
        borderRadius: 999,
        padding: 0,
        background: checked ? 'var(--a-accent)' : 'rgba(255, 255, 255, 0.18)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 0.2s ease',
      }}
    >
      <span style={{ position: 'absolute', top: 3, left: checked ? 23 : 3, width: 24, height: 24, borderRadius: 999, background: '#ffffff', transition: 'left 0.2s ease' }} />
    </button>
  );
}

/** Ligne vide, dans le ton. */
export function EmptyLine({ title, hint }: { title: string; hint?: string }) {
  return (
    <Panel style={{ textAlign: 'center', padding: '26px 16px' }}>
      <div style={{ ...text, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
      {hint && <div style={{ ...text, fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>{hint}</div>}
    </Panel>
  );
}

/** Bandeau d'attention : liseré or. */
export function Notice({ children, icon = 'info' }: { children: ReactNode; icon?: IconName }) {
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--a-accent)', borderRadius: 16, padding: '12px 14px', background: 'rgba(0, 0, 0, 0.35)' }}>
      <Icon name={icon} size={18} color="var(--a-accent)" />
      <span style={{ ...text, fontSize: 13.5, fontWeight: 600, color: 'var(--a-text)' }}>{children}</span>
    </div>
  );
}

/** Pastille ronde tenant une icône. */
export function IconTile({ name, size = 42 }: { name: IconName; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.32, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon name={name} size={Math.round(size * 0.46)} color="var(--ink)" />
    </div>
  );
}

/** Titre de section. */
export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, margin: '0 2px 10px' }}>
      <h2 style={{ ...text, margin: 0, fontWeight: 600, fontSize: 16, color: 'var(--a-text)' }}>{children}</h2>
      {aside != null && <span style={{ ...text, fontSize: 12.5, color: 'var(--a-muted)' }}>{aside}</span>}
    </div>
  );
}

/** Champ de saisie sur fond sombre. */
export const fieldStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'var(--ui-font)',
  fontSize: 15,
  padding: '13px 14px',
  border: '1px solid var(--a-glass-line)',
  borderRadius: 14,
  background: 'rgba(255, 255, 255, 0.06)',
  color: 'var(--ink)',
  outline: 'none',
};

export const labelStyle: CSSProperties = {
  display: 'block',
  fontFamily: 'var(--ui-font)',
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--a-muted)',
  marginBottom: 6,
};

/** Message d'erreur de formulaire — or, jamais rouge. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <div role="alert" style={{ ...text, fontSize: 13, fontWeight: 600, color: 'var(--a-accent)', marginTop: 12 }}>
      {children}
    </div>
  );
}
