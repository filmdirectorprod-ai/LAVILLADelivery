// components/admin/overview/KpiCard.tsx
// One presentational KPI card for the admin overview. Icon + value + label,
// with an optional sub-line and accent colour. Prop-driven only.
import { Icon } from '@/components/ui/Icon';

export interface KpiCardProps {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

export function KpiCard({ icon, label, value, sub, accent }: KpiCardProps) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: 18,
        padding: '18px 20px',
        boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          background: accent ? 'var(--brand)' : 'var(--soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={20} color={accent ? '#fff' : 'var(--brand-d)'} />
      </div>
      <div>
        <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 24, color: 'var(--ink)', lineHeight: 1.1 }}>
          {value}
        </div>
        <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>{label}</div>
        {sub && (
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--brand-d)', fontWeight: 600, marginTop: 4 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}
