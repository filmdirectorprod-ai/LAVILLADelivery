import { describe, it, expect } from 'vitest';
import { computeOverviewDetail } from '@/lib/admin-overview';
import {
  startOfTodayISO,
  bucketOrdersByHour,
  computeOverviewKpis,
  latestDriverPositions,
  driversToPositions,
} from '@/lib/admin-overview';

describe('startOfTodayISO', () => {
  // Midnight in Fès (UTC+1) is 23:00 UTC the day before. Asserted as an instant,
  // so it holds in any runtime timezone — the server paint and the browser must
  // agree on the boundary.
  it('returns agency midnight of the ref day', () => {
    expect(startOfTodayISO(new Date('2026-06-07T14:30:00.000Z'))).toBe('2026-06-06T23:00:00.000Z');
  });

  it('files an order just after agency midnight under the new day', () => {
    // 23:30 UTC on the 6th is already 00:30 on the 7th in Fès.
    expect(startOfTodayISO(new Date('2026-06-06T23:30:00.000Z'))).toBe('2026-06-06T23:00:00.000Z');
  });

  it('still counts an order just before agency midnight as the old day', () => {
    expect(startOfTodayISO(new Date('2026-06-06T22:30:00.000Z'))).toBe('2026-06-05T23:00:00.000Z');
  });
});

describe('bucketOrdersByHour', () => {
  it('buckets by the hour in the agency timezone (UTC+1), not the runtime one', () => {
    const orders = [
      { placed_at: '2026-06-07T08:05:00.000Z' }, // 09 h in Fès
      { placed_at: '2026-06-07T08:50:00.000Z' }, // 09 h
      { placed_at: '2026-06-07T12:01:00.000Z' }, // 13 h
      { placed_at: '2026-06-06T23:30:00.000Z' }, // 00 h 30 in Fès
    ];
    const buckets = bucketOrdersByHour(orders);
    expect(buckets).toHaveLength(24);
    expect(buckets[9]).toBe(2);
    expect(buckets[13]).toBe(1);
    expect(buckets[0]).toBe(1);
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

describe('driversToPositions', () => {
  const now = new Date('2026-06-20T12:00:00Z');
  const base = { lat: 34.02, lng: -5.01 };
  it('keeps online drivers with a fresh fix; drops offline / stale / no-coords', () => {
    const drivers = [
      { id: 'a', name: 'En ligne récent', is_online: true, ...base, position_at: '2026-06-20T11:59:00Z' },
      { id: 'b', name: 'Hors ligne', is_online: false, ...base, position_at: '2026-06-20T11:59:00Z' },
      { id: 'c', name: 'Position périmée', is_online: true, ...base, position_at: '2026-06-20T11:50:00Z' },
      { id: 'd', name: 'Sans coords', is_online: true, lat: null, lng: null, position_at: '2026-06-20T11:59:30Z' },
    ];
    expect(driversToPositions(drivers, now).map((p) => p.id)).toEqual(['a']);
  });
});

describe('computeOverviewDetail', () => {
  it('compte les statuts, les livrées, le panier moyen hors annulées et l’heure de pointe', () => {
    const orders = [
      { status: 'delivered', total_dh: 100 },
      { status: 'delivered', total_dh: 50 },
      { status: 'cancelled', total_dh: 999 },
      { status: 'en_route', total_dh: 30 },
    ];
    const buckets = new Array(24).fill(0);
    buckets[19] = 3;
    buckets[12] = 1;
    const d = computeOverviewDetail(orders, buckets);
    expect(d.delivered).toBe(2);
    expect(d.statusCounts).toEqual({ delivered: 2, cancelled: 1, en_route: 1 });
    expect(d.avgBasket).toBe(60); // (100 + 50 + 30) / 3, la commande annulée est exclue
    expect(d.peakHour).toBe(19);
  });

  it('n’a ni heure de pointe ni panier sur une journée vide', () => {
    const d = computeOverviewDetail([], new Array(24).fill(0));
    expect(d.peakHour).toBeNull();
    expect(d.avgBasket).toBe(0);
    expect(d.delivered).toBe(0);
    expect(d.statusCounts).toEqual({});
  });
});
