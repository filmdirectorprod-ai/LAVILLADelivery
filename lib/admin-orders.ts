// Pure builders/filters for the admin Commandes screen. Shared by the server
// first-paint query and the client realtime refetch so both produce identical
// rows from the same raw Supabase shapes. No React, no I/O.
import type { Order, OrderItem, OrderStatus, OrderTracking } from '@/lib/types';

export interface AdminOrderRow {
  order: Order;
  items: OrderItem[];
  tracking: OrderTracking | null;
  customerName: string | null;
  driverName: string | null;
}

interface NamedDriver {
  id: string;
  name: string;
}
interface NamedProfile {
  id: string;
  full_name: string | null;
}

/** Join raw rows into per-order detail, preserving the `orders` order. */
export function buildAdminOrderRows(
  orders: Order[],
  items: OrderItem[],
  tracking: OrderTracking[],
  drivers: NamedDriver[],
  profiles: NamedProfile[],
): AdminOrderRow[] {
  const itemsByOrder = new Map<string, OrderItem[]>();
  for (const it of items) {
    const list = itemsByOrder.get(it.order_id);
    if (list) list.push(it);
    else itemsByOrder.set(it.order_id, [it]);
  }
  const trackingByOrder = new Map<string, OrderTracking>();
  for (const t of tracking) trackingByOrder.set(t.order_id, t);
  const driverName = new Map(drivers.map((d) => [d.id, d.name]));
  const customerName = new Map(profiles.map((p) => [p.id, p.full_name]));

  return orders.map((order) => {
    const t = trackingByOrder.get(order.id) ?? null;
    return {
      order,
      items: itemsByOrder.get(order.id) ?? [],
      tracking: t,
      customerName: customerName.get(order.user_id) ?? null,
      driverName: t?.driver_id ? driverName.get(t.driver_id) ?? null : null,
    };
  });
}

export interface AdminOrdersFilter {
  status: OrderStatus | 'all';
  query: string;
}

/** Client-side filter by status and order-code substring (case-insensitive). */
export function filterAdminOrders(rows: AdminOrderRow[], filter: AdminOrdersFilter): AdminOrderRow[] {
  const q = filter.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (filter.status !== 'all' && r.order.status !== filter.status) return false;
    if (q && !r.order.code.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** The four header tabs on the Commandes screen. */
export type OrderTab = 'all' | 'active' | 'unassigned' | 'done';

const ACTIVE_STATUSES: OrderStatus[] = ['preparing', 'ready', 'en_route'];
const DONE_STATUSES: OrderStatus[] = ['delivered', 'cancelled'];

/** Whether a row belongs to a tab. "unassigned" = an order awaiting pickup
 *  (preparing/ready) with no driver on its tracking row yet. */
export function orderMatchesTab(row: AdminOrderRow, tab: OrderTab): boolean {
  const s = row.order.status;
  switch (tab) {
    case 'all':
      return true;
    case 'active':
      return ACTIVE_STATUSES.includes(s);
    case 'unassigned':
      return (s === 'preparing' || s === 'ready') && !row.tracking?.driver_id;
    case 'done':
      return DONE_STATUSES.includes(s);
  }
}

/** Filter by tab and order-code substring (case-insensitive, trimmed). */
export function filterAdminOrdersByTab(rows: AdminOrderRow[], tab: OrderTab, query: string): AdminOrderRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter((r) => {
    if (!orderMatchesTab(r, tab)) return false;
    if (q && !r.order.code.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Count of rows per tab, for the header badges. */
export function countOrdersByTab(rows: AdminOrderRow[]): Record<OrderTab, number> {
  const counts: Record<OrderTab, number> = { all: 0, active: 0, unassigned: 0, done: 0 };
  for (const r of rows) {
    counts.all += 1;
    if (orderMatchesTab(r, 'active')) counts.active += 1;
    if (orderMatchesTab(r, 'unassigned')) counts.unassigned += 1;
    if (orderMatchesTab(r, 'done')) counts.done += 1;
  }
  return counts;
}

/** Short human summary of an order's articles, e.g. "2 × Tarte · 1 × Café".
 *  Empty orders render as "—". Caps at two lines, then "+N". */
export function orderItemsSummary(items: OrderItem[]): string {
  if (items.length === 0) return '—';
  const parts = items.map((i) => `${i.qty} × ${i.name_snapshot}`);
  if (parts.length <= 2) return parts.join(' · ');
  return `${parts.slice(0, 2).join(' · ')} +${parts.length - 2}`;
}

/** Total number of physical articles in an order (sum of quantities). */
export function orderItemCount(items: OrderItem[]): number {
  return items.reduce((n, i) => n + i.qty, 0);
}

/** Serialise rows to a sales CSV (one row per order). Values are quoted and inner
 *  quotes doubled so commas/accents survive. Header row included. */
export function ordersToCsv(rows: AdminOrderRow[]): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const header = ['Code', 'Client', 'Articles', 'Total DH', 'Statut', 'Livreur', 'Date'];
  const lines = rows.map((r) =>
    [
      r.order.code,
      r.customerName ?? '',
      orderItemCount(r.items),
      r.order.total_dh,
      r.order.status,
      r.driverName ?? '',
      r.order.placed_at,
    ]
      .map(esc)
      .join(','),
  );
  return [header.map(esc).join(','), ...lines].join('\n');
}

export interface AutoAssignment {
  orderId: string;
  driverId: string;
}

/** Round-robin the unassigned (preparing/ready, no driver) orders across the given
 *  online driver ids, oldest order first. Returns the assignments to apply. Empty
 *  when there are no unassigned orders or no online drivers. Pure — the caller runs
 *  the RPCs. */
export function pickAutoAssignments(rows: AdminOrderRow[], onlineDriverIds: string[]): AutoAssignment[] {
  if (onlineDriverIds.length === 0) return [];
  const pending = rows
    .filter((r) => orderMatchesTab(r, 'unassigned'))
    .sort((a, b) => Date.parse(a.order.placed_at) - Date.parse(b.order.placed_at));
  return pending.map((r, i) => ({
    orderId: r.order.id,
    driverId: onlineDriverIds[i % onlineDriverIds.length],
  }));
}
