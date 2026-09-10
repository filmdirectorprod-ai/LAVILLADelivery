import { describe, it, expect } from 'vitest';
import { BUSINESS_TZ, zoneOffsetMs, startOfBusinessDay } from '@/lib/timezone';

const HOUR = 60 * 60 * 1000;

describe('timezone', () => {
  it('reads Morocco as UTC+1 outside Ramadan', () => {
    expect(zoneOffsetMs(new Date('2026-06-12T15:00:00Z'))).toBe(HOUR);
  });

  it('follows the Ramadan switch to UTC+0', () => {
    // Ramadan 2026 runs roughly 18 Feb – 19 Mar; Morocco sits at UTC+0 then.
    expect(zoneOffsetMs(new Date('2026-03-01T12:00:00Z'))).toBe(0);
  });

  it('starts the day at the agency midnight, as an instant', () => {
    // 00:00 in Fès (UTC+1) is 23:00 UTC the previous day.
    expect(startOfBusinessDay(new Date('2026-06-12T15:00:00Z')).toISOString()).toBe('2026-06-11T23:00:00.000Z');
    // During Ramadan the zone is UTC+0, so midnight coincides with UTC midnight.
    expect(startOfBusinessDay(new Date('2026-03-01T12:00:00Z')).toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('resolves an instant just after midnight to that same day', () => {
    // 00:30 Fès = 23:30 UTC on the 11th; the day started half an hour earlier.
    expect(startOfBusinessDay(new Date('2026-06-11T23:30:00Z')).toISOString()).toBe('2026-06-11T23:00:00.000Z');
  });

  it('names the zone it reports in', () => {
    expect(BUSINESS_TZ).toBe('Africa/Casablanca');
  });
});
