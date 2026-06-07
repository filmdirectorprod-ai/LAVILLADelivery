import { describe, it, expect } from 'vitest';
import { isoDate, mondayOf, buildShiftWeek } from '@/lib/admin-planning';
import type { DriverShift } from '@/lib/types';

function shift(over: Partial<DriverShift> & { id: string; driver_id: string; starts_at: string }): DriverShift {
  return {
    ends_at: over.starts_at,
    note: '',
    created_at: '2026-06-01T00:00:00Z',
    ...over,
  };
}

describe('mondayOf', () => {
  it('returns the Monday of a midweek day (UTC)', () => {
    // 2026-06-07 is a Sunday → week started Monday 2026-06-01.
    expect(isoDate(mondayOf(new Date('2026-06-07T14:00:00Z')))).toBe('2026-06-01');
    // 2026-06-03 is a Wednesday → same Monday.
    expect(isoDate(mondayOf(new Date('2026-06-03T09:00:00Z')))).toBe('2026-06-01');
  });

  it('treats Monday itself as the week start', () => {
    expect(isoDate(mondayOf(new Date('2026-06-01T23:00:00Z')))).toBe('2026-06-01');
  });
});

describe('buildShiftWeek', () => {
  const drivers = [
    { id: 'd1', name: 'Karim' },
    { id: 'd2', name: 'Yassine' },
  ];
  const monday = mondayOf(new Date('2026-06-03T00:00:00Z')); // 2026-06-01

  it('lays out seven Monday→Sunday columns', () => {
    const week = buildShiftWeek([], drivers, monday);
    expect(week.days).toEqual([
      '2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-06', '2026-06-07',
    ]);
    expect(week.rows.map((r) => r.driver.id)).toEqual(['d1', 'd2']);
  });

  it('places each shift in the column matching its UTC start date', () => {
    const shifts = [
      shift({ id: 's1', driver_id: 'd1', starts_at: '2026-06-01T08:00:00Z' }), // Monday
      shift({ id: 's2', driver_id: 'd1', starts_at: '2026-06-03T18:00:00Z' }), // Wednesday
    ];
    const week = buildShiftWeek(shifts, drivers, monday);
    const karim = week.rows[0];
    expect(karim.days[0].shifts.map((s) => s.id)).toEqual(['s1']);
    expect(karim.days[2].shifts.map((s) => s.id)).toEqual(['s2']);
    expect(karim.days[1].shifts).toEqual([]);
  });

  it('ignores shifts outside the week or for unknown drivers', () => {
    const shifts = [
      shift({ id: 'next', driver_id: 'd1', starts_at: '2026-06-08T08:00:00Z' }), // next week
      shift({ id: 'ghost', driver_id: 'dX', starts_at: '2026-06-02T08:00:00Z' }),
    ];
    const week = buildShiftWeek(shifts, drivers, monday);
    const placed = week.rows.flatMap((r) => r.days.flatMap((c) => c.shifts));
    expect(placed).toEqual([]);
  });

  it('sorts shifts within a day by start time', () => {
    const shifts = [
      shift({ id: 'pm', driver_id: 'd2', starts_at: '2026-06-02T18:00:00Z' }),
      shift({ id: 'am', driver_id: 'd2', starts_at: '2026-06-02T08:00:00Z' }),
    ];
    const week = buildShiftWeek(shifts, drivers, monday);
    expect(week.rows[1].days[1].shifts.map((s) => s.id)).toEqual(['am', 'pm']);
  });
});
