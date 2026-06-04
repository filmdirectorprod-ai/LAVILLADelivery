// Delivery route geometry for the live-tracking map.
// Ported verbatim from the prototype (store.jsx:9-34).
// Coordinates are normalised %-positions inside the 280px-tall map, paired
// with lat/lng so the marker can show real GPS while moving along the polyline.

export interface RoutePoint {
  x: number;
  y: number;
  lat: number;
  lng: number;
}

export const LV_ROUTE: RoutePoint[] = [
  { x: 17.5, y: 78.6, lat: 34.0331, lng: -4.9998 },
  { x: 27, y: 71, lat: 34.0345, lng: -4.9971 },
  { x: 35, y: 60, lat: 34.0362, lng: -4.9949 },
  { x: 41, y: 49, lat: 34.0379, lng: -4.9933 },
  { x: 49, y: 42, lat: 34.0393, lng: -4.9915 },
  { x: 57.5, y: 33.9, lat: 34.041, lng: -4.9897 },
];

export const LV_ROUTE_TOTAL_KM = 3.2;
export const LV_ROUTE_TOTAL_MIN = 28;

/** Position + live GPS coords at progress `p` (0..1) along the polyline. */
export function lvPosAt(p: number): RoutePoint {
  p = Math.max(0, Math.min(1, p));
  const n = LV_ROUTE.length - 1;
  const f = p * n;
  const i = Math.min(n - 1, Math.floor(f));
  const t = f - i;
  const a = LV_ROUTE[i];
  const b = LV_ROUTE[i + 1];
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}
