import { describe, it, expect } from 'vitest';
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
