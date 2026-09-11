// Pure, side-effect-free helpers for the admin Incidents screen. Incidents are
// joined to their driver/order and ordered (open first, most severe and newest on
// top; resolved last) here so the same logic serves the server first-paint and the
// client realtime refetch, and stays unit testable. No React, no I/O.

import type { Incident, IncidentSeverity } from '@/lib/types';

interface NamedDriver {
  id: string;
  name: string;
}
interface CodedOrder {
  id: string;
  code: string;
}

export interface IncidentRow {
  incident: Incident;
  driverName: string | null;
  orderCode: string | null;
}

const SEVERITY_RANK: Record<IncidentSeverity, number> = { haute: 3, moyenne: 2, basse: 1 };

/** Join incidents to driver/order and order them: open incidents first (most
 *  severe, then newest), then resolved incidents (most recently resolved first). */
export function buildIncidentRows(
  incidents: Incident[],
  drivers: NamedDriver[],
  orders: CodedOrder[],
): IncidentRow[] {
  const nameByDriver = new Map(drivers.map((d) => [d.id, d.name]));
  const codeByOrder = new Map(orders.map((o) => [o.id, o.code]));

  const rows = incidents.map((incident) => ({
    incident,
    driverName: incident.driver_id ? nameByDriver.get(incident.driver_id) ?? null : null,
    orderCode: incident.order_id ? codeByOrder.get(incident.order_id) ?? null : null,
  }));

  rows.sort((a, b) => {
    const openA = a.incident.status === 'open' ? 1 : 0;
    const openB = b.incident.status === 'open' ? 1 : 0;
    if (openA !== openB) return openB - openA;
    if (openA === 1) {
      const sev = SEVERITY_RANK[b.incident.severity] - SEVERITY_RANK[a.incident.severity];
      if (sev !== 0) return sev;
      return Date.parse(b.incident.created_at) - Date.parse(a.incident.created_at);
    }
    // both resolved → most recently resolved first
    return Date.parse(b.incident.resolved_at ?? '') - Date.parse(a.incident.resolved_at ?? '');
  });
  return rows;
}

/** Number of incidents still open — feeds the "Incidents ouverts" headline. */
export function openIncidentCount(incidents: Incident[]): number {
  return incidents.filter((i) => i.status === 'open').length;
}

/** Split already-ordered rows into open ("À traiter") and resolved buckets,
 *  preserving the input order within each bucket. */
export function partitionIncidentRows(rows: IncidentRow[]): { open: IncidentRow[]; resolved: IncidentRow[] } {
  const open: IncidentRow[] = [];
  const resolved: IncidentRow[] = [];
  for (const r of rows) {
    if (r.incident.status === 'resolved') resolved.push(r);
    else open.push(r);
  }
  return { open, resolved };
}

export const INCIDENT_KIND_LABEL: Record<string, string> = { retard: 'Retard', litige: 'Litige', accident: 'Accident', autre: 'Autre' };
export const SEVERITY_LABEL: Record<IncidentSeverity, string> = { haute: 'Haute', moyenne: 'Moyenne', basse: 'Basse' };

/** Rows matching a severity and a kind ('all' keeps everything). */
export function filterIncidentRows(rows: IncidentRow[], severity: IncidentSeverity | 'all', kind: string): IncidentRow[] {
  return rows.filter((r) => (severity === 'all' || r.incident.severity === severity) && (kind === 'all' || r.incident.kind === kind));
}

export interface IncidentTotals {
  open: number;
  /** Open incidents of high severity. */
  high: number;
  /** Resolved during the last 7 days. */
  resolvedWeek: number;
  /** Mean hours from report to resolution, one decimal; null when none resolved. */
  avgResolutionHours: number | null;
}

export function incidentTotals(rows: IncidentRow[], now: Date = new Date()): IncidentTotals {
  const weekAgo = now.getTime() - 7 * 86400000;
  const t: IncidentTotals = { open: 0, high: 0, resolvedWeek: 0, avgResolutionHours: null };
  let sum = 0;
  let n = 0;
  for (const { incident: i } of rows) {
    if (i.status !== 'resolved') {
      t.open += 1;
      if (i.severity === 'haute') t.high += 1;
      continue;
    }
    const done = i.resolved_at ? Date.parse(i.resolved_at) : NaN;
    if (Number.isNaN(done)) continue;
    if (done >= weekAgo) t.resolvedWeek += 1;
    sum += Math.max(0, done - Date.parse(i.created_at));
    n += 1;
  }
  if (n) t.avgResolutionHours = Math.round((sum / n / 3600000) * 10) / 10;
  return t;
}
