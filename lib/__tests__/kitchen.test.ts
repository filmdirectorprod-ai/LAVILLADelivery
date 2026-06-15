import { describe, it, expect } from 'vitest';
import {
  shortName,
  ticketStation,
  minutesRemaining,
  isLate,
  buildKitchenBoard,
  STATION_CAPACITY,
  type KitchenInput,
} from '@/lib/kitchen';
import type { Order, OrderItem, Universe } from '@/lib/types';

const NOW = new Date('2026-06-08T12:00:00Z');

function mkOrder(p: Partial<Order> & { id: string }): Order {
  return {
    id: p.id,
    code: p.code ?? 'LV-0001',
    user_id: p.user_id ?? 'u1',
    status: p.status ?? 'pending',
    mode: p.mode ?? 'livraison',
    address: p.address ?? 'Fès',
    zone_id: null,
    subtotal_dh: 0,
    delivery_fee_dh: 0,
    discount_dh: 0,
    total_dh: p.total_dh ?? 100,
    points_earned: 0,
    points_redeemed: 0,
    placed_at: p.placed_at ?? '2026-06-08T11:00:00Z',
    eta_at: p.eta_at ?? null,
  };
}

function mkItem(p: Partial<OrderItem> & { id: string; order_id: string }): OrderItem {
  return {
    id: p.id,
    order_id: p.order_id,
    product_id: p.product_id ?? 'prod-1',
    name_snapshot: p.name_snapshot ?? 'Article',
    price_snapshot: p.price_snapshot ?? 30,
    qty: p.qty ?? 1,
    customization: {},
  };
}

describe('shortName', () => {
  it('shortens a two-part name to first + last initial', () => {
    expect(shortName('Mehdi Rahimi')).toBe('Mehdi R.');
  });
  it('returns "Client" for empty/null/whitespace', () => {
    expect(shortName('')).toBe('Client');
    expect(shortName(null)).toBe('Client');
    expect(shortName(undefined)).toBe('Client');
    expect(shortName('   ')).toBe('Client');
  });
  it('keeps a single token as-is', () => {
    expect(shortName('Salma')).toBe('Salma');
  });
  it('uses the last token for 3+ part names', () => {
    expect(shortName('Anna Maria Bensaid')).toBe('Anna B.');
  });
});

describe('ticketStation', () => {
  const uni = (map: Record<string, Universe>) => (id: string | null) => (id ? map[id] ?? null : null);

  it('routes to restaurant when restaurant qty dominates', () => {
    const items = [mkItem({ id: 'a', order_id: 'o', product_id: 'r1', qty: 3 }), mkItem({ id: 'b', order_id: 'o', product_id: 'p1', qty: 1 })];
    expect(ticketStation(items, uni({ r1: 'restaurant', p1: 'patisserie' }))).toBe('restaurant');
  });
  it('breaks a tie toward patisserie', () => {
    const items = [mkItem({ id: 'a', order_id: 'o', product_id: 'r1', qty: 2 }), mkItem({ id: 'b', order_id: 'o', product_id: 'p1', qty: 2 })];
    expect(ticketStation(items, uni({ r1: 'restaurant', p1: 'patisserie' }))).toBe('patisserie');
  });
  it('routes empty items to patisserie', () => {
    expect(ticketStation([], uni({}))).toBe('patisserie');
  });
  it('ignores items with unknown/null universe', () => {
    const items = [mkItem({ id: 'a', order_id: 'o', product_id: null, qty: 5 }), mkItem({ id: 'b', order_id: 'o', product_id: 'r1', qty: 1 })];
    expect(ticketStation(items, uni({ r1: 'restaurant' }))).toBe('restaurant');
  });
});

describe('minutesRemaining', () => {
  it('rounds the delta to minutes', () => {
    expect(minutesRemaining('2026-06-08T12:30:00Z', NOW)).toBe(30);
    expect(minutesRemaining('2026-06-08T11:45:00Z', NOW)).toBe(-15);
  });
  it('returns null for missing/invalid eta', () => {
    expect(minutesRemaining(null, NOW)).toBeNull();
    expect(minutesRemaining('not-a-date', NOW)).toBeNull();
  });
});

describe('isLate', () => {
  it('is true when now is past eta', () => {
    expect(isLate(mkOrder({ id: 'o', eta_at: '2026-06-08T11:00:00Z' }), NOW)).toBe(true);
  });
  it('is false for a future eta', () => {
    expect(isLate(mkOrder({ id: 'o', eta_at: '2026-06-08T13:00:00Z' }), NOW)).toBe(false);
  });
  it('is false when eta is null or invalid', () => {
    expect(isLate(mkOrder({ id: 'o', eta_at: null }), NOW)).toBe(false);
    expect(isLate(mkOrder({ id: 'o', eta_at: 'nope' }), NOW)).toBe(false);
  });
});

