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
