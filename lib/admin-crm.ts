// Shapes + pure helpers for the admin CRM screen.
//
// The per-customer aggregation now happens in Postgres (admin_customer_rows,
// 0051); the screen used to download every order and every profile and group
// them here, which grew without bound and silently truncated at PostgREST's
// 1000-row cap. `segmentFor` is kept as the single readable statement of the
// segment rule the SQL implements — keep the two in step.

export interface CrmOrder {
  id: string;
  user_id: string;
  code: string;
  status: string;
  total_dh: number;
  placed_at: string;
}
export type Segment = 'VIP' | 'Régulier' | 'Nouveau';

export interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  orders: number;
  spend: number;
  lastOrder: string | null;
  points: number;
  tier: string | null;
  segment: Segment;
  note: string | null;
}

export function segmentFor(spend: number, orders: number): Segment {
  if (spend >= 1000 || orders >= 10) return 'VIP';
  if (orders >= 3) return 'Régulier';
  return 'Nouveau';
}

/** Case-insensitive filter on name or phone. */
export function filterCustomers(rows: CustomerRow[], query: string): CustomerRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => r.name.toLowerCase().includes(q) || (r.phone ?? '').toLowerCase().includes(q));
}
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export type CustomerSort = 'spend' | 'orders' | 'recent';
export const SEGMENTS: Segment[] = ['VIP', 'Régulier', 'Nouveau'];
/** A customer with no order for this long is "à relancer". */
export const DORMANT_DAYS = 30;

/** Whole days since `iso`, or null without a date. */
export function daysSince(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / 86400000));
}

export function isDormant(row: CustomerRow, now: Date = new Date()): boolean {
  const d = daysSince(row.lastOrder, now);
  return row.orders > 0 && d !== null && d >= DORMANT_DAYS;
}

/** Search (accent-insensitive name or phone), segment filter ('dormant' = à relancer) and sort. */
export function queryCustomers(rows: CustomerRow[], query: string, segment: Segment | 'all' | 'dormant', sort: CustomerSort, now: Date = new Date()): CustomerRow[] {
  const q = fold(query.trim());
  const out = rows.filter((r) => {
    if (segment === 'dormant' ? !isDormant(r, now) : segment !== 'all' && r.segment !== segment) return false;
    return !q || fold(r.name).includes(q) || (r.phone ?? '').replace(/\s+/g, '').includes(q.replace(/\s+/g, ''));
  });
  const recent = (r: CustomerRow) => (r.lastOrder ? Date.parse(r.lastOrder) : 0);
  return out.sort((a, b) => (sort === 'orders' ? b.orders - a.orders : sort === 'recent' ? recent(b) - recent(a) : b.spend - a.spend) || a.name.localeCompare(b.name));
}

export interface CrmTotals {
  customers: number;
  bySegment: Record<Segment, number>;
  spend: number;
  /** Mean spend per customer with at least one order. */
  avgSpend: number;
  dormant: number;
}

export function crmTotals(rows: CustomerRow[], now: Date = new Date()): CrmTotals {
  const bySegment: Record<Segment, number> = { VIP: 0, 'Régulier': 0, Nouveau: 0 };
  let spend = 0;
  let buyers = 0;
  let dormant = 0;
  for (const r of rows) {
    bySegment[r.segment] += 1;
    spend += Number(r.spend) || 0;
    if (r.orders > 0) buyers += 1;
    if (isDormant(r, now)) dormant += 1;
  }
  return { customers: rows.length, bySegment, spend, avgSpend: buyers ? Math.round(spend / buyers) : 0, dormant };
}
