// Pure, side-effect-free helpers for the driver "Mon planning" screen. A flat
// list of the driver's shifts is folded into day sections (upcoming first), each
// with a French day label and its shifts earliest-first. The same logic serves
// the server first-paint and the client realtime refetch. No React, no I/O.

import type { DriverShift } from '@/lib/types';

export interface ShiftDay {
  /** Local ISO date (YYYY-MM-DD) of the day — a stable React key. */
  dateIso: string;
  /** Capitalised French label, e.g. "Lundi 9 juin". */
  label: string;
  /** This day's shifts, earliest start first. */
  shifts: DriverShift[];
}

function localIsoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

const capitalise = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** "09:00 – 17:00" for a shift, in the device's local time. */
export function shiftRange(shift: DriverShift): string {
  const fmt = (iso: string): string => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };
  return `${fmt(shift.starts_at)} – ${fmt(shift.ends_at)}`;
}

/** Group upcoming shifts (those not yet ended) by calendar day. Days are ordered
 *  earliest first, shifts within a day earliest first, and already-finished
 *  shifts are dropped. */
export function groupShiftsByDay(shifts: DriverShift[], now: Date = new Date()): ShiftDay[] {
  const upcoming = shifts
    .filter((s) => {
      const end = Date.parse(s.ends_at);
      return !Number.isNaN(end) && end >= now.getTime();
    })
    .slice()
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));

  const days: ShiftDay[] = [];
  const byKey = new Map<string, ShiftDay>();
  for (const s of upcoming) {
    const start = new Date(s.starts_at);
    const key = localIsoDay(start);
    let day = byKey.get(key);
    if (!day) {
      day = {
        dateIso: key,
        label: capitalise(
          start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
        ),
        shifts: [],
      };
      byKey.set(key, day);
      days.push(day);
    }
    day.shifts.push(s);
  }
  return days;
}
