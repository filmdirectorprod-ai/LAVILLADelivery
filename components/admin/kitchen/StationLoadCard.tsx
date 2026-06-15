// components/admin/kitchen/StationLoadCard.tsx
// One station load gauge (Pâtisserie / Restaurant): capacity %, a colored fill
// bar, "X en cours / Y" and the rough "~Z min d'attente". Pure presentational —
// fed a StationLoad row built by lib/kitchen.ts. Bar turns red at saturation.
'use client';
import type { StationLoad } from '@/lib/kitchen';
import { Icon } from '@/components/ui/Icon';

const STATION_ICON: Record<string, string> = {
  patisserie: 'gift',
  restaurant: 'flame',
};

export function StationLoadCard({ load }: { load: StationLoad }) {
  const barColor = load.saturated ? '#d24b4b' : load.loadPct >= 75 ? 'var(--gold)' : 'var(--brand)';
  const tint = load.saturated ? 'rgba(210,75,75,0.12)' : 'rgba(19,124,139,0.10)';
  const tintColor = load.saturated ? '#d24b4b' : 'var(--brand)';

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: 18,
        boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: tint,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={STATION_ICON[load.station] ?? 'store'} size={18} color={tintColor} />
          </span>
          <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>
            {load.label}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 22, color: barColor }}>
          {load.loadPct}%
        </span>
      </div>

      <div style={{ height: 9, borderRadius: 999, background: 'var(--soft)', overflow: 'hidden' }}>
        <div
          style={{
            width: `${load.loadPct}%`,
            height: '100%',
            borderRadius: 999,
            background: barColor,
            transition: 'width .3s ease',
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)' }}>
          <strong style={{ color: 'var(--ink)' }}>{load.active}</strong> en cours / {load.capacity}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)' }}>
          <Icon name="clock" size={14} color="var(--muted)" />
          ~{load.waitMinutes} min d&apos;attente
        </span>
      </div>
    </div>
  );
}
