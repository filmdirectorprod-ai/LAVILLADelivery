import { describe, it, expect } from 'vitest';
import { computeDriverDayStats, buildDriverRows, driverRoutesToCsv } from '@/lib/admin-drivers';
import type { Driver } from '@/lib/types';

function driver(over: Partial<Driver> & { id: string; name: string }): Driver {
  return {
    avatar_url: null,
    vehicle: null,
    rating: 5,
    phone: null,
    user_id: null,
    is_online: false,
    last_seen: null,
    ...over,
  };
}

describe('computeDriverDayStats', () => {
  const orders = [
    { id: 'o1', status: 'delivered', delivery_fee_dh: 15 },
    { id: 'o2', status: 'delivered', delivery_fee_dh: 20 },
    { id: 'o3', status: 'en_route', delivery_fee_dh: 99 }, // not delivered → ignored
    { id: 'o4', status: 'delivered', delivery_fee_dh: 0 }, // pickup → counts, 0 earnings
    { id: 'o5', status: 'delivered', delivery_fee_dh: 10 }, // no tracking → ignored
  ];
  const tracking = [
    { order_id: 'o1', driver_id: 'd1' },
    { order_id: 'o2', driver_id: 'd1' },
    { order_id: 'o3', driver_id: 'd1' },
    { order_id: 'o4', driver_id: 'd2' },
    { order_id: 'o5', driver_id: null }, // unassigned
  ];

  it('counts delivered orders and sums delivery fees per driver', () => {
    const stats = computeDriverDayStats(orders, tracking);
    expect(stats.get('d1')).toEqual({ deliveries: 2, earnings: 35 });
    expect(stats.get('d2')).toEqual({ deliveries: 1, earnings: 0 });
  });

  it('ignores orders without a driver on their tracking row', () => {
    const stats = computeDriverDayStats(orders, tracking);
    expect(Array.from(stats.keys()).sort()).toEqual(['d1', 'd2']);
  });

  it('returns an empty map for no orders', () => {
    expect(computeDriverDayStats([], tracking).size).toBe(0);
  });
});

describe('buildDriverRows', () => {
  const drivers = [
    driver({ id: 'd1', name: 'Karim', is_online: false }),
    driver({ id: 'd2', name: 'Yassine', is_online: true }),
    driver({ id: 'd3', name: 'Omar', is_online: true }),
  ];
  const orders = [
    { id: 'o1', status: 'delivered', delivery_fee_dh: 15 },
    { id: 'o2', status: 'delivered', delivery_fee_dh: 20 },
  ];
  const tracking = [
    { order_id: 'o1', driver_id: 'd3' },
    { order_id: 'o2', driver_id: 'd3' },
  ];

  it('attaches today stats to every driver, defaulting to zero', () => {
    const rows = buildDriverRows(drivers, orders, tracking);
    const byId = Object.fromEntries(rows.map((r) => [r.driver.id, r]));
    expect(byId.d3).toMatchObject({ deliveries: 2, earnings: 35 });
    expect(byId.d1).toMatchObject({ deliveries: 0, earnings: 0 });
  });

  it('sorts online first, then by most deliveries, then by name', () => {
    const rows = buildDriverRows(drivers, orders, tracking);
    expect(rows.map((r) => r.driver.id)).toEqual(['d3', 'd2', 'd1']);
    // d3 & d2 online (d3 has more deliveries → first); d1 offline last.
  });

  it('attaches the current route from active orders, null when none', () => {
    const active = [{ id: 'a1', code: 'LV-9', status: 'en_route' }];
    const activeTracking = [...tracking, { order_id: 'a1', driver_id: 'd2' }];
    const rows = buildDriverRows(drivers, orders, activeTracking, active);
    const byId = Object.fromEntries(rows.map((r) => [r.driver.id, r]));
    expect(byId.d2.currentRoute).toEqual({ code: 'LV-9', status: 'en_route' });
    expect(byId.d1.currentRoute).toBeNull();
  });

  it('exports a tournées CSV with a header and one row per driver', () => {
    const rows = buildDriverRows(drivers, orders, tracking);
    const lines = driverRoutesToCsv(rows).split('\n');
    expect(lines[0]).toContain('"Livreur"');
    expect(lines).toHaveLength(1 + rows.length);
  });
});
