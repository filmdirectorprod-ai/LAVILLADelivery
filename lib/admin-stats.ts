// Shapes + pure helpers for the admin Statistiques screen.
//
// The aggregation itself now happens in Postgres (admin_stats_snapshot, 0051):
// the screen used to download 90 days of orders plus every order_item and reduce
// them on the device, which grew without bound and — past PostgREST's 1000-row
// cap — silently reported wrong figures. What is left here is the range maths
// and the CSV export: no React, no I/O.
//
// Days are cut in the agency's timezone (lib/timezone.ts), matching the
// `at time zone 'Africa/Casablanca'` the SQL groups by (0052).

import { startOfBusinessDay } from '@/lib/timezone';

export type RangeKey = 'today' | '7d' | '30d' | '90d';

export const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: 'today', label: "Aujourd'hui", days: 1 },
  { key: '7d', label: '7 jours', days: 7 },
  { key: '30d', label: '30 jours', days: 30 },
  { key: '90d', label: '90 jours', days: 90 },
];

/** The default range the screen opens on. */
export const DEFAULT_RANGE: RangeKey = '30d';

export function daysFor(range: RangeKey): number {
  return RANGES.find((r) => r.key === range)?.days ?? 30;
}

export interface RangeWindow {
  /** Start of the reported window (inclusive). */
  from: string;
  /** End of the reported window (exclusive). */
  to: string;
  /** Start of the preceding same-length window, for the trend arrow. */
  prevFrom: string;
}

/**
 * Bounds for a range key. 'today' starts when midnight struck in the agency's
 * timezone — not on the device, so the figure is the same on the gérant's phone
 * and in a server render. The others span the last N days. `prevFrom` goes one
 * further window back so a single query returns the period and its predecessor.
 */
export function rangeWindow(range: RangeKey, now: Date = new Date()): RangeWindow {
  const days = daysFor(range);
  const to = new Date(now.getTime() + 1000);
  const from = days === 1 ? startOfBusinessDay(now) : new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevFrom = new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString(), prevFrom: prevFrom.toISOString() };
}

export interface StatKpis {
  revenue: number;
  orders: number;
  avgBasket: number;
  delivered: number;
}

export interface StatsSnapshot {
  kpis: StatKpis;
  /** Revenue over the preceding window of the same length. */
  prevRevenue: number;
  series: { day: string; revenue: number }[];
  top: { name: string; qty: number; revenue: number }[];
  /** Keyed by branch id, or 'none' for orders with no agency. */
  byBranch: Record<string, { revenue: number; orders: number }>;
}

export const EMPTY_SNAPSHOT: StatsSnapshot = {
  kpis: { revenue: 0, orders: 0, avgBasket: 0, delivered: 0 },
  prevRevenue: 0,
  series: [],
  top: [],
  byBranch: {},
};

/** Percentage change vs the previous window, or null when there is no baseline. */
export function revenueDelta(snapshot: StatsSnapshot): number | null {
  if (snapshot.prevRevenue <= 0) return null;
  return Math.round(((snapshot.kpis.revenue - snapshot.prevRevenue) / snapshot.prevRevenue) * 100);
}

/** Normalises the jsonb the RPC returns (missing keys ⇒ empty figures). */
export function toSnapshot(raw: unknown): StatsSnapshot {
  const r = (raw ?? {}) as Partial<StatsSnapshot>;
  return {
    kpis: { ...EMPTY_SNAPSHOT.kpis, ...(r.kpis ?? {}) },
    prevRevenue: Number(r.prevRevenue ?? 0),
    series: Array.isArray(r.series) ? r.series : [],
    top: Array.isArray(r.top) ? r.top : [],
    byBranch: (r.byBranch as StatsSnapshot['byBranch']) ?? {},
  };
}

/** CSV of the daily revenue series (BOM-friendly: caller adds the BOM). */
export function statsToCsv(series: { day: string; revenue: number }[]): string {
  const head = 'Date,Chiffre d\'affaires (DH)';
  const rows = series.map((r) => `${r.day},${r.revenue}`);
  return [head, ...rows].join('\n');
}
