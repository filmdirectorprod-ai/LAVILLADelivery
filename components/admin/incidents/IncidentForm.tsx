// components/admin/incidents/IncidentForm.tsx
// Inline form to open a new incident. Holds the draft locally, gates submit on a
// non-empty title, and reports the draft via onCreate. Driver/order are optional.
'use client';
import { useState } from 'react';
import type { IncidentSeverity } from '@/lib/types';
import { GhostButton, GlassPanel, PanelTitle, PrimaryButton, fieldStyle, labelStyle } from '@/components/admin/ui/Glass';

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

export function IncidentForm({ drivers, orders, busy, onCreate, onCancel }: IncidentFormProps) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('retard');
  const [severity, setSeverity] = useState<IncidentSeverity>('moyenne');
  const [detail, setDetail] = useState('');
  const [driverId, setDriverId] = useState('');
  const [orderId, setOrderId] = useState('');

  const valid = title.trim() !== '';

  return (
    <GlassPanel>
      <PanelTitle>Nouvel incident</PanelTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={labelStyle} htmlFor="inc-title">
            Titre
          </label>
          <input id="inc-title" style={fieldStyle} value={title} disabled={busy} onChange={(e) => setTitle(e.target.value)} placeholder="Retard de livraison" />
        </div>
        <div>
          <label style={labelStyle} htmlFor="inc-kind">
            Type
          </label>
          <select id="inc-kind" style={fieldStyle} value={kind} disabled={busy} onChange={(e) => setKind(e.target.value)}>
            <option value="retard">Retard</option>
            <option value="litige">Litige</option>
            <option value="accident">Accident</option>
            <option value="autre">Autre</option>
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="inc-severity">
            Gravité
          </label>
          <select id="inc-severity" style={fieldStyle} value={severity} disabled={busy} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}>
            <option value="basse">Basse</option>
            <option value="moyenne">Moyenne</option>
            <option value="haute">Haute</option>
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="inc-driver">
            Livreur (optionnel)
          </label>
          <select id="inc-driver" style={fieldStyle} value={driverId} disabled={busy} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">—</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="inc-order">
            Commande (optionnel)
          </label>
          <select id="inc-order" style={fieldStyle} value={orderId} disabled={busy} onChange={(e) => setOrderId(e.target.value)}>
            <option value="">—</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.code}
              </option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle} htmlFor="inc-detail">
            Détail
          </label>
          <textarea id="inc-detail" style={{ ...fieldStyle, minHeight: 72, resize: 'vertical' }} value={detail} disabled={busy} onChange={(e) => setDetail(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <PrimaryButton
          disabled={busy || !valid}
          onClick={() => onCreate({ title: title.trim(), kind, severity, detail: detail.trim(), driver_id: driverId || null, order_id: orderId || null })}
        >
          Créer l&apos;incident
        </PrimaryButton>
        <GhostButton disabled={busy} onClick={onCancel}>
          Annuler
        </GhostButton>
      </div>
    </GlassPanel>
  );
}
