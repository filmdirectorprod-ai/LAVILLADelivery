import { describe, it, expect } from 'vitest';
import { sortZones, validateZoneDraft, type ZoneDraft } from '@/lib/admin-zones';
import type { Zone } from '@/lib/types';

const zone = (over: Partial<Zone> & { id: string; name: string }): Zone => ({
  fee_dh: 10,
  eta_min: 20,
  eta_max: 40,
  polygon: null,
  ...over,
});

describe('sortZones', () => {
  it('orders by fee ascending, then name', () => {
    const zones = [
      zone({ id: 'z1', name: 'Centre', fee_dh: 15 }),
      zone({ id: 'z2', name: 'Médina', fee_dh: 10 }),
      zone({ id: 'z3', name: 'Atlas', fee_dh: 10 }),
    ];
    expect(sortZones(zones).map((z) => z.id)).toEqual(['z3', 'z2', 'z1']);
  });

  it('does not mutate the input array', () => {
    const zones = [zone({ id: 'z1', name: 'B', fee_dh: 20 }), zone({ id: 'z2', name: 'A', fee_dh: 10 })];
    const copy = [...zones];
    sortZones(zones);
    expect(zones).toEqual(copy);
  });
});

describe('validateZoneDraft', () => {
  const ok: ZoneDraft = { name: 'Médina', fee_dh: 12, eta_min: 20, eta_max: 40 };

  it('accepts a valid draft', () => {
    expect(validateZoneDraft(ok)).toEqual({ ok: true });
  });

  it('rejects an empty name', () => {
    expect(validateZoneDraft({ ...ok, name: '  ' }).ok).toBe(false);
  });

  it('rejects a negative fee', () => {
    expect(validateZoneDraft({ ...ok, fee_dh: -1 }).ok).toBe(false);
  });

  it('rejects eta_max below eta_min', () => {
    const v = validateZoneDraft({ ...ok, eta_min: 40, eta_max: 20 });
    expect(v.ok).toBe(false);
    expect(v.error).toContain('max');
  });

  it('rejects a non-finite fee', () => {
    expect(validateZoneDraft({ ...ok, fee_dh: NaN }).ok).toBe(false);
  });
});
