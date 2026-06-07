import { describe, it, expect } from 'vitest';
import { buildAdminOrderRows, filterAdminOrders } from '@/lib/admin-orders';
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
