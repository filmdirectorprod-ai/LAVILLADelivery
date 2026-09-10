// The business day, in the agency's own timezone.
//
// Reports used to cut days in UTC (a leftover of slicing an ISO string), so a
// 00 h 30 order in Fès landed on the previous day's revenue bar. Morocco runs at
// UTC+1 and drops to UTC+0 for Ramadan, so a fixed offset is not enough either —
// everything here goes through the IANA zone, which carries those switches.
//
// No dependency: Intl is enough to read the zone's offset at a given instant.

/** The zone every report is expressed in. */
export const BUSINESS_TZ = 'Africa/Casablanca';

/** Milliseconds to add to a UTC instant to read it as wall-clock time in `tz`. */
export function zoneOffsetMs(at: Date, tz: string = BUSINESS_TZ): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // formatToParts can render midnight as hour 24 depending on the engine.
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return asIfUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * The instant midnight began in `tz` for the day `now` falls on — regardless of
 * the device or server timezone, so "Aujourd'hui" means the same thing on the
 * gérant's phone, on a laptop abroad and in a server render.
 */
export function startOfBusinessDay(now: Date = new Date(), tz: string = BUSINESS_TZ): Date {
  const offset = zoneOffsetMs(now, tz);
  const wall = new Date(now.getTime() + offset);
  const midnightWall = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate());
  const first = new Date(midnightWall - offset);
  // If the offset differs at that earlier instant (a zone switch during the
  // day — Morocco's Ramadan change), recompute with the offset in force then.
  const offsetThen = zoneOffsetMs(first, tz);
  return offsetThen === offset ? first : new Date(midnightWall - offsetThen);
}

/** The hour (0–23) an instant falls on in `tz` — independent of where the code
 *  runs, so a server paint and a browser refetch bucket an order identically. */
export function hourInZone(at: Date, tz: string = BUSINESS_TZ): number {
  return new Date(at.getTime() + zoneOffsetMs(at, tz)).getUTCHours();
}
