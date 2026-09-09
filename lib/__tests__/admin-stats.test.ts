import { describe, it, expect } from 'vitest';
import {
  rangeWindow, daysFor, revenueDelta, toSnapshot, statsToCsv, EMPTY_SNAPSHOT,
} from '@/lib/admin-stats';

describe('admin-stats', () => {
  const now = new Date('2026-06-12T15:00:00Z');

  it('spans the last N days, with the preceding window for the trend', () => {
    const w = rangeWindow('7d', now);
    expect(w.from).toBe('2026-06-05T15:00:00.000Z');
    expect(w.prevFrom).toBe('2026-05-29T15:00:00.000Z');
    expect(Date.parse(w.to)).toBeGreaterThan(now.getTime()); // `to` is exclusive
  });

  // Fès is UTC+1, so its midnight is 23:00 UTC the day before. Asserted as an
  // instant, not with getHours(), so the test does not depend on the runner's TZ.
  it('starts "today" at midnight in the agency timezone', () => {
    expect(rangeWindow('today', now).from).toBe('2026-06-11T23:00:00.000Z');
  });

  it('keeps the previous window the same length as the current one', () => {
    const w = rangeWindow('today', now);
    const span = Date.parse(w.from) - Date.parse(w.prevFrom);
    expect(span).toBe(24 * 60 * 60 * 1000);
  });

  it('maps range keys to day counts', () => {
    expect(daysFor('30d')).toBe(30);
    expect(daysFor('90d')).toBe(90);
  });

  it('computes the revenue trend, or null without a baseline', () => {
    expect(revenueDelta({ ...EMPTY_SNAPSHOT, kpis: { ...EMPTY_SNAPSHOT.kpis, revenue: 150 }, prevRevenue: 100 })).toBe(50);
    expect(revenueDelta({ ...EMPTY_SNAPSHOT, kpis: { ...EMPTY_SNAPSHOT.kpis, revenue: 80 }, prevRevenue: 100 })).toBe(-20);
    expect(revenueDelta({ ...EMPTY_SNAPSHOT, prevRevenue: 0 })).toBeNull();
  });

  it('normalises a partial or missing RPC payload', () => {
    expect(toSnapshot(null)).toEqual(EMPTY_SNAPSHOT);
    const s = toSnapshot({ kpis: { revenue: 10 }, series: [{ day: '2026-06-10', revenue: 10 }] });
    expect(s.kpis.revenue).toBe(10);
    expect(s.kpis.orders).toBe(0);
    expect(s.series).toHaveLength(1);
    expect(s.byBranch).toEqual({});
  });

  it('exports the daily series as CSV', () => {
    const csv = statsToCsv([{ day: '2026-06-10', revenue: 300 }]);
    expect(csv.split('\n')[1]).toBe('2026-06-10,300');
  });
});
