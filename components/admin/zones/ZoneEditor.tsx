// components/admin/zones/ZoneEditor.tsx
// Inline create/edit form for one delivery zone. Holds the draft locally, gates
// its own submit with validateZoneDraft (the same rules the admin_upsert_zone RPC
// enforces), and reports a validated draft + id (null = create) via onSave.
'use client';
import { useState } from 'react';
import { validateZoneDraft, type ZoneDraft } from '@/lib/admin-zones';
import type { Zone } from '@/lib/types';

export interface ZoneEditorProps {
  /** The zone being edited, or null to create a new one. */
  zone: Zone | null;
  busy: boolean;
  onSave: (draft: ZoneDraft, id: string | null) => void;
  onCancel: () => void;
}

const field: React.CSSProperties = {
  fontFamily: 'var(--ui-font)',
  fontSize: 13.5,
  padding: '8px 10px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  color: 'var(--ink)',
  width: '100%',
};
const labelStyle: React.CSSProperties = { fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)', fontWeight: 600 };

export function ZoneEditor({ zone, busy, onSave, onCancel }: ZoneEditorProps) {
  const [name, setName] = useState(zone?.name ?? '');
  const [fee, setFee] = useState(String(zone?.fee_dh ?? ''));
  const [etaMin, setEtaMin] = useState(String(zone?.eta_min ?? ''));
  const [etaMax, setEtaMax] = useState(String(zone?.eta_max ?? ''));

  const draft: ZoneDraft = {
    name,
    fee_dh: Number(fee),
    eta_min: Number(etaMin),
    eta_max: Number(etaMax),
  };
  const validation = validateZoneDraft(draft);

  return (
    <div style={{ background: '#fff', border: '1px solid var(--brand)', borderRadius: 18, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
        {zone ? 'Modifier la zone' : 'Nouvelle zone'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={labelStyle}>Nom</span>
          <input style={field} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} placeholder="Médina" />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={labelStyle}>Frais (DH)</span>
          <input style={field} type="number" min={0} value={fee} disabled={busy} onChange={(e) => setFee(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={labelStyle}>Délai min</span>
          <input style={field} type="number" min={0} value={etaMin} disabled={busy} onChange={(e) => setEtaMin(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={labelStyle}>Délai max</span>
          <input style={field} type="number" min={0} value={etaMax} disabled={busy} onChange={(e) => setEtaMax(e.target.value)} />
        </label>
      </div>
      {!validation.ok && (
        <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: '#c0392b' }}>{validation.error}</div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          disabled={busy || !validation.ok}
          onClick={() => onSave(draft, zone?.id ?? null)}
          style={{ border: 'none', borderRadius: 10, padding: '9px 18px', cursor: busy || !validation.ok ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13.5, color: '#fff', background: 'var(--brand)', opacity: validation.ok && !busy ? 1 : 0.5 }}
        >
          Enregistrer
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '9px 18px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', background: '#fff' }}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
