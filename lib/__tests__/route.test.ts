import { describe, it, expect } from 'vitest';
import { LV_ROUTE, lvPosAt, LV_ROUTE_TOTAL_KM, LV_ROUTE_TOTAL_MIN } from '@/lib/route';

describe('lvPosAt', () => {
  it('returns start at 0 and end at 1', () => {
    expect(lvPosAt(0)).toMatchObject({ x: 17.5, y: 78.6 });
    expect(lvPosAt(1)).toMatchObject({ x: 57.5, y: 33.9 });
  });

  it('clamps out-of-range', () => {
    expect(lvPosAt(-1)).toMatchObject({ x: 17.5 });
    expect(lvPosAt(2)).toMatchObject({ x: 57.5 });
  });

  it('interpolates the midpoint of a segment', () => {
    // p=0.1 -> f=0.5 -> between point 0 and 1
    const m = lvPosAt(0.1);
    expect(m.x).toBeCloseTo(17.5 + (27 - 17.5) * 0.5, 5);
    expect(m.y).toBeCloseTo(78.6 + (71 - 78.6) * 0.5, 5);
  });

  it('exposes route totals', () => {
    expect(LV_ROUTE).toHaveLength(6);
    expect(LV_ROUTE_TOTAL_KM).toBe(3.2);
    expect(LV_ROUTE_TOTAL_MIN).toBe(28);
  });
});
