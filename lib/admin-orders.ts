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
