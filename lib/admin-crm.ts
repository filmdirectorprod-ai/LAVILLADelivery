// Pure, testable CRM aggregation. Builds one row per customer who has ordered (in
// the RLS-scoped order set), enriched with profile info, total spend, order count,
// last-order date, loyalty, a segment and the saved note. No React, no I/O.

export interface CrmOrder {
  id: string;
  user_id: string;
  code: string;
  status: string;
  total_dh: number;
  placed_at: string;
}
export interface CrmProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  loyalty_points: number | null;
  loyalty_tier: string | null;
  crm_note: string | null;
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

const isSale = (o: CrmOrder): boolean => o.status !== 'cancelled';

export function buildCustomerRows(orders: CrmOrder[], profiles: CrmProfile[]): CustomerRow[] {
  const byUser = new Map<string, { orders: number; spend: number; last: string | null }>();
  for (const o of orders) {
    if (!isSale(o)) continue;
    const cur = byUser.get(o.user_id) ?? { orders: 0, spend: 0, last: null };
    cur.orders += 1;
    cur.spend += o.total_dh ?? 0;
    if (!cur.last || o.placed_at > cur.last) cur.last = o.placed_at;
    byUser.set(o.user_id, cur);
  }
  const profById = new Map(profiles.map((p) => [p.id, p]));
  const rows: CustomerRow[] = [];
  byUser.forEach((agg, userId) => {
    const p = profById.get(userId);
    rows.push({
      id: userId,
      name: p?.full_name?.trim() || 'Client',
      phone: p?.phone ?? null,
      orders: agg.orders,
      spend: Math.round(agg.spend),
      lastOrder: agg.last,
      points: p?.loyalty_points ?? 0,
      tier: p?.loyalty_tier ?? null,
      segment: segmentFor(agg.spend, agg.orders),
      note: p?.crm_note ?? null,
    });
  });
  return rows.sort((a, b) => b.spend - a.spend);
}

/** Case-insensitive filter on name or phone. */
export function filterCustomers(rows: CustomerRow[], query: string): CustomerRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => r.name.toLowerCase().includes(q) || (r.phone ?? '').toLowerCase().includes(q));
}
