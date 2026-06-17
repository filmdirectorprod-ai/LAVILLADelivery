import { describe, it, expect } from 'vitest';
import { isDriverOnline, countOnline, PRESENCE_TTL_MS } from '@/lib/admin-presence';

const NOW = new Date('2026-06-16T12:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe('isDriverOnline', () => {
  it('online when flagged and heartbeat is fresh', () => {
    expect(isDriverOnline({ is_online: true, last_seen: ago(60_000) }, NOW)).toBe(true);
  });
  it('offline when is_online is false (even if recently seen)', () => {
    expect(isDriverOnline({ is_online: false, last_seen: ago(1000) }, NOW)).toBe(false);
  });
  it('offline when heartbeat is stale (> TTL)', () => {
    expect(isDriverOnline({ is_online: true, last_seen: ago(PRESENCE_TTL_MS + 1000) }, NOW)).toBe(false);
  });
  it('online exactly at the TTL boundary', () => {
    expect(isDriverOnline({ is_online: true, last_seen: ago(PRESENCE_TTL_MS) }, NOW)).toBe(true);
  });
  it('offline when flagged online but never heartbeated', () => {
    expect(isDriverOnline({ is_online: true, last_seen: null }, NOW)).toBe(false);
  });
  it('offline on missing/invalid data', () => {
    expect(isDriverOnline({}, NOW)).toBe(false);
    expect(isDriverOnline({ is_online: true, last_seen: 'nope' }, NOW)).toBe(false);
  });
});

describe('countOnline', () => {
  it('counts only fresh online drivers', () => {
    const drivers = [
      { is_online: true, last_seen: ago(30_000) }, // online
      { is_online: true, last_seen: ago(PRESENCE_TTL_MS + 5000) }, // stale
      { is_online: false, last_seen: ago(1000) }, // offline
      { is_online: true, last_seen: ago(120_000) }, // online
    ];
    expect(countOnline(drivers, NOW)).toBe(2);
  });
});
