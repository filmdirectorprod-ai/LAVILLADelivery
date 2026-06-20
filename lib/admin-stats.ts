// Pure, testable aggregation helpers for the admin Statistiques screen. They take
// plain order/item rows (RLS already scopes them to the caller's branch) and a date
// range, and return the figures the screen renders + a CSV export. No React, no I/O.

export interface StatOrder {
  status: string;
  total_dh: number;
  placed_at: string;
  branch_id?: string | null;
  id?: string;
}
export interface StatItem {
  order_id: string;
  name_snapshot: string;
  qty: number;
  price_snapshot: number;
}

/** A non-cancelled order counts towards sales. */
function isSale(o: StatOrder): boolean {
  return o.status !== 'cancelled';
}

/** iso within [fromISO, toISO] (inclusive of from, exclusive of to). */
export function inRange(iso: string, fromISO: string, toISO: string): boolean {
  const t = Date.parse(iso);
  return t >= Date.parse(fromISO) && t < Date.parse(toISO);
}

export function filterOrders(orders: StatOrder[], fromISO: string, toISO: string): StatOrder[] {
  return orders.filter((o) => inRange(o.placed_at, fromISO, toISO));
}

export interface StatKpis {
  revenue: number;
  orders: number;
  avgBasket: number;
  delivered: number;
}

export function summarize(orders: StatOrder[]): StatKpis {
  const sales = orders.filter(isSale);
  const revenue = Math.round(sales.reduce((s, o) => s + (o.total_dh ?? 0), 0));
  const count = sales.length;
  const delivered = orders.filter((o) => o.status === 'delivered').length;
  return { revenue, orders: count, avgBasket: count ? Math.round(revenue / count) : 0, delivered };
}

/** YYYY-MM-DD revenue series, ascending by day, over the sale orders given. */
export function revenueByDay(orders: StatOrder[]): { day: string; revenue: number }[] {
  const map = new Map<string, number>();
  for (const o of orders) {
    if (!isSale(o)) continue;
    const day = o.placed_at.slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + (o.total_dh ?? 0));
  }
  return Array.from(map.entries())
    .map(([day, revenue]) => ({ day, revenue: Math.round(revenue) }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

/** Best-selling products by revenue, from the order_items in scope. */
export function topProducts(items: StatItem[], limit = 8): { name: string; qty: number; revenue: number }[] {
  const map = new Map<string, { qty: number; revenue: number }>();
  for (const it of items) {
    const cur = map.get(it.name_snapshot) ?? { qty: 0, revenue: 0 };
    cur.qty += it.qty;
    cur.revenue += it.price_snapshot * it.qty;
    map.set(it.name_snapshot, cur);
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, qty: v.qty, revenue: Math.round(v.revenue) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

/** Revenue + order count per branch id (sale orders only). */
export function revenueByBranch(orders: StatOrder[]): Map<string, { revenue: number; orders: number }> {
  const map = new Map<string, { revenue: number; orders: number }>();
  for (const o of orders) {
    if (!isSale(o)) continue;
    const key = o.branch_id ?? 'none';
    const cur = map.get(key) ?? { revenue: 0, orders: 0 };
    cur.revenue += o.total_dh ?? 0;
    cur.orders += 1;
    map.set(key, { revenue: Math.round(cur.revenue), orders: cur.orders });
  }
  return map;
}

/** CSV of the daily revenue series (BOM-friendly: caller adds the BOM). */
export function statsToCsv(series: { day: string; revenue: number }[]): string {
  const head = 'Date,Chiffre d\'affaires (DH)';
  const rows = series.map((r) => `${r.day},${r.revenue}`);
  return [head, ...rows].join('\n');
}
