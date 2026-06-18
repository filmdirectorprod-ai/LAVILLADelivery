// lib/admin-presence.ts — Shared "is this driver really online?" rule.
// A driver counts as online only when their app set is_online = true AND sent a
// heartbeat (last_seen) recently. The freshness guard prevents a driver from
// being stuck "online" when their app closes without firing the offline event
// (web unload is unreliable). Pure + testable; used by every admin presence view.

/** A driver is considered offline once their last heartbeat is older than this. */
export const PRESENCE_TTL_MS = 3 * 60 * 1000; // 3 minutes

export interface PresenceInput {
  is_online?: boolean | null;
  last_seen?: string | null;
}

/** True when the driver is flagged online and last seen within the TTL window. */
export function isDriverOnline(driver: PresenceInput, now: Date = new Date()): boolean {
  if (!driver.is_online) return false;
  if (!driver.last_seen) return false; // online flag but no heartbeat → stale, treat offline
  const t = Date.parse(driver.last_seen);
  if (Number.isNaN(t)) return false;
  return now.getTime() - t <= PRESENCE_TTL_MS;
}

/** Count drivers currently online (freshness-aware). */
export function countOnline(drivers: PresenceInput[], now: Date = new Date()): number {
  return drivers.reduce((n, d) => n + (isDriverOnline(d, now) ? 1 : 0), 0);
}

export type DriverStatus = 'offline' | 'available' | 'delivering';

/**
 * Three-state status for the admin Livreurs card: a driver on an active route is
 * "delivering" (even if their heartbeat lapsed); otherwise online → "available",
 * else "offline".
 */
export function driverStatus(driver: PresenceInput, hasRoute: boolean, now: Date = new Date()): DriverStatus {
  if (hasRoute) return 'delivering';
  return isDriverOnline(driver, now) ? 'available' : 'offline';
}
