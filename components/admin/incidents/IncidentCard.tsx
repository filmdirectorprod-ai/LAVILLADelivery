// components/admin/incidents/IncidentCard.tsx
// One incident: severity + status pills, date, title, type and linked
// driver/order, detail, time to resolve, and a "Résoudre" action while open.
// Pure presentational — the action is a callback.
'use client';
import { INCIDENT_KIND_LABEL, SEVERITY_LABEL, type IncidentRow } from '@/lib/admin-incidents';
import type { IncidentSeverity } from '@/lib/types';
import { Pill, PrimaryButton, SubPanel, type PillTone } from '@/components/admin/ui/Glass';

const SEVERITY_TONE: Record<IncidentSeverity, PillTone> = { haute: 'accent', moyenne: 'outline', basse: 'muted' };

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' });
}

function durationLabel(fromIso: string, toIso: string): string {
  const mins = Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} j`;
}

export interface IncidentCardProps {
  row: IncidentRow;
  busy: boolean;
  onResolve: (id: string) => void;
}

export function IncidentCard({ row, busy, onResolve }: IncidentCardProps) {
  const { incident, driverName, orderCode } = row;
  const resolved = incident.status === 'resolved';
  const text = { fontFamily: 'var(--ui-font)' } as const;

  return (
    <SubPanel style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: resolved ? 0.75 : 1, border: !resolved && incident.severity === 'haute' ? '1px solid var(--a-accent)' : '1px solid transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Pill tone={SEVERITY_TONE[incident.severity]}>{SEVERITY_LABEL[incident.severity]}</Pill>
        <Pill tone={resolved ? 'muted' : 'solid'}>{resolved ? 'Résolu' : 'Ouvert'}</Pill>
        <span style={{ ...text, fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>{dateLabel(incident.created_at)}</span>
      </div>

      <h3 style={{ ...text, margin: 0, fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{incident.title}</h3>

      <div style={{ ...text, fontSize: 12.5, color: 'var(--muted)', display: 'flex', flexWrap: 'wrap', gap: '2px 8px' }}>
        <span>{INCIDENT_KIND_LABEL[incident.kind] ?? incident.kind}</span>
        {driverName && <span>· Livreur {driverName}</span>}
        {orderCode && <span>· {orderCode}</span>}
      </div>

      {incident.detail && <p style={{ ...text, fontSize: 13.5, color: 'var(--ink)', margin: 0, lineHeight: 1.5 }}>{incident.detail}</p>}

      {resolved ? (
        incident.resolved_at && <span style={{ ...text, fontSize: 12, color: 'var(--muted)' }}>Résolu en {durationLabel(incident.created_at, incident.resolved_at)}</span>
      ) : (
        <div>
          <PrimaryButton disabled={busy} onClick={() => onResolve(incident.id)} aria-label={`Résoudre « ${incident.title} »`}>
            Résoudre
          </PrimaryButton>
        </div>
      )}
    </SubPanel>
  );
}
