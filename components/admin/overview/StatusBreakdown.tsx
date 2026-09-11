// components/admin/overview/StatusBreakdown.tsx
// Répartition des commandes du jour par statut, en colonnes arrondies comme les
// tuiles « Pay from » du modèle : le statut le plus fourni est la seule tuile
// blanche, les autres restent translucides. Sous-panneau du grand panneau de
// verre. Prop-driven.

const STAGES: { key: string; label: string }[] = [
  { key: 'pending', label: 'Attente' },
  { key: 'preparing', label: 'Cuisine' },
  { key: 'ready', label: 'Prêtes' },
  { key: 'en_route', label: 'En route' },
  { key: 'delivered', label: 'Livrées' },
];

export interface StatusBreakdownProps {
  counts: Record<string, number>;
}

export function StatusBreakdown({ counts }: StatusBreakdownProps) {
  const values = STAGES.map((s) => counts[s.key] ?? 0);
  const max = Math.max(0, ...values);
  const top = max > 0 ? STAGES[values.indexOf(max)].key : null;

  return (
    <div style={{ background: 'var(--soft)', borderRadius: 20, padding: '18px 16px 14px', display: 'flex', flexDirection: 'column', minHeight: 210 }}>
      <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', margin: '0 0 14px' }}>Répartition du jour</h2>

      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 8, minHeight: 110 }}>
        {STAGES.map((s, i) => {
          const n = values[i];
          const on = s.key === top;
          return (
            <div key={s.key} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 6, height: '100%' }}>
              <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, fontWeight: 600, color: on ? 'var(--ink)' : 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
              <div
                title={`${n} · ${s.label}`}
                style={{
                  width: '100%',
                  height: `${max > 0 ? Math.max(14, (n / max) * 96) : 14}px`,
                  borderRadius: 12,
                  background: on ? '#ffffff' : 'rgba(255, 255, 255, 0.14)',
                  transition: 'height 0.3s ease',
                }}
              />
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {STAGES.map((s) => {
          const on = s.key === top;
          return (
            <span
              key={s.key}
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: 'center',
                fontFamily: 'var(--ui-font)',
                fontSize: 10.5,
                fontWeight: on ? 600 : 500,
                padding: '4px 2px',
                borderRadius: 999,
                border: on ? '1px solid #ffffff' : '1px solid var(--line)',
                background: on ? '#ffffff' : 'transparent',
                color: on ? 'var(--a-on-white)' : 'var(--muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {s.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
