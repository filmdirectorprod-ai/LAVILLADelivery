// components/admin/incidents/IncidentCard.tsx
// One incident: severity + status pills, title, linked driver/order, detail, and a
// "Résoudre" action when still open. Pure presentational — the action is a callback.
'use client';
import type { IncidentRow } from '@/lib/admin-incidents';
import type { IncidentSeverity } from '@/lib/types';

const SEVERITY_COLOR: Record<IncidentSeverity, { bg: string; fg: string; label: string }> = {
  haute: { bg: 'rgba(192,57,43,0.12)', fg: '#c0392b', label: 'Haute' },
  moyenne: { bg: 'rgba(168,151,35,0.16)', fg: 'var(--gold)', label: 'Moyenne' },
  basse: { bg: 'var(--soft)', fg: 'var(--muted)', label: 'Basse' },
};

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export interface IncidentCardProps {
  row: IncidentRow;
  busy: boolean;
  onResolve: (id: string) => void;
}

export function IncidentCard({ row, busy, onResolve }: IncidentCardProps) {
  const { incident, driverName, orderCode } = row;
  const sev = SEVERITY_COLOR[incident.severity];
  const resolved = incident.status === 'resolved';

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: 18,
        boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        opacity: resolved ? 0.7 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: sev.bg, color: sev.fg }}>
          {sev.label}
        </span>
        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: resolved ? 'rgba(43,182,115,0.14)' : 'rgba(19,124,139,0.12)', color: resolved ? '#1f8a54' : 'var(--brand-d)' }}>
          {resolved ? 'Résolu' : 'Ouvert'}
        </span>
        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>{dateLabel(incident.created_at)}</span>
      </div>

      <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{incident.title}</div>

      <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', display: 'flex', flexWrap: 'wrap', gap: '2px 8px' }}>
        <span>{incident.kind}</span>
        {driverName && <span>· Livreur {driverName}</span>}
        {orderCode && <span>· {orderCode}</span>}
      </div>

      {incident.detail && (
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--ink)', margin: 0, lineHeight: 1.5 }}>{incident.detail}</p>
      )}

      {!resolved && (
        <div>
          <button
            type="button"
            disabled={busy}
            onClick={() => onResolve(incident.id)}
            style={{ border: 'none', borderRadius: 10, padding: '8px 16px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13, color: '#fff', background: 'var(--brand)', opacity: busy ? 0.6 : 1 }}
          >
            Résoudre
          </button>
        </div>
      )}
    </div>
  );
}
