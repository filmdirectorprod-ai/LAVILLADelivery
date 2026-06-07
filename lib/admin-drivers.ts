// Pure, side-effect-free helpers for the admin Livreurs screen. Per-driver day
// stats (deliveries completed today + earnings) are derived here from raw rows so
// the same logic serves the server first-paint and the client realtime refetch,
// and stays unit testable. No React, no I/O.

import type { Driver } from '@/lib/types';

interface StatsOrder {
  id: string;
  status: string;
  delivery_fee_dh: number;
}
interface StatsTracking {
  order_id: string;
  driver_id: string | null;
}

export interface DriverDayStats {
  /** Orders delivered today by this driver. */
  deliveries: number;
  /** Sum of delivery fees on those orders — the driver's earnings (DH). */
  earnings: number;
}

export interface DriverRow {
  driver: Driver;
  deliveries: number;
  earnings: number;
}

/** Accumulate per-driver day stats from today's orders. Only `delivered` orders
 *  count; each is attributed to the driver named on its tracking row. Orders with
 *  no tracking row or no driver are ignored. Returns a map keyed by driver id. */
export function computeDriverDayStats(
  orders: StatsOrder[],
  tracking: StatsTracking[],
): Map<string, DriverDayStats> {
  const driverByOrder = new Map<string, string>();
  for (const t of tracking) {
    if (t.driver_id) driverByOrder.set(t.order_id, t.driver_id);
  }
  const stats = new Map<string, DriverDayStats>();
  for (const o of orders) {
    if (o.status !== 'delivered') continue;
    const driverId = driverByOrder.get(o.id);
    if (!driverId) continue;
    const cur = stats.get(driverId) ?? { deliveries: 0, earnings: 0 };
    cur.deliveries += 1;
    cur.earnings += o.delivery_fee_dh ?? 0;
    stats.set(driverId, cur);
  }
  return stats;
}

/** Build the Livreurs roster rows: each driver with today's deliveries/earnings,
 *  sorted online-first, then by most deliveries, then by name. */
export function buildDriverRows(
  drivers: Driver[],
  orders: StatsOrder[],
  tracking: StatsTracking[],
): DriverRow[] {
  const stats = computeDriverDayStats(orders, tracking);
  const rows = drivers.map((driver) => {
    const s = stats.get(driver.id) ?? { deliveries: 0, earnings: 0 };
    return { driver, deliveries: s.deliveries, earnings: s.earnings };
  });
  rows.sort((a, b) => {
    const onA = a.driver.is_online ? 1 : 0;
    const onB = b.driver.is_online ? 1 : 0;
    if (onA !== onB) return onB - onA;
    if (a.deliveries !== b.deliveries) return b.deliveries - a.deliveries;
    return a.driver.name.localeCompare(b.driver.name);
  });
  return rows;
}
