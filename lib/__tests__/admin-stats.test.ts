import { describe, it, expect } from 'vitest';
import { filterOrders, summarize, revenueByDay, topProducts, revenueByBranch, statsToCsv, type StatOrder, type StatItem } from '@/lib/admin-stats';

const O = (over: Partial<StatOrder>): StatOrder => ({ status: 'delivered', total_dh: 100, placed_at: '2026-06-10T12:00:00Z', ...over });

describe('admin-stats', () => {
  const orders: StatOrder[] = [
    O({ id: 'a', total_dh: 100, placed_at: '2026-06-10T09:00:00Z', branch_id: 'riad' }),
    O({ id: 'b', total_dh: 200, placed_at: '2026-06-10T20:00:00Z', branch_id: 'badie', status: 'preparing' }),
    O({ id: 'c', total_dh: 999, placed_at: '2026-06-11T10:00:00Z', branch_id: 'riad', status: 'cancelled' }),
    O({ id: 'd', total_dh: 50, placed_at: '2026-06-12T10:00:00Z', branch_id: 'riad' }),
  ];

  it('filters by date range (from inclusive, to exclusive)', () => {
    const r = filterOrders(orders, '2026-06-10T00:00:00Z', '2026-06-11T00:00:00Z');
    expect(r.map((o) => o.id)).toEqual(['a', 'b']);
  });

  it('summarizes sales excluding cancelled', () => {
    const k = summarize(orders);
    expect(k.revenue).toBe(350); // 100 + 200 + 50 (999 cancelled excluded)
    expect(k.orders).toBe(3);
    expect(k.delivered).toBe(2);
    expect(k.avgBasket).toBe(117); // round(350/3)
  });

  it('builds an ascending daily revenue series (cancelled excluded)', () => {
    expect(revenueByDay(orders)).toEqual([
      { day: '2026-06-10', revenue: 300 },
      { day: '2026-06-12', revenue: 50 },
    ]);
  });

  it('ranks top products by revenue', () => {
    const items: StatItem[] = [
      { order_id: 'a', name_snapshot: 'Tarte', qty: 2, price_snapshot: 40 },
      { order_id: 'b', name_snapshot: 'Café', qty: 5, price_snapshot: 15 },
      { order_id: 'd', name_snapshot: 'Tarte', qty: 1, price_snapshot: 40 },
    ];
    expect(topProducts(items)).toEqual([
      { name: 'Tarte', qty: 3, revenue: 120 },
      { name: 'Café', qty: 5, revenue: 75 },
    ]);
  });

  it('aggregates revenue per branch (sales only)', () => {
    const m = revenueByBranch(orders);
    expect(m.get('riad')).toEqual({ revenue: 150, orders: 2 });
    expect(m.get('badie')).toEqual({ revenue: 200, orders: 1 });
  });

  it('exports the daily series as CSV', () => {
    const csv = statsToCsv([{ day: '2026-06-10', revenue: 300 }]);
    expect(csv.split('\n')[1]).toBe('2026-06-10,300');
  });
});
