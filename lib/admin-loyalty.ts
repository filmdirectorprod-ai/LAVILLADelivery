// Pure, testable aggregation for the admin Fidélité screen. Takes loyalty members
// (one per profile) and returns the overview the screen renders. No React, no I/O.

export const LOYALTY_TIERS = ['Gourmand', 'Connaisseur', 'Gourmet', 'Cercle Villa'] as const;
export type LoyaltyTier = (typeof LOYALTY_TIERS)[number];

export interface LoyaltyMember {
  id: string;
  name: string;
  points: number;
  tier: string | null;
}

export interface LoyaltyOverview {
  totalMembers: number;
  /** Points currently outstanding (the liability). */
  totalPoints: number;
  byTier: Record<LoyaltyTier, number>;
  top: LoyaltyMember[];
}

export function loyaltyOverview(members: LoyaltyMember[], topN = 10): LoyaltyOverview {
  const byTier = { Gourmand: 0, Connaisseur: 0, Gourmet: 0, 'Cercle Villa': 0 } as Record<LoyaltyTier, number>;
  let totalPoints = 0;
  for (const m of members) {
    totalPoints += m.points ?? 0;
    const tier = (LOYALTY_TIERS as readonly string[]).includes(m.tier ?? '') ? (m.tier as LoyaltyTier) : 'Gourmand';
    byTier[tier] += 1;
  }
  const top = members
    .slice()
    .sort((a, b) => b.points - a.points)
    .slice(0, topN);
  return { totalMembers: members.length, totalPoints, byTier, top };
}
