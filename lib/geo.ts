// lib/geo.ts — Pure geometry for delivery-zone detection. Each zone carries an
// optional polygon (a ring of [lng, lat] points, GeoJSON order). We test a
// customer's coordinates against the rings (ray casting) to pick the zone, and
// fall back to the most expensive zone when the point is outside every covered
// neighbourhood (delivery is still allowed, at the max fee). No I/O — fully testable.

/** A polygon vertex as [longitude, latitude] (GeoJSON order). */
export type PolygonPoint = [number, number];

export interface ZoneGeo {
  id: string;
  name: string;
  fee_dh: number;
  polygon: PolygonPoint[] | null;
}

export interface ResolvedZone<Z> {
  /** The matched zone, or the max-fee fallback when outOfArea. */
  zone: Z | null;
  /** True when the point fell outside every zone polygon. */
  outOfArea: boolean;
}

/** Ray-casting point-in-polygon. `polygon` is a ring of [lng, lat] vertices. */
export function pointInPolygon(lat: number, lng: number, polygon: PolygonPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** First zone whose polygon contains the point, or null. */
export function zoneForPoint<Z extends ZoneGeo>(lat: number, lng: number, zones: Z[]): Z | null {
  for (const z of zones) {
    if (z.polygon && z.polygon.length >= 3 && pointInPolygon(lat, lng, z.polygon)) return z;
  }
  return null;
}

/** The most expensive zone (delivery fallback for out-of-area points). */
export function maxFeeZone<Z extends ZoneGeo>(zones: Z[]): Z | null {
  return zones.reduce<Z | null>((best, z) => (best === null || z.fee_dh > best.fee_dh ? z : best), null);
}

/**
 * Resolve coordinates to a delivery zone: the polygon match, or — when the point
 * is outside every covered neighbourhood — the max-fee zone flagged outOfArea so
 * the UI can warn while still allowing the order.
 */
export function resolveZone<Z extends ZoneGeo>(lat: number, lng: number, zones: Z[]): ResolvedZone<Z> {
  const match = zoneForPoint(lat, lng, zones);
  if (match) return { zone: match, outOfArea: false };
  return { zone: maxFeeZone(zones), outOfArea: true };
}
