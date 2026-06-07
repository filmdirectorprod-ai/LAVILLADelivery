// Pure, side-effect-free helpers for the admin Planning screen. The weekly shift
// roster is laid out as a driver × day grid here so the same logic serves the
// server first-paint and the client realtime refetch, and stays unit testable.
// All day boundaries are computed in UTC (like lib/admin-overview's startOfTodayISO)
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
