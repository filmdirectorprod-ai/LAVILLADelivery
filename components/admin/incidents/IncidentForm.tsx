// components/admin/incidents/IncidentForm.tsx
// Inline form to open a new incident. Holds the draft locally, gates submit on a
// non-empty title, and reports the draft via onCreate. Driver/order are optional.
'use client';
import { useState } from 'react';
import type { IncidentSeverity } from '@/lib/types';

export interface IncidentDraft {
  title: string;
  kind: string;
  severity: IncidentSeverity;
  detail: string;
  driver_id: string | null;
  order_id: string | null;
}

export interface IncidentFormProps {
  drivers: { id: string; name: string }[];
  orders: { id: string; code: string }[];
  busy: boolean;
  onCreate: (draft: IncidentDraft) => void;
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
  background: '#fff',
};
const labelStyle: React.CSSProperties = { fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)', fontWeight: 600 };

export function IncidentForm({ drivers, orders, busy, onCreate, onCancel }: IncidentFormProps) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('retard');
  const [severity, setSeverity] = useState<IncidentSeverity>('moyenne');
  const [detail, setDetail] = useState('');
  const [driverId, setDriverId] = useState('');
  const [orderId, setOrderId] = useState('');

  const valid = title.trim() !== '';

  return (
    <div style={{ background: '#fff', border: '1px solid var(--brand)', borderRadius: 18, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Nouvel incident</div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={labelStyle}>Titre</span>
          <input style={field} value={title} disabled={busy} onChange={(e) => setTitle(e.target.value)} placeholder="Retard de livraison" />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={labelStyle}>Type</span>
          <select style={field} value={kind} disabled={busy} onChange={(e) => setKind(e.target.value)}>
            <option value="retard">Retard</option>
            <option value="litige">Litige</option>
            <option value="accident">Accident</option>
            <option value="autre">Autre</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={labelStyle}>Gravité</span>
          <select style={field} value={severity} disabled={busy} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}>
            <option value="basse">Basse</option>
            <option value="moyenne">Moyenne</option>
            <option value="haute">Haute</option>
          </select>
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={labelStyle}>Livreur (optionnel)</span>
          <select style={field} value={driverId} disabled={busy} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">—</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={labelStyle}>Commande (optionnel)</span>
          <select style={field} value={orderId} disabled={busy} onChange={(e) => setOrderId(e.target.value)}>
            <option value="">—</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>{o.code}</option>
            ))}
          </select>
        </label>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={labelStyle}>Détail</span>
        <textarea style={{ ...field, minHeight: 64, resize: 'vertical' }} value={detail} disabled={busy} onChange={(e) => setDetail(e.target.value)} />
      </label>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          disabled={busy || !valid}
          onClick={() =>
            onCreate({
              title: title.trim(),
              kind,
              severity,
              detail: detail.trim(),
              driver_id: driverId || null,
              order_id: orderId || null,
            })
          }
          style={{ border: 'none', borderRadius: 10, padding: '9px 18px', cursor: busy || !valid ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13.5, color: '#fff', background: 'var(--brand)', opacity: valid && !busy ? 1 : 0.5 }}
        >
          Créer l&apos;incident
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
