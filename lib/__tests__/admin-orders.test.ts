import { describe, it, expect } from 'vitest';
import {
  buildAdminOrderRows,
  filterAdminOrders,
  filterAdminOrdersByTab,
  countOrdersByTab,
  orderMatchesTab,
  orderItemsSummary,
  orderItemCount,
  ordersToCsv,
  pickAutoAssignments,
} from '@/lib/admin-orders';
import type { Order, OrderItem, OrderTracking } from '@/lib/types';

function order(p: Partial<Order> & { id: string }): Order {
  return {
    id: p.id,
    code: p.code ?? 'LV-0001',
    user_id: p.user_id ?? 'u1',
    status: p.status ?? 'preparing',
    mode: p.mode ?? 'livraison',
    address: p.address ?? 'Fès',
    zone_id: null,
    subtotal_dh: 0,
    delivery_fee_dh: 0,
    discount_dh: 0,
    total_dh: p.total_dh ?? 100,
    points_earned: 0,
    points_redeemed: 0,
    placed_at: p.placed_at ?? '2026-06-07T10:00:00Z',
    eta_at: null,
  };
}

describe('buildAdminOrderRows', () => {
  const orders = [order({ id: 'o1', code: 'LV-0001', user_id: 'u1', status: 'ready' }), order({ id: 'o2', code: 'LV-0002', user_id: 'u2' })];
  const items: OrderItem[] = [
    { id: 'i1', order_id: 'o1', product_id: 'p1', name_snapshot: 'Tarte', price_snapshot: 40, qty: 2, customization: {} },
    { id: 'i2', order_id: 'o2', product_id: 'p2', name_snapshot: 'Café', price_snapshot: 15, qty: 1, customization: {} },
  ];
  const tracking: OrderTracking[] = [
    { order_id: 'o1', stage: 1, progress: 0.3, eta_at: null, driver_id: 'd1', lat: null, lng: null, manual: true, updated_at: '2026-06-07T10:01:00Z' },
  ];
  const drivers = [{ id: 'd1', name: 'Karim' }];
  const profiles = [{ id: 'u1', full_name: 'Salma' }, { id: 'u2', full_name: 'Omar' }];

  it('groups items, resolves customer + driver names, matches tracking', () => {
    const rows = buildAdminOrderRows(orders, items, tracking, drivers, profiles);
    expect(rows).toHaveLength(2);
    expect(rows[0].order.id).toBe('o1');
    expect(rows[0].items.map((i) => i.name_snapshot)).toEqual(['Tarte']);
    expect(rows[0].customerName).toBe('Salma');
    expect(rows[0].driverName).toBe('Karim');
    expect(rows[0].tracking?.driver_id).toBe('d1');
  });

  it('leaves driverName/tracking null when no tracking row exists', () => {
    const rows = buildAdminOrderRows(orders, items, tracking, drivers, profiles);
    expect(rows[1].tracking).toBeNull();
    expect(rows[1].driverName).toBeNull();
    expect(rows[1].customerName).toBe('Omar');
  });
});

describe('filterAdminOrders', () => {
  const orders = [order({ id: 'o1', code: 'LV-1001', status: 'preparing' }), order({ id: 'o2', code: 'LV-2002', status: 'delivered' })];
  const rows = buildAdminOrderRows(orders, [], [], [], []);

  it('returns everything for status "all" and an empty query', () => {
    expect(filterAdminOrders(rows, { status: 'all', query: '' })).toHaveLength(2);
  });

  it('filters by status', () => {
    const r = filterAdminOrders(rows, { status: 'delivered', query: '' });
    expect(r.map((x) => x.order.id)).toEqual(['o2']);
  });

  it('matches the code case-insensitively and trims the query', () => {
    const r = filterAdminOrders(rows, { status: 'all', query: '  lv-10  ' });
    expect(r.map((x) => x.order.id)).toEqual(['o1']);
  });
});

function track(p: Partial<OrderTracking> & { order_id: string }): OrderTracking {
  return {
    order_id: p.order_id,
    stage: 1,
    progress: 0,
    eta_at: null,
    driver_id: p.driver_id ?? null,
    lat: null,
    lng: null,
    manual: false,
    updated_at: '2026-06-07T10:00:00Z',
  };
}

