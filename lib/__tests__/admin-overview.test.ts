import { describe, it, expect } from 'vitest';
import {
  startOfTodayISO,
  bucketOrdersByHour,
  computeOverviewKpis,
  latestDriverPositions,
} from '@/lib/admin-overview';

describe('startOfTodayISO', () => {
  it('returns UTC midnight of the ref day (timezone-independent)', () => {
    // Constructed in UTC so the assertion holds in any runtime timezone — the
    // helper must produce the same boundary on a UTC server and a UTC+1 browser.
    const ref = new Date('2026-06-07T14:30:00.000Z');
    expect(startOfTodayISO(ref)).toBe('2026-06-07T00:00:00.000Z');
  });

  it('rolls to the correct UTC day for an evening UTC timestamp', () => {
    const ref = new Date('2026-06-07T23:59:59.000Z');
    expect(startOfTodayISO(ref)).toBe('2026-06-07T00:00:00.000Z');
  });
});

describe('bucketOrdersByHour', () => {
  it('counts orders into 24 hour buckets by placed_at local hour', () => {
    const orders = [
      { placed_at: new Date(2026, 5, 7, 9, 5).toISOString() },
      { placed_at: new Date(2026, 5, 7, 9, 50).toISOString() },
      { placed_at: new Date(2026, 5, 7, 13, 1).toISOString() },
    ];
    const buckets = bucketOrdersByHour(orders);
    expect(buckets).toHaveLength(24);
    expect(buckets[9]).toBe(2);
    expect(buckets[13]).toBe(1);
    expect(buckets[0]).toBe(0);
  });

  it('returns 24 zeros for no orders', () => {
    expect(bucketOrdersByHour([])).toEqual(new Array(24).fill(0));
  });
});

describe('computeOverviewKpis', () => {
  const orders = [
    { status: 'preparing', total_dh: 100 },
    { status: 'ready', total_dh: 75 },
    { status: 'en_route', total_dh: 50 },
    { status: 'delivered', total_dh: 200 },
    { status: 'cancelled', total_dh: 999 },
  ];
  const drivers = [
    { is_online: true },
    { is_online: true },
    { is_online: false },
  ];
  const ratings = [5, 4, 3];

  it('counts today orders and in-progress orders', () => {
    const k = computeOverviewKpis({ orders, drivers, ratings });
    expect(k.ordersToday).toBe(5);
    expect(k.inProgress).toBe(3); // preparing + ready + en_route
  });

  it('sums revenue of non-cancelled orders only', () => {
    const k = computeOverviewKpis({ orders, drivers, ratings });
    expect(k.revenueToday).toBe(425); // 100 + 75 + 50 + 200
  });

  it('reports online / total drivers', () => {
    const k = computeOverviewKpis({ orders, drivers, ratings });
    expect(k.driversOnline).toBe(2);
    expect(k.driversTotal).toBe(3);
  });

  it('averages ratings and counts them', () => {
    const k = computeOverviewKpis({ orders, drivers, ratings });
    expect(k.ratingAvg).toBeCloseTo(4, 5);
    expect(k.ratingCount).toBe(3);
  });

  it('returns ratingAvg 0 when there are no ratings', () => {
    const k = computeOverviewKpis({ orders, drivers: [], ratings: [] });
    expect(k.ratingAvg).toBe(0);
    expect(k.ratingCount).toBe(0);
  });
});

describe('latestDriverPositions', () => {
  it('returns one newest position per online driver that has coords', () => {
    const drivers = [
      { id: 'd1', name: 'Karim', is_online: true },
      { id: 'd2', name: 'Yassine', is_online: false }, // offline → excluded
      { id: 'd3', name: 'Omar', is_online: true }, // no tracking → excluded
    ];
    const tracking = [
      { driver_id: 'd1', lat: 34.01, lng: -5.0, updated_at: '2026-06-07T10:00:00Z' },
      { driver_id: 'd1', lat: 34.04, lng: -4.99, updated_at: '2026-06-07T10:05:00Z' }, // newer
      { driver_id: 'd2', lat: 34.02, lng: -4.98, updated_at: '2026-06-07T10:01:00Z' },
    ];
    const pts = latestDriverPositions(drivers, tracking);
    expect(pts).toHaveLength(1);
    expect(pts[0]).toEqual({ id: 'd1', name: 'Karim', lat: 34.04, lng: -4.99 });
  });

  it('ignores tracking rows with null coords', () => {
    const drivers = [{ id: 'd1', name: 'Karim', is_online: true }];
    const tracking = [{ driver_id: 'd1', lat: null, lng: null, updated_at: '2026-06-07T10:00:00Z' }];
    expect(latestDriverPositions(drivers, tracking)).toEqual([]);
  });
});
