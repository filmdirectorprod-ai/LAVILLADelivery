// Pure, side-effect-free helpers for the admin Vue d'ensemble. Every derived
// number on the dashboard is computed here from raw rows, so the same logic
// serves the server first-paint and the client realtime refetch, and stays unit
// testable. No React, no I/O.

import { isInProgressOrderStatus } from '@/lib/order-status';
import { startOfBusinessDay, hourInZone } from '@/lib/timezone';

/** Start of "today" as an ISO string — midnight in the AGENCY's timezone
 *  (lib/timezone.ts), which is what the gérant means by today. It used to be UTC
 *  midnight, so "aujourd'hui" began at 01 h 00 in Fès and the first hour of
 *  trading was filed under the previous day. Still an absolute instant, so the
 *  server first-paint and the client realtime refetch agree on the boundary
 *  wherever each runs — the property the UTC version was chosen for. */
export function startOfTodayISO(ref: Date = new Date()): string {
  return startOfBusinessDay(ref).toISOString();
}

/** Count orders into 24 buckets keyed by the hour `placed_at` falls on in the
 *  agency's timezone. Previously the runtime's local hour, so a server paint
 *  (UTC) and the gérant's browser (UTC+1) bucketed the same order differently. */
export function bucketOrdersByHour(orders: { placed_at: string }[]): number[] {
  const buckets = new Array(24).fill(0);
  for (const o of orders) {
    const h = hourInZone(new Date(o.placed_at));
    if (h >= 0 && h < 24) buckets[h] += 1;
  }
  return buckets;
}

export interface OverviewKpiInput {
  orders: { status: string; total_dh: number }[];
  drivers: { is_online?: boolean }[];
  ratings: number[];
}

export interface OverviewKpis {
  ordersToday: number;
  inProgress: number;
  revenueToday: number;
  driversOnline: number;
  driversTotal: number;
  ratingAvg: number;
  ratingCount: number;
}

/** Headline numbers for the KPI cards, derived from today's raw rows. Revenue
 *  excludes cancelled orders; in-progress = preparing + en_route. */
export function computeOverviewKpis({ orders, drivers, ratings }: OverviewKpiInput): OverviewKpis {
  const inProgress = orders.filter((o) => isInProgressOrderStatus(o.status)).length;
  const revenueToday = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (o.total_dh ?? 0), 0);
  const driversOnline = drivers.filter((d) => d.is_online).length;
  const ratingCount = ratings.length;
  const ratingAvg = ratingCount === 0 ? 0 : ratings.reduce((a, b) => a + b, 0) / ratingCount;
  return {
    ordersToday: orders.length,
    inProgress,
    revenueToday,
    driversOnline,
    driversTotal: drivers.length,
    ratingAvg,
    ratingCount,
  };
}

export interface DriverPosition {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface PositionDriver {
  id: string;
  name: string;
  is_online?: boolean;
}
interface PositionTracking {
  driver_id: string | null;
  lat: number | null;
  lng: number | null;
  updated_at: string;
}

/** Newest known GPS position for each ONLINE driver that has streamed coords.
 *  Offline drivers and drivers without coords are omitted. */
export function latestDriverPositions(
  drivers: PositionDriver[],
  tracking: PositionTracking[],
): DriverPosition[] {
  const newest = new Map<string, PositionTracking>();
  for (const t of tracking) {
    if (!t.driver_id || t.lat == null || t.lng == null) continue;
    const prev = newest.get(t.driver_id);
    if (!prev || Date.parse(t.updated_at) > Date.parse(prev.updated_at)) {
      newest.set(t.driver_id, t);
    }
  }
  const out: DriverPosition[] = [];
  for (const d of drivers) {
    if (!d.is_online) continue;
    const t = newest.get(d.id);
    if (!t || t.lat == null || t.lng == null) continue;
    out.push({ id: d.id, name: d.name, lat: t.lat, lng: t.lng });
  }
  return out;
}

/** How recent a driver's streamed position must be to count as "live". */
export const LOCATION_TTL_MS = 2 * 60 * 1000; // 2 minutes

export interface LocatedDriver {
  id: string;
  name: string;
  is_online?: boolean;
  lat?: number | null;
  lng?: number | null;
  position_at?: string | null;
}

/** Live positions for EVERY online driver with a fresh streamed GPS fix (0049),
 *  whether or not they're on a delivery. */
export function driversToPositions(drivers: LocatedDriver[], now: Date = new Date()): DriverPosition[] {
  const out: DriverPosition[] = [];
  for (const d of drivers) {
    if (!d.is_online || d.lat == null || d.lng == null || !d.position_at) continue;
    if (now.getTime() - Date.parse(d.position_at) > LOCATION_TTL_MS) continue;
    out.push({ id: d.id, name: d.name, lat: d.lat, lng: d.lng });
  }
  return out;
}