describe('order tabs', () => {
  // o1 preparing no driver, o2 ready no driver, o3 en_route w/ driver, o4 delivered, o5 cancelled
  const orders = [
    order({ id: 'o1', code: 'LV-1', status: 'preparing', placed_at: '2026-06-07T10:00:00Z' }),
    order({ id: 'o2', code: 'LV-2', status: 'ready', placed_at: '2026-06-07T09:00:00Z' }),
    order({ id: 'o3', code: 'LV-3', status: 'en_route' }),
    order({ id: 'o4', code: 'LV-4', status: 'delivered' }),
    order({ id: 'o5', code: 'LV-5', status: 'cancelled' }),
  ];
  const tracking = [track({ order_id: 'o3', driver_id: 'd1' })];
  const rows = buildAdminOrderRows(orders, [], tracking, [{ id: 'd1', name: 'Karim' }], []);

  it('classifies rows by tab', () => {
    expect(orderMatchesTab(rows[0], 'active')).toBe(true);
    expect(orderMatchesTab(rows[0], 'unassigned')).toBe(true);
    expect(orderMatchesTab(rows[2], 'unassigned')).toBe(false); // has driver
    expect(orderMatchesTab(rows[3], 'done')).toBe(true);
  });

  it('counts each tab', () => {
    expect(countOrdersByTab(rows)).toEqual({ all: 5, active: 3, unassigned: 2, done: 2 });
  });

  it('filters by tab + query', () => {
    expect(filterAdminOrdersByTab(rows, 'unassigned', '').map((r) => r.order.id)).toEqual(['o1', 'o2']);
    expect(filterAdminOrdersByTab(rows, 'all', 'lv-3').map((r) => r.order.id)).toEqual(['o3']);
  });
});

describe('order item helpers', () => {
  const items: OrderItem[] = [
    { id: 'i1', order_id: 'o1', product_id: 'p1', name_snapshot: 'Tarte', price_snapshot: 40, qty: 2, customization: {} },
    { id: 'i2', order_id: 'o1', product_id: 'p2', name_snapshot: 'Café', price_snapshot: 15, qty: 1, customization: {} },
    { id: 'i3', order_id: 'o1', product_id: 'p3', name_snapshot: 'Eau', price_snapshot: 5, qty: 3, customization: {} },
  ];

  it('summarises and counts', () => {
    expect(orderItemCount(items)).toBe(6);
    expect(orderItemsSummary([])).toBe('—');
    expect(orderItemsSummary(items.slice(0, 2))).toBe('2 × Tarte · 1 × Café');
    expect(orderItemsSummary(items)).toBe('2 × Tarte · 1 × Café +1');
  });
});

describe('ordersToCsv', () => {
  const orders = [order({ id: 'o1', code: 'LV-1', total_dh: 120, status: 'delivered' })];
  const items: OrderItem[] = [
    { id: 'i1', order_id: 'o1', product_id: 'p1', name_snapshot: 'Tarte', price_snapshot: 40, qty: 2, customization: {} },
  ];
  const rows = buildAdminOrderRows(orders, items, [], [], [{ id: 'u1', full_name: 'Salma' }]);

  it('emits a header plus one quoted line per order', () => {
    const csv = ordersToCsv(rows);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('"Code"');
    expect(lines[1]).toContain('"LV-1"');
    expect(lines[1]).toContain('"Salma"');
    expect(lines[1]).toContain('"2"');
    expect(lines[1]).toContain('"120"');
  });
});

describe('pickAutoAssignments', () => {
  const orders = [
    order({ id: 'o1', status: 'ready', placed_at: '2026-06-07T09:00:00Z' }),
    order({ id: 'o2', status: 'preparing', placed_at: '2026-06-07T10:00:00Z' }),
    order({ id: 'o3', status: 'en_route' }),
  ];
  const tracking = [track({ order_id: 'o3', driver_id: 'd9' })];
  const rows = buildAdminOrderRows(orders, [], tracking, [], []);

  it('round-robins unassigned orders across online drivers, oldest first', () => {
    expect(pickAutoAssignments(rows, ['d1', 'd2'])).toEqual([
      { orderId: 'o1', driverId: 'd1' },
      { orderId: 'o2', driverId: 'd2' },
    ]);
  });

  it('returns nothing when no online drivers', () => {
    expect(pickAutoAssignments(rows, [])).toEqual([]);
  });
});
