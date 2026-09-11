import { describe, it, expect } from 'vitest';
import { pctDelta, cancellationRate, heatmapGrid, modeShares, topWithShares } from '@/lib/admin-stats';
import {
  rangeWindow, daysFor, revenueDelta, toSnapshot, statsToCsv, EMPTY_SNAPSHOT,
} from '@/lib/admin-stats';

describe('admin-stats', () => {
  const now = new Date('2026-06-12T15:00:00Z');

  it('spans the last N days, with the preceding window for the trend', () => {
    const w = rangeWindow('7d', now);
    expect(w.from).toBe('2026-06-05T15:00:00.000Z');
    expect(w.prevFrom).toBe('2026-05-29T15:00:00.000Z');
    expect(Date.parse(w.to)).toBeGreaterThan(now.getTime()); // `to` is exclusive
  });

  // Fès is UTC+1, so its midnight is 23:00 UTC the day before. Asserted as an
  // instant, not with getHours(), so the test does not depend on the runner's TZ.
  it('starts "today" at midnight in the agency timezone', () => {
    expect(rangeWindow('today', now).from).toBe('2026-06-11T23:00:00.000Z');
  });

  it('keeps the previous window the same length as the current one', () => {
    const w = rangeWindow('today', now);
    const span = Date.parse(w.from) - Date.parse(w.prevFrom);
    expect(span).toBe(24 * 60 * 60 * 1000);
  });

  it('maps range keys to day counts', () => {
    expect(daysFor('30d')).toBe(30);
    expect(daysFor('90d')).toBe(90);
  });

  it('computes the revenue trend, or null without a baseline', () => {
    expect(revenueDelta({ ...EMPTY_SNAPSHOT, kpis: { ...EMPTY_SNAPSHOT.kpis, revenue: 150 }, prevRevenue: 100 })).toBe(50);
    expect(revenueDelta({ ...EMPTY_SNAPSHOT, kpis: { ...EMPTY_SNAPSHOT.kpis, revenue: 80 }, prevRevenue: 100 })).toBe(-20);
    expect(revenueDelta({ ...EMPTY_SNAPSHOT, prevRevenue: 0 })).toBeNull();
  });

  it('normalises a partial or missing RPC payload', () => {
    expect(toSnapshot(null)).toEqual(EMPTY_SNAPSHOT);
    const s = toSnapshot({ kpis: { revenue: 10 }, series: [{ day: '2026-06-10', revenue: 10 }] });
    expect(s.kpis.revenue).toBe(10);
    expect(s.kpis.orders).toBe(0);
    expect(s.series).toHaveLength(1);
    expect(s.byBranch).toEqual({});
  });

  it('exports the daily series as CSV', () => {
    const csv = statsToCsv([{ day: '2026-06-10', revenue: 300 }]);
    expect(csv.split('\n')[1]).toBe('2026-06-10,300');
  });
});

describe('admin-stats — profondeur (0053)', () => {
  it('calcule une évolution en %, nulle sans base', () => {
    expect(pctDelta(150, 100)).toBe(50);
    expect(pctDelta(80, 100)).toBe(-20);
    expect(pctDelta(10, 0)).toBeNull();
  });

  it('ne marque le rapport étendu que si la fonction 0053 a répondu', () => {
    expect(toSnapshot({ kpis: {} }).extended).toBe(false);
    const s = toSnapshot({
      modes: { livraison: { orders: 3, revenue: 300 } },
      cancelled: { count: 1, total: 4 },
      heatmap: [{ dow: 5, hour: 19, orders: 2 }],
      prevKpis: { orders: 2 },
    });
    expect(s.extended).toBe(true);
    expect(s.prevKpis.orders).toBe(2);
    expect(s.prevKpis.revenue).toBe(0);
    expect(s.cancelled).toEqual({ count: 1, total: 4 });
    expect(s.heatmap).toHaveLength(1);
  });

  it('calcule le taux d’annulation, nul sur une période vide', () => {
    expect(cancellationRate({ ...EMPTY_SNAPSHOT, cancelled: { count: 1, total: 4 } })).toBe(25);
    expect(cancellationRate(EMPTY_SNAPSHOT)).toBeNull();
  });

  it('remplit la grille jour × heure, lundi en premier, en ignorant les cases hors bornes', () => {
    const { grid, max } = heatmapGrid([
      { dow: 1, hour: 0, orders: 2 },
      { dow: 7, hour: 23, orders: 5 },
      { dow: 9, hour: 3, orders: 99 },
    ]);
    expect(grid).toHaveLength(7);
    expect(grid[0][0]).toBe(2);
    expect(grid[6][23]).toBe(5);
    expect(max).toBe(5);
  });

  it('répartit livraison et retrait, toujours les deux lignes', () => {
    const rows = modeShares({ livraison: { orders: 3, revenue: 300 }, retrait: { orders: 1, revenue: 50 } });
    expect(rows.map((r) => [r.key, r.share])).toEqual([['livraison', 75], ['retrait', 25]]);
    expect(modeShares({}).map((r) => r.share)).toEqual([0, 0]);
  });

  it('donne au top produits une largeur relative au premier et une part du CA', () => {
    const rows = topWithShares([{ name: 'A', qty: 2, revenue: 200 }, { name: 'B', qty: 1, revenue: 50 }], 400);
    expect(rows[0]).toMatchObject({ width: 1, share: 50 });
    expect(rows[1]).toMatchObject({ width: 0.25, share: 13 });
    expect(topWithShares([{ name: 'A', qty: 1, revenue: 10 }], 0)[0].share).toBeNull();
  });
});
