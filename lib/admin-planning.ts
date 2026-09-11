// Pure, side-effect-free helpers for the admin Planning screen. The weekly shift
// roster is laid out as a driver × day grid here so the same logic serves the
// server first-paint and the client realtime refetch, and stays unit testable.
// Week boundaries here are computed in UTC (a roster grid, not a revenue day —
// unlike lib/admin-overview's startOfTodayISO, which cuts on the agency's midnight)
// so a UTC server and a UTC+1 browser agree on which day a shift falls in. No React,
// no I/O.

import type { DriverShift } from '@/lib/types';

/** YYYY-MM-DD for `d` in UTC. */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** UTC midnight of the Monday of the week containing `ref`. Monday is day 1; a
 *  Sunday (getUTCDay() === 0) belongs to the week that started six days earlier. */
export function mondayOf(ref: Date): Date {
  const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
  const dow = d.getUTCDay(); // 0 = Sun … 6 = Sat
  const delta = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + delta);
  return d;
}

export interface ShiftCell {
  /** YYYY-MM-DD (UTC) of this column. */
  date: string;
  shifts: DriverShift[];
}
export interface ShiftRow {
  driver: { id: string; name: string };
  /** Seven cells, Monday → Sunday. */
  days: ShiftCell[];
}
export interface ShiftWeek {
  /** Seven YYYY-MM-DD dates, Monday → Sunday. */
  days: string[];
  rows: ShiftRow[];
}

/** Build the driver × day grid for the week starting on `monday` (UTC midnight).
 *  Each shift lands in the column matching the UTC date of its `starts_at`; shifts
 *  outside the week or for unknown drivers are ignored. Cells are time-sorted. */
export function buildShiftWeek(
  shifts: DriverShift[],
  drivers: { id: string; name: string }[],
  monday: Date,
): ShiftWeek {
  const days: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    days.push(isoDate(new Date(monday.getTime() + i * 24 * 3600 * 1000)));
  }
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const driverIds = new Set(drivers.map((d) => d.id));

  // driverId → array of 7 cells' shift lists
  const buckets = new Map<string, DriverShift[][]>();
  for (const d of drivers) buckets.set(d.id, [[], [], [], [], [], [], []]);

  for (const s of shifts) {
    if (!driverIds.has(s.driver_id)) continue;
    const idx = dayIndex.get(isoDate(new Date(s.starts_at)));
    if (idx === undefined) continue;
    buckets.get(s.driver_id)![idx].push(s);
  }

  const rows: ShiftRow[] = drivers.map((driver) => {
    const cols = buckets.get(driver.id)!;
    const cells: ShiftCell[] = days.map((date, i) => {
      const list = cols[i].slice().sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
      return { date, shifts: list };
    });
    return { driver, days: cells };
  });

  return { days, rows };
}

/** Length of a shift in hours (0 when the bounds are inverted or unreadable). */
export function shiftHours(s: Pick<DriverShift, 'starts_at' | 'ends_at'>): number {
  const ms = Date.parse(s.ends_at) - Date.parse(s.starts_at);
  return Number.isFinite(ms) && ms > 0 ? ms / 3600000 : 0;
}

/** Hours scheduled for one driver over the week. */
export function rowHours(row: ShiftRow): number {
  return row.days.reduce((n, c) => n + c.shifts.reduce((m, s) => m + shiftHours(s), 0), 0);
}

export interface WeekTotals {
  shifts: number;
  hours: number;
  /** Drivers with at least one shift. */
  drivers: number;
  /** Drivers on shift, per day (Monday → Sunday). */
  perDay: number[];
  /** Days with nobody scheduled. */
  uncoveredDays: number;
}

export function weekTotals(week: ShiftWeek): WeekTotals {
  const perDay = week.days.map((_, i) => week.rows.filter((r) => r.days[i].shifts.length > 0).length);
  let shifts = 0;
  let hours = 0;
  let drivers = 0;
  for (const r of week.rows) {
    const n = r.days.reduce((m, c) => m + c.shifts.length, 0);
    shifts += n;
    hours += rowHours(r);
    if (n > 0) drivers += 1;
  }
  return { shifts, hours, drivers, perDay, uncoveredDays: perDay.filter((n) => n === 0).length };
}

/** 7.5 → "7 h 30", 8 → "8 h". */
export function formatHours(h: number): string {
  const total = Math.round(h * 60);
  const m = total % 60;
  return `${Math.floor(total / 60)} h${m ? ` ${String(m).padStart(2, '0')}` : ''}`;
}