describe('buildKitchenBoard', () => {
  const universeOf = (id: string | null): Universe | null => {
    if (id === 'r1') return 'restaurant';
    if (id === 'p1') return 'patisserie';
    return null;
  };

  function board(orders: Order[], itemsByOrder: Map<string, OrderItem[]>, nameOf?: (u: string) => string | null) {
    const input: KitchenInput = { orders, itemsByOrder, universeOf, nameOf, now: NOW };
    return buildKitchenBoard(input);
  }

  it('splits orders into columns by status', () => {
    const orders = [
      mkOrder({ id: 'o1', status: 'pending' }),
      mkOrder({ id: 'o2', status: 'preparing' }),
      mkOrder({ id: 'o3', status: 'ready' }),
    ];
    const items = new Map<string, OrderItem[]>([
      ['o1', [mkItem({ id: 'i1', order_id: 'o1', product_id: 'p1' })]],
      ['o2', [mkItem({ id: 'i2', order_id: 'o2', product_id: 'p1' })]],
      ['o3', [mkItem({ id: 'i3', order_id: 'o3', product_id: 'p1' })]],
    ]);
    const b = board(orders, items);
    expect(b.pending.map((t) => t.order.id)).toEqual(['o1']);
    expect(b.preparing.map((t) => t.order.id)).toEqual(['o2']);
    expect(b.ready.map((t) => t.order.id)).toEqual(['o3']);
  });

  it('computes item counts and short customer names', () => {
    const orders = [mkOrder({ id: 'o1', status: 'pending', user_id: 'u9' })];
    const items = new Map([['o1', [mkItem({ id: 'i1', order_id: 'o1', product_id: 'p1', qty: 2 }), mkItem({ id: 'i2', order_id: 'o1', product_id: 'p1', qty: 3 })]]]);
    const b = board(orders, items, (u) => (u === 'u9' ? 'Mehdi Rahimi' : null));
    expect(b.pending[0].itemCount).toBe(5);
    expect(b.pending[0].customerName).toBe('Mehdi R.');
  });

  it('aggregates active orders into station load (pending + preparing only)', () => {
    const orders = [
      mkOrder({ id: 'o1', status: 'pending' }),
      mkOrder({ id: 'o2', status: 'preparing' }),
      mkOrder({ id: 'o3', status: 'ready' }), // ready must NOT count toward load
    ];
    const items = new Map([
      ['o1', [mkItem({ id: 'i1', order_id: 'o1', product_id: 'p1' })]],
      ['o2', [mkItem({ id: 'i2', order_id: 'o2', product_id: 'p1' })]],
      ['o3', [mkItem({ id: 'i3', order_id: 'o3', product_id: 'p1' })]],
    ]);
    const b = board(orders, items);
    const pat = b.stations.find((s) => s.station === 'patisserie')!;
    expect(pat.active).toBe(2);
    expect(pat.capacity).toBe(STATION_CAPACITY.patisserie);
    expect(pat.loadPct).toBe(Math.round((2 / 4) * 100));
    expect(pat.saturated).toBe(false);
  });

  it('caps loadPct at 100 and flags saturation when active >= capacity', () => {
    const orders = Array.from({ length: 5 }, (_, i) => mkOrder({ id: `o${i}`, status: 'pending' }));
    const items = new Map(orders.map((o) => [o.id, [mkItem({ id: `i${o.id}`, order_id: o.id, product_id: 'p1' })]]));
    const b = board(orders, items);
    const pat = b.stations.find((s) => s.station === 'patisserie')!;
    expect(pat.active).toBe(5);
    expect(pat.loadPct).toBe(100);
    expect(pat.saturated).toBe(true);
  });

  it('waitMinutes is the max positive remaining ETA among active tickets', () => {
    const orders = [
      mkOrder({ id: 'o1', status: 'preparing', eta_at: '2026-06-08T12:20:00Z' }),
      mkOrder({ id: 'o2', status: 'preparing', eta_at: '2026-06-08T12:45:00Z' }),
      mkOrder({ id: 'o3', status: 'preparing', eta_at: '2026-06-08T11:50:00Z' }), // past → ignored
    ];
    const items = new Map(orders.map((o) => [o.id, [mkItem({ id: `i${o.id}`, order_id: o.id, product_id: 'p1' })]]));
    const b = board(orders, items);
    const pat = b.stations.find((s) => s.station === 'patisserie')!;
    expect(pat.waitMinutes).toBe(45);
  });

  it('defaults waitMinutes to 0 when no positive ETAs', () => {
    const orders = [mkOrder({ id: 'o1', status: 'preparing', eta_at: null })];
    const items = new Map([['o1', [mkItem({ id: 'i1', order_id: 'o1', product_id: 'p1' })]]]);
    const b = board(orders, items);
    const pat = b.stations.find((s) => s.station === 'patisserie')!;
    expect(pat.waitMinutes).toBe(0);
  });

  it('lists late codes only for active orders; ready is never late', () => {
    const orders = [
      mkOrder({ id: 'o1', code: 'LV-A', status: 'pending', eta_at: '2026-06-08T11:00:00Z' }), // late
      mkOrder({ id: 'o2', code: 'LV-B', status: 'preparing', eta_at: '2026-06-08T13:00:00Z' }), // on time
      mkOrder({ id: 'o3', code: 'LV-C', status: 'ready', eta_at: '2026-06-08T10:00:00Z' }), // past eta but ready → not late
    ];
    const items = new Map(orders.map((o) => [o.id, [mkItem({ id: `i${o.id}`, order_id: o.id, product_id: 'p1' })]]));
    const b = board(orders, items);
    expect(b.lateCodes).toEqual(['LV-A']);
    expect(b.ready[0].late).toBe(false);
  });

  it('handles orders with no items map entry gracefully', () => {
    const orders = [mkOrder({ id: 'o1', status: 'pending' })];
    const b = board(orders, new Map());
    expect(b.pending[0].items).toEqual([]);
    expect(b.pending[0].itemCount).toBe(0);
    expect(b.pending[0].station).toBe('patisserie');
  });
});
