// components/admin/kitchen/StationLoadCard.tsx
// One station load gauge (Pâtisserie / Restaurant): capacity %, a fill bar,
// "X en cours / Y" and the rough "~Z min d'attente". Pure presentational — fed a
// StationLoad row built by lib/kitchen.ts. The figure and bar turn gold at
// saturation.
'use client';
import type { StationLoad } from '@/lib/kitchen';
import { Icon } from '@/components/ui/Icon';
import { IconTile, Meter, SubPanel } from '@/components/admin/ui/Glass';

const STATION_ICON: Record<string, string> = {
  patisserie: 'gift',
  restaurant: 'flame',
};

export function StationLoadCard({ load }: { load: StationLoad }) {
  return (
    <SubPanel style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconTile name={STATION_ICON[load.station] ?? 'store'} size={36} />
          <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{load.label}</span>
        </div>
        <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 300, fontSize: 30, letterSpacing: '-0.02em', color: load.saturated ? 'var(--a-accent)' : 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
          {load.loadPct}
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)', marginLeft: 2 }}>%</span>
        </span>
      </div>

      <Meter ratio={load.loadPct / 100} label={`${load.label} : charge ${load.loadPct} %`} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)' }}>
          <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{load.active}</strong> en cours / {load.capacity}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)' }}>
          <Icon name="clock" size={14} color="var(--muted)" />~{load.waitMinutes} min d&apos;attente
        </span>
      </div>
    </SubPanel>
  );
}
