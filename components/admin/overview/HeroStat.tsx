// components/admin/overview/HeroStat.tsx
// Les grands chiffres fins du modèle visionOS : un libellé discret au-dessus, le
// nombre en graisse légère, l'unité en exposant. HeroStat vit sur le fond (encre
// claire de l'admin) ; MiniStat vit dans une carte (jetons d'encre de la carte).

export interface StatProps {
  label: string;
  value: string;
  unit?: string;
  title?: string;
}

function Unit({ children, color }: { children: string; color: string }) {
  return (
    <sup style={{ fontSize: '0.34em', fontWeight: 500, color, marginLeft: 3, position: 'relative', top: '-0.9em', verticalAlign: 'baseline' }}>
      {children}
    </sup>
  );
}

export function HeroStat({ label, value, unit, title }: StatProps) {
  return (
    <div title={title} style={{ minWidth: 150 }}>
      <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--a-muted)', marginBottom: 6, whiteSpace: 'nowrap' }}>{label}</div>
      <div
        style={{
          fontFamily: 'var(--ui-font)',
          fontSize: 46,
          fontWeight: 300,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          color: 'var(--a-text)',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
        {unit && <Unit color="var(--a-muted)">{unit}</Unit>}
      </div>
    </div>
  );
}

export function MiniStat({ label, value, unit, title }: StatProps) {
  return (
    <div title={title} style={{ minWidth: 0 }}>
      <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--ui-font)',
          fontSize: 34,
          fontWeight: 300,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          color: 'var(--ink)',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
        {unit && <Unit color="var(--muted)">{unit}</Unit>}
      </div>
    </div>
  );
}
