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

export interface ModeSplit {
  orders: number;
  revenue: number;
}

export interface HeatCell {
  /** ISO day of week in the agency timezone: 1 = Monday … 7 = Sunday. */
  dow: number;
  hour: number;
  orders: number;
}

export interface StatsSnapshot {
  kpis: StatKpis;
  /** Revenue over the preceding window of the same length. */
  prevRevenue: number;
  /** Every KPI over the preceding window (0053) — for the ▲▼ on each figure. */
  prevKpis: StatKpis;
  series: { day: string; revenue: number }[];
  top: { name: string; qty: number; revenue: number }[];
  /** Keyed by branch id, or 'none' for orders with no agency. */
  byBranch: Record<string, { revenue: number; orders: number }>;
  /** Sales split by mode — 'livraison' / 'retrait' (0053). */
  modes: Record<string, ModeSplit>;
  /** Cancelled orders among all orders of the window (0053). */
  cancelled: { count: number; total: number };
  /** Sparse orders-per-(weekday, hour) cells (0053). */
  heatmap: HeatCell[];
  /** True when the RPC answered with the 0053 keys; false against 0052. */
  extended: boolean;
}

export const EMPTY_SNAPSHOT: StatsSnapshot = {
  kpis: { revenue: 0, orders: 0, avgBasket: 0, delivered: 0 },
  prevRevenue: 0,
  prevKpis: { revenue: 0, orders: 0, avgBasket: 0, delivered: 0 },
  series: [],
  top: [],
  byBranch: {},
  modes: {},
  cancelled: { count: 0, total: 0 },
  heatmap: [],
  extended: false,
};

/** Percentage change, rounded — null without a positive baseline to compare to. */
export function pctDelta(current: number, previous: number): number | null {
  if (!(previous > 0)) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Percentage change vs the previous window, or null when there is no baseline. */
export function revenueDelta(snapshot: StatsSnapshot): number | null {
  return pctDelta(snapshot.kpis.revenue, snapshot.prevRevenue);
}

/** Normalises the jsonb the RPC returns (missing keys ⇒ empty figures). */
export function toSnapshot(raw: unknown): StatsSnapshot {
  const r = (raw ?? {}) as Partial<StatsSnapshot> & Record<string, unknown>;
  const cancelled = (r.cancelled ?? {}) as Partial<StatsSnapshot['cancelled']>;
  return {
    kpis: { ...EMPTY_SNAPSHOT.kpis, ...(r.kpis ?? {}) },
    prevRevenue: Number(r.prevRevenue ?? 0),
    prevKpis: { ...EMPTY_SNAPSHOT.prevKpis, ...(r.prevKpis ?? {}) },
    series: Array.isArray(r.series) ? r.series : [],
    top: Array.isArray(r.top) ? r.top : [],
    byBranch: (r.byBranch as StatsSnapshot['byBranch']) ?? {},
    modes: r.modes && typeof r.modes === 'object' ? (r.modes as StatsSnapshot['modes']) : {},
    cancelled: { count: Number(cancelled.count ?? 0), total: Number(cancelled.total ?? 0) },
    heatmap: Array.isArray(r.heatmap) ? (r.heatmap as HeatCell[]) : [],
    extended: 'modes' in r,
  };
}

/** Share of cancelled orders, rounded %, or null when the window has none. */
export function cancellationRate(snapshot: StatsSnapshot): number | null {
  const { count, total } = snapshot.cancelled;
  return total > 0 ? Math.round((count / total) * 100) : null;
}

/** Monday-first weekday labels for the heatmap rows. */
export const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** Dense 7 × 24 grid (Monday first) from the sparse heatmap cells, plus its max.
 *  Out-of-range cells are ignored rather than trusted. */
export function heatmapGrid(cells: HeatCell[]): { grid: number[][]; max: number } {
  const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const c of cells) {
    if (c.dow >= 1 && c.dow <= 7 && c.hour >= 0 && c.hour < 24) grid[c.dow - 1][c.hour] += c.orders;
  }
  return { grid, max: Math.max(0, ...grid.flat()) };
}

export interface ModeShare {
  key: 'livraison' | 'retrait';
  label: string;
  orders: number;
  revenue: number;
  /** % of the window's sales orders. */
  share: number;
}

/** Delivery vs pickup, always both rows, shares of order count. */
export function modeShares(modes: Record<string, ModeSplit>): ModeShare[] {
  const rows: ModeShare[] = [
    { key: 'livraison', label: 'Livraison', orders: modes.livraison?.orders ?? 0, revenue: modes.livraison?.revenue ?? 0, share: 0 },
    { key: 'retrait', label: 'Retrait en boutique', orders: modes.retrait?.orders ?? 0, revenue: modes.retrait?.revenue ?? 0, share: 0 },
  ];
  const total = rows.reduce((n, r) => n + r.orders, 0);
  return rows.map((r) => ({ ...r, share: total > 0 ? Math.round((r.orders / total) * 100) : 0 }));
}

/** Top products with a bar width relative to the best seller and their share
 *  (%) of the window's revenue — null when the window made nothing. */
export function topWithShares<T extends { revenue: number }>(top: T[], periodRevenue: number): (T & { width: number; share: number | null })[] {
  const best = Math.max(0, ...top.map((t) => t.revenue));
  return top.map((t) => ({
    ...t,
    width: best > 0 ? t.revenue / best : 0,
    share: periodRevenue > 0 ? Math.min(100, Math.round((t.revenue / periodRevenue) * 100)) : null,
  }));
}

/** CSV of the daily revenue series (BOM-friendly: caller adds the BOM). */
export function statsToCsv(series: { day: string; revenue: number }[]): string {
  const head = 'Date,Chiffre d\'affaires (DH)';
  const rows = series.map((r) => `${r.day},${r.revenue}`);
  return [head, ...rows].join('\n');
}
