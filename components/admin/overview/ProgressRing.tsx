// components/admin/overview/ProgressRing.tsx
// Anneau de progression de l'en-tête (le cercle du modèle visionOS) : une part
// `value / total`, la valeur au centre et une légende à côté. SVG pur, sans
// bibliothèque. Prop-driven.

export interface ProgressRingProps {
  value: number;
  total: number;
  caption: string;
}

export function ProgressRing({ value, total, caption }: ProgressRingProps) {
  const size = 104;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = total > 0 ? Math.min(1, value / total) : 0;
  const mid = size / 2;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value} sur ${total} ${caption}`}>
          <circle cx={mid} cy={mid} r={r} fill="none" stroke="rgba(255, 255, 255, 0.16)" strokeWidth={stroke} />
          {/* Rien à tracer à 0 % : une extrémité arrondie dessinerait un point. */}
          {ratio > 0 && (
            <circle
              cx={mid}
              cy={mid}
              r={r}
              fill="none"
              stroke="#ffffff"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - ratio)}
              transform={`rotate(-90 ${mid} ${mid})`}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          )}
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--ui-font)',
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--a-text)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--a-muted)' }}>/{total}</span>
        </div>
      </div>
      <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--a-muted)', lineHeight: 1.35, maxWidth: 92 }}>{caption}</div>
    </div>
  );
}
