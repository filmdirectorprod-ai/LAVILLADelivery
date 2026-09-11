// components/admin/planning/ShiftForm.tsx
// Inline form to add one shift: driver + day (constrained to the displayed week) +
// start/end time + optional note. Times are interpreted as UTC so they land in the
// same day column buildShiftWeek bucketed by. Reports a validated draft via onAdd.
'use client';
import { useState } from 'react';
import { formatHours, shiftHours } from '@/lib/admin-planning';
import { FormError, GhostButton, GlassPanel, PanelTitle, PrimaryButton, fieldStyle, labelStyle } from '@/components/admin/ui/Glass';

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

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
}

export function ShiftForm({ drivers, days, busy, onAdd, onCancel }: ShiftFormProps) {
  const [driverId, setDriverId] = useState(drivers[0]?.id ?? '');
  const [date, setDate] = useState(days[0] ?? '');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [note, setNote] = useState('');

  const valid = driverId !== '' && date !== '' && start !== '' && end !== '' && end > start;
  const startsAt = date && start ? new Date(`${date}T${start}:00Z`).toISOString() : '';
  const endsAt = date && end ? new Date(`${date}T${end}:00Z`).toISOString() : '';
  const hours = valid ? shiftHours({ starts_at: startsAt, ends_at: endsAt }) : 0;

  return (
    <GlassPanel>
      <PanelTitle aside={valid ? `Durée : ${formatHours(hours)}` : undefined}>Ajouter un créneau</PanelTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        <div>
          <label style={labelStyle} htmlFor="shift-driver">
            Livreur
          </label>
          <select id="shift-driver" style={fieldStyle} value={driverId} disabled={busy} onChange={(e) => setDriverId(e.target.value)}>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="shift-day">
            Jour
          </label>
          <select id="shift-day" style={{ ...fieldStyle, textTransform: 'capitalize' }} value={date} disabled={busy} onChange={(e) => setDate(e.target.value)}>
            {days.map((d) => (
              <option key={d} value={d}>
                {dayLabel(d)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="shift-start">
            Début
          </label>
          <input id="shift-start" style={fieldStyle} type="time" value={start} disabled={busy} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="shift-end">
            Fin
          </label>
          <input id="shift-end" style={fieldStyle} type="time" value={end} disabled={busy} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle} htmlFor="shift-note">
            Note (optionnel)
          </label>
          <input id="shift-note" style={fieldStyle} value={note} disabled={busy} onChange={(e) => setNote(e.target.value)} placeholder="Secteur Médina" />
        </div>
      </div>
      {start && end && end <= start && <FormError>L&apos;heure de fin doit être après l&apos;heure de début.</FormError>}
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <PrimaryButton disabled={busy || !valid} onClick={() => onAdd({ driver_id: driverId, starts_at: startsAt, ends_at: endsAt, note: note.trim() })}>
          Ajouter
        </PrimaryButton>
        <GhostButton disabled={busy} onClick={onCancel}>
          Annuler
        </GhostButton>
      </div>
    </GlassPanel>
  );
}
