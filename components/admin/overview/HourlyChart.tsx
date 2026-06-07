// components/admin/overview/HourlyChart.tsx
// Orders-per-hour bar chart for "today", with the peak hour highlighted in gold.
// Pure CSS bars (no chart library). `buckets` is a length-24 array from
// bucketOrdersByHour.
export interface HourlyChartProps {
  buckets: number[];
}

export function HourlyChart({ buckets }: HourlyChartProps) {
  const max = Math.max(1, ...buckets);
  const peak = buckets.indexOf(Math.max(...buckets));
  const anyOrders = buckets.some((b) => b > 0);
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: 18,
        padding: '20px 22px',
        boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 16, color: 'var(--ink)', margin: 0 }}>
          Activité des commandes — aujourd&apos;hui
        </h2>
        {anyOrders && (
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>
            Pic à {String(peak).padStart(2, '0')}h
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 140 }}>
        {buckets.map((count, h) => (
          <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <div
              title={`${count} commande${count > 1 ? 's' : ''} à ${String(h).padStart(2, '0')}h`}
              style={{
                width: '100%',
                height: `${(count / max) * 110}px`,
                minHeight: count > 0 ? 4 : 0,
                borderRadius: 4,
                background: anyOrders && h === peak ? 'var(--gold)' : 'var(--brand)',
                opacity: count > 0 ? 1 : 0.12,
                transition: 'height 0.3s ease',
              }}
            />
            {h % 3 === 0 && (
              <span style={{ fontFamily: 'var(--ui-font)', fontSize: 10, color: 'var(--muted)' }}>{h}h</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
