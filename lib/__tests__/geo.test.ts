import { describe, it, expect } from 'vitest';
import { pointInPolygon, zoneForPoint, maxFeeZone, resolveZone, type ZoneGeo, type PolygonPoint } from '@/lib/geo';

// A simple unit square from (0,0) to (2,2) in [lng, lat] order.
const square: PolygonPoint[] = [
  [0, 0],
  [2, 0],
  [2, 2],
  [0, 2],
];

describe('pointInPolygon', () => {
  it('detects a point inside', () => {
    expect(pointInPolygon(1, 1, square)).toBe(true);
  });
  it('detects a point outside', () => {
    expect(pointInPolygon(3, 3, square)).toBe(false);
    expect(pointInPolygon(1, -1, square)).toBe(false);
  });
});

const zones: ZoneGeo[] = [
  { id: 'a', name: 'A', fee_dh: 12, polygon: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  { id: 'b', name: 'B', fee_dh: 20, polygon: [[2, 2], [3, 2], [3, 3], [2, 3]] },
  { id: 'c', name: 'C (no poly)', fee_dh: 18, polygon: null },
];

describe('zoneForPoint', () => {
  it('returns the containing zone', () => {
    expect(zoneForPoint(0.5, 0.5, zones)?.id).toBe('a');
    expect(zoneForPoint(2.5, 2.5, zones)?.id).toBe('b');
  });
  it('returns null when no polygon contains the point', () => {
    expect(zoneForPoint(9, 9, zones)).toBeNull();
  });
  it('skips zones without a polygon', () => {
    expect(zoneForPoint(5, 5, zones)).toBeNull();
  });
});

describe('maxFeeZone', () => {
  it('returns the most expensive zone', () => {
    expect(maxFeeZone(zones)?.id).toBe('b'); // 20 DH
  });
  it('returns null for an empty list', () => {
    expect(maxFeeZone([])).toBeNull();
  });
});

describe('resolveZone', () => {
  it('matches a covered point (not out of area)', () => {
    const r = resolveZone(0.5, 0.5, zones);
    expect(r.zone?.id).toBe('a');
    expect(r.outOfArea).toBe(false);
  });
  it('falls back to the max-fee zone when out of area', () => {
    const r = resolveZone(9, 9, zones);
    expect(r.zone?.id).toBe('b');
    expect(r.outOfArea).toBe(true);
  });
});
