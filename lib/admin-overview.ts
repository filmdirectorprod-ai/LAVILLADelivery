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

export interface OverviewDetail {
  /** Commandes livrées aujourd'hui. */
  delivered: number;
  /** Panier moyen des commandes non annulées, en DH (0 s'il n'y en a aucune). */
  avgBasket: number;
  /** Heure (0–23) qui a reçu le plus de commandes, ou null sur une journée vide. */
  peakHour: number | null;
  /** Nombre de commandes du jour par statut. */
  statusCounts: Record<string, number>;
}

/** Chiffres de détail du grand panneau de la vue d'ensemble, dérivés des mêmes
 *  lignes brutes que les indicateurs d'en-tête. `buckets` vient de
 *  bucketOrdersByHour, pour que l'heure de pointe suive le fuseau de l'agence. */
export function computeOverviewDetail(
  orders: { status: string; total_dh: number }[],
  buckets: number[],
): OverviewDetail {
  const statusCounts: Record<string, number> = {};
  for (const o of orders) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
  const sales = orders.filter((o) => o.status !== 'cancelled');
  const revenue = sales.reduce((sum, o) => sum + (o.total_dh ?? 0), 0);
  const max = Math.max(0, ...buckets);
  return {
    delivered: statusCounts.delivered ?? 0,
    avgBasket: sales.length ? revenue / sales.length : 0,
    peakHour: max > 0 ? buckets.indexOf(max) : null,
    statusCounts,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Qui livre quoi, et vers où — la matière du suivi en direct.
//
// La carte de la Vue d'ensemble ne montrait que des points : on voyait le
// livreur bouger, sans savoir où il allait ni quand il arriverait. Depuis 0054
// la commande porte les coordonnées de sa destination (dest_lat/dest_lng) : en
// les recoupant avec la position diffusée du livreur et la liaison
// commande → livreur, on peut tracer le VRAI trajet routier, avec la distance
// et le temps que Google calcule pour lui.
//
// Tout est déjà en mémoire pour l'écran (positions, commandes du jour,
// liaisons) : cette jointure ne coûte aucune requête supplémentaire.

/** Une course en cours, rattachée au livreur qui la porte. */
export interface DriverRun {
  driverId: string;
  driverName: string;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  orderCode: string;
  address: string | null;
}

interface RunOrder {
  id: string;
  code: string;
  status: string;
  address?: string | null;
  dest_lat?: number | null;
  dest_lng?: number | null;
}

interface RunLink {
  order_id: string;
  driver_id: string | null;
}

/**
 * Associe chaque livreur localisé à sa course en cours.
 *
 * Une course compte si elle est `en_route` (le livreur roule) — les commandes
 * seulement `ready` sont encore en boutique, le trajet n'a pas commencé. Un
 * livreur en ligne sans course, ou dont la commande n'a pas de coordonnées
 * (passée avant 0054), est simplement absent du résultat : il reste sur la
 * carte comme un point, sans trajet.
 */
export function driverRuns(
  positions: DriverPosition[],
  links: RunLink[],
  orders: RunOrder[],
): DriverRun[] {
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const runs: DriverRun[] = [];

  for (const p of positions) {
    // Une seule course active à la fois ; on prend la première qui colle.
    for (const link of links) {
      if (link.driver_id !== p.id) continue;
      const order = orderById.get(link.order_id);
      if (!order || order.status !== 'en_route') continue;
      if (order.dest_lat == null || order.dest_lng == null) continue;
      runs.push({
        driverId: p.id,
        driverName: p.name,
        from: { lat: p.lat, lng: p.lng },
        to: { lat: order.dest_lat, lng: order.dest_lng },
        orderCode: order.code,
        address: order.address ?? null,
      });
      break;
    }
  }
  return runs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Commandes prêtes qu'aucun livreur ne peut prendre.
//
// Chaque agence est cloisonnée : un livreur de Riad ne voit JAMAIS une commande
// de Badie — ni dans son vivier, ni même au niveau des règles de lecture de la
// base. C'est voulu. Mais rien ne le disait au gérant : une commande pouvait
// rester « prête » toute la soirée parce que la seule personne autorisée à la
// prendre appartenait à l'autre agence, et l'écran restait muet.
//
// Ce calcul repère ces commandes, et nomme l'agence en cause.

export interface StrandedOrders {
  branchId: string | null;
  branchName: string;
  count: number;
}

interface StrandableOrder {
  status: string;
  branch_id?: string | null;
}

interface BranchDriver {
  is_online?: boolean;
  branch_id?: string | null;
}

interface NamedBranch {
  id: string;
  name: string;
}

/**
 * Les commandes prêtes dont l'agence n'a aucun livreur en ligne, groupées par
 * agence. Une liste vide signifie que chaque commande prête a quelqu'un pour la
 * prendre.
 *
 * `en_route` est exclu : la course est déjà partie, elle a son livreur.
 */
export function readyWithoutDriver(
  orders: StrandableOrder[],
  drivers: BranchDriver[],
  branches: NamedBranch[] = [],
): StrandedOrders[] {
  const covered = new Set<string>();
  for (const d of drivers) {
    if (d.is_online && d.branch_id) covered.add(d.branch_id);
  }
  const nameById = new Map(branches.map((b) => [b.id, b.name]));

  const counts = new Map<string | null, number>();
  for (const o of orders) {
    if (o.status !== 'ready') continue;
    const branch = o.branch_id ?? null;
    // Une commande sans agence est prenable par n'importe quel livreur en ligne.
    if (branch === null) {
      if (drivers.some((d) => d.is_online)) continue;
    } else if (covered.has(branch)) {
      continue;
    }
    counts.set(branch, (counts.get(branch) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([branchId, count]) => ({
      branchId,
      branchName: branchId ? nameById.get(branchId) ?? 'Agence inconnue' : 'Sans agence',
      count,
    }))
    .sort((a, b) => b.count - a.count);
}
