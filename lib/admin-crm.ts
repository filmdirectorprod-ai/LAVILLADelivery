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
