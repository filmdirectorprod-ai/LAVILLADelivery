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

/** Cumulative-points thresholds per tier — the ones place_order and
 *  admin_adjust_points use. */
export const TIER_THRESHOLDS: Record<LoyaltyTier, number> = {
  Gourmand: 0,
  Connaisseur: 500,
  Gourmet: 1000,
  'Cercle Villa': 1500,
};

/** A stored tier, or Gourmand when it is missing or unknown. */
export function normaliseTier(tier: string | null): LoyaltyTier {
  return (LOYALTY_TIERS as readonly string[]).includes(tier ?? '') ? (tier as LoyaltyTier) : 'Gourmand';
}

// Combining diacritical marks (U+0300–U+036F) left over after NFD decomposition.
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Members matching a name query (case- and accent-insensitive) and a tier,
 *  highest balance first. */
export function filterMembers(members: LoyaltyMember[], query: string, tier: LoyaltyTier | 'all'): LoyaltyMember[] {
  const q = fold(query.trim());
  return members
    .filter((m) => (tier === 'all' || normaliseTier(m.tier) === tier) && (!q || fold(m.name).includes(q)))
    .sort((a, b) => b.points - a.points);
}

export interface LedgerEntry {
  id: string;
  userId: string;
  name: string;
  /** Points gained (> 0) or spent (< 0). */
  delta: number;
  reason: string;
  createdAt: string;
}

/** Rows of admin_loyalty_activity (0053) → ledger entries. */
export function toLedgerEntries(rows: unknown): LedgerEntry[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const x = r as { id: string; user_id: string; name: string | null; delta_pts: number; reason: string | null; created_at: string };
    return { id: x.id, userId: x.user_id, name: x.name || 'Client', delta: Number(x.delta_pts) || 0, reason: x.reason || '—', createdAt: x.created_at };
  });
}

export interface FlowDay {
  day: string;
  earned: number;
  spent: number;
}

/** Rows of admin_loyalty_flow (0053) → one entry per day. */
export function toFlow(rows: unknown): FlowDay[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const x = r as { day: string; earned: number | string | null; spent: number | string | null };
    return { day: x.day, earned: Number(x.earned ?? 0) || 0, spent: Number(x.spent ?? 0) || 0 };
  });
}

/** Points distributed, spent, and the net over a flow. */
export function flowTotals(days: FlowDay[]): { earned: number; spent: number; net: number } {
  const earned = days.reduce((n, d) => n + d.earned, 0);
  const spent = days.reduce((n, d) => n + d.spent, 0);
  return { earned, spent, net: earned - spent };
}
