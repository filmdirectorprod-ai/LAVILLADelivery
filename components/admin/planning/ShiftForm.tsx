// components/admin/planning/ShiftForm.tsx
// Inline form to add one shift: driver + day (constrained to the displayed week) +
// start/end time + optional note. Times are interpreted as UTC so they land in the
// same day column buildShiftWeek bucketed by. Reports a validated draft via onAdd.
'use client';
import { useState } from 'react';

export interface ShiftDraft {
  driver_id: string;
  starts_at: string;
  ends_at: string;
  note: string;
}

export interface ShiftFormProps {
  drivers: { id: string; name: string }[];
  /** The seven YYYY-MM-DD dates of the displayed week. */
  days: string[];
  busy: boolean;
  onAdd: (draft: ShiftDraft) => void;
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

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
}

export function ShiftForm({ drivers, days, busy, onAdd, onCancel }: ShiftFormProps) {
  const [driverId, setDriverId] = useState(drivers[0]?.id ?? '');
  const [date, setDate] = useState(days[0] ?? '');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [note, setNote] = useState('');

  const valid = driverId !== '' && date !== '' && start !== '' && end !== '' && end > start;

  return (
    <div style={{ background: '#fff', border: '1px solid var(--brand)', borderRadius: 18, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Ajouter un créneau</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={labelStyle}>Livreur</span>
          <select style={field} value={driverId} disabled={busy} onChange={(e) => setDriverId(e.target.value)}>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={labelStyle}>Jour</span>
          <select style={field} value={date} disabled={busy} onChange={(e) => setDate(e.target.value)}>
            {days.map((d) => (
              <option key={d} value={d}>{dayLabel(d)}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={labelStyle}>Début</span>
          <input style={field} type="time" value={start} disabled={busy} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={labelStyle}>Fin</span>
          <input style={field} type="time" value={end} disabled={busy} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={labelStyle}>Note (optionnel)</span>
        <input style={field} value={note} disabled={busy} onChange={(e) => setNote(e.target.value)} placeholder="Secteur Médina" />
      </label>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          disabled={busy || !valid}
          onClick={() =>
            onAdd({
              driver_id: driverId,
              starts_at: new Date(`${date}T${start}:00Z`).toISOString(),
              ends_at: new Date(`${date}T${end}:00Z`).toISOString(),
              note: note.trim(),
            })
          }
          style={{ border: 'none', borderRadius: 10, padding: '9px 18px', cursor: busy || !valid ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13.5, color: '#fff', background: 'var(--brand)', opacity: valid && !busy ? 1 : 0.5 }}
        >
          Ajouter
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
