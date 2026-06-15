import { describe, it, expect } from 'vitest';
import { groupShiftsByDay, shiftRange } from '@/lib/driver-planning';
import type { DriverShift } from '@/lib/types';

function shift(over: Partial<DriverShift> & { id: string; starts_at: string; ends_at: string }): DriverShift {
  return { driver_id: 'd1', note: '', created_at: '2026-06-01T00:00:00Z', ...over };
}

const NOW = new Date('2026-06-09T12:00:00Z');

describe('groupShiftsByDay', () => {
  it('drops shifts that have already ended', () => {
    const days = groupShiftsByDay(
      [
        shift({ id: 'past', starts_at: '2026-06-08T09:00:00Z', ends_at: '2026-06-08T17:00:00Z' }),
        shift({ id: 'soon', starts_at: '2026-06-10T09:00:00Z', ends_at: '2026-06-10T17:00:00Z' }),
      ],
      NOW,
    );
    const ids = days.flatMap((d) => d.shifts.map((s) => s.id));
    expect(ids).toEqual(['soon']);
  });

  it('keeps a shift that started but has not yet ended', () => {
    const days = groupShiftsByDay(
      [shift({ id: 'live', starts_at: '2026-06-09T10:00:00Z', ends_at: '2026-06-09T18:00:00Z' })],
      NOW,
    );
    expect(days.flatMap((d) => d.shifts.map((s) => s.id))).toEqual(['live']);
  });

  it('groups same-day shifts together and orders days + shifts earliest first', () => {
    const days = groupShiftsByDay(
      [
        shift({ id: 'wed-pm', starts_at: '2026-06-10T14:00:00Z', ends_at: '2026-06-10T20:00:00Z' }),
        shift({ id: 'tue', starts_at: '2026-06-09T13:00:00Z', ends_at: '2026-06-09T19:00:00Z' }),
        shift({ id: 'wed-am', starts_at: '2026-06-10T08:00:00Z', ends_at: '2026-06-10T12:30:00Z' }),
      ],
      NOW,
    );
    expect(days).toHaveLength(2); // Tuesday + Wednesday
    expect(days[0].shifts.map((s) => s.id)).toEqual(['tue']);
    expect(days[1].shifts.map((s) => s.id)).toEqual(['wed-am', 'wed-pm']);
    expect(days[1].dateIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(days[0].label.length).toBeGreaterThan(0);
  });

  it('returns an empty list when there are no upcoming shifts', () => {
    expect(groupShiftsByDay([], NOW)).toEqual([]);
  });
});

describe('shiftRange', () => {
  it('renders an en-dash separated start–end time', () => {
    const r = shiftRange(shift({ id: 's', starts_at: '2026-06-10T08:00:00Z', ends_at: '2026-06-10T12:30:00Z' }));
    expect(r).toMatch(/^\d{2}:\d{2} – \d{2}:\d{2}$/);
  });

  it('shows an em-dash placeholder for an unparseable timestamp', () => {
    expect(shiftRange(shift({ id: 's', starts_at: 'not-a-date', ends_at: 'nope' }))).toBe('— – —');
  });
});
