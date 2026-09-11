// lib/eta.ts — Distance et arrivée estimée à partir de positions RÉELLES.
//
// Le suivi client affichait jusqu'ici les kilomètres et les minutes d'un trajet
// d'exemple codé en dur (lib/route.ts), même quand le livreur partageait sa
// position. Ici : distance orthodromique (haversine) entre le livreur et la
// destination de la commande, puis une durée à vitesse urbaine moyenne. Pur,
// sans I/O, testable.

/** Vitesse moyenne d'un scooter en ville, km/h (feux, sens uniques, arrêts). */
export const CITY_SPEED_KMH = 18;
/** Temps de remise au client, ajouté à la durée de trajet. */
export const HANDOVER_MIN = 2;

export interface LatLng {
  lat: number;
  lng: number;
}

const R_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distance en kilomètres entre deux points (haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Minutes de trajet pour une distance, arrondies, au moins 1. */
export function minutesFor(km: number, speedKmh: number = CITY_SPEED_KMH): number {
  if (!(km > 0)) return 1;
  return Math.max(1, Math.round((km / speedKmh) * 60) + HANDOVER_MIN);
}

export interface LiveEta {
  km: number;
  minutes: number;
  /** true quand la mesure vient de positions réelles (pas d'une estimation). */
  real: boolean;
}

/**
 * Arrivée estimée : mesurée quand on a la position du livreur ET la destination.
 * Sinon on retombe sur l'estimation fournie (ETA de la commande), signalée comme
 * non mesurée pour que l'écran reste honnête.
 */
export function liveEta(
  driver: LatLng | null,
  destination: LatLng | null,
  fallbackMinutes: number | null,
): LiveEta | null {
  if (driver && destination) {
    const km = distanceKm(driver, destination);
    return { km: Math.round(km * 10) / 10, minutes: minutesFor(km), real: true };
  }
  if (fallbackMinutes != null && Number.isFinite(fallbackMinutes)) {
    return { km: 0, minutes: Math.max(1, Math.round(fallbackMinutes)), real: false };
  }
  return null;
}

/** Minutes restantes avant `iso` (0 si passé), ou null sans date. */
export function minutesUntil(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((t - now.getTime()) / 60000));
}

/** Lien d'itinéraire : coordonnées quand on les a, sinon l'adresse écrite. */
export function directionsUrl(destination: LatLng | null, address: string | null): string {
  const q = destination ? `${destination.lat},${destination.lng}` : (address ?? '').trim();
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&travelmode=driving`;
}
