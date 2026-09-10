import { describe, it, expect } from 'vitest';
import { filterMembers, normaliseTier, toLedgerEntries, toFlow, flowTotals } from '@/lib/admin-loyalty';
import { loyaltyOverview, type LoyaltyMember } from '@/lib/admin-loyalty';

const m = (id: string, points: number, tier: string | null): LoyaltyMember => ({ id, name: 'U' + id, points, tier });

describe('admin-loyalty', () => {
  const members = [
    m('a', 1600, 'Cercle Villa'),
    m('b', 300, 'Gourmand'),
    m('c', 700, 'Connaisseur'),
    m('d', 50, null),
  ];

  it('sums outstanding points and counts members', () => {
    const o = loyaltyOverview(members);
    expect(o.totalMembers).toBe(4);
    expect(o.totalPoints).toBe(2650);
  });

  it('distributes by tier (unknown/null → Gourmand)', () => {
    const o = loyaltyOverview(members);
    expect(o.byTier).toEqual({ Gourmand: 2, Connaisseur: 1, Gourmet: 0, 'Cercle Villa': 1 });
  });

  it('ranks top members by points', () => {
    const o = loyaltyOverview(members, 2);
    expect(o.top.map((x) => x.id)).toEqual(['a', 'c']);
  });
});

describe('admin-loyalty — recherche et mouvements', () => {
  const members = [
    { id: '1', name: 'Ibrahima Kanté', points: 1411, tier: 'Gourmet' },
    { id: '2', name: 'Younes', points: 586, tier: 'Connaisseur' },
    { id: '3', name: 'Kamal', points: 120, tier: null },
  ];

  it('cherche sans tenir compte des accents ni de la casse', () => {
    expect(filterMembers(members, 'KANTE', 'all').map((m) => m.id)).toEqual(['1']);
  });

  it('filtre par palier, un palier absent comptant comme Gourmand', () => {
    expect(filterMembers(members, '', 'Gourmand').map((m) => m.id)).toEqual(['3']);
    expect(filterMembers(members, '', 'all').map((m) => m.id)).toEqual(['1', '2', '3']);
    expect(normaliseTier('Inconnu')).toBe('Gourmand');
  });

  it('convertit le fil des mouvements', () => {
    expect(
      toLedgerEntries([{ id: 'l1', user_id: 'u1', name: 'A', delta_pts: -100, reason: 'Récompense', created_at: '2026-06-01T10:00:00Z' }]),
    ).toEqual([{ id: 'l1', userId: 'u1', name: 'A', delta: -100, reason: 'Récompense', createdAt: '2026-06-01T10:00:00Z' }]);
    expect(toLedgerEntries(null)).toEqual([]);
  });

  it('totalise les points gagnés et utilisés', () => {
    expect(toFlow([{ day: '2026-06-01', earned: '10', spent: null }])).toEqual([{ day: '2026-06-01', earned: 10, spent: 0 }]);
    expect(flowTotals([{ day: 'a', earned: 100, spent: 20 }, { day: 'b', earned: 5, spent: 0 }])).toEqual({ earned: 105, spent: 20, net: 85 });
  });
});
