// components/admin/overview/HourlyChart.tsx
// Commandes par heure pour « aujourd'hui », heure de pointe en or. Sous-panneau du
// grand panneau de verre de la vue d'ensemble : fond de puits, sans carte propre.
// Barres en CSS pur (pas de bibliothèque). `buckets` est le tableau de 24 cases
// de bucketOrdersByHour.
export interface HourlyChartProps {
  buckets: number[];
}

export function HourlyChart({ buckets }: HourlyChartProps) {
  const max = Math.max(1, ...buckets);
  const peak = buckets.indexOf(Math.max(...buckets));
  const anyOrders = buckets.some((b) => b > 0);
  return (
    <div style={{ background: 'var(--soft)', borderRadius: 20, padding: '18px 18px 14px', minHeight: 210, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', margin: 0 }}>
          Activité — aujourd&apos;hui
        </h2>
        {anyOrders && (
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)' }}>
            Pic à {String(peak).padStart(2, '0')}h
          </span>
        )}
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 3, minHeight: 130 }}>
        {buckets.map((count, h) => (
          <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 5, height: '100%' }}>
            <div
              title={`${count} commande${count > 1 ? 's' : ''} à ${String(h).padStart(2, '0')}h`}
              style={{
                width: '100%',
                height: `${count > 0 ? Math.max(6, (count / max) * 100) : 4}px`,
                borderRadius: 6,
                background: anyOrders && h === peak ? 'var(--gold)' : '#ffffff',
                opacity: count > 0 ? (anyOrders && h === peak ? 1 : 0.55) : 0.1,
                transition: 'height 0.3s ease',
              }}
            />
            <span style={{ fontFamily: 'var(--ui-font)', fontSize: 10, color: 'var(--muted)', visibility: h % 3 === 0 ? 'visible' : 'hidden' }}>{h}h</span>
          </div>
        ))}
      </div>
    </div>
  );
}
