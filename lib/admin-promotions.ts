// Pure, testable helpers for the admin Promotions screen: a code's state, its
// usage gauge, the header KPIs and the recent-redemptions feed. No React, no I/O.

export interface PromoLike {
  id: string;
  code: string;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
}

export interface Redemption {
  id: string;
  promotionId: string;
  discount: number;
  createdAt: string;
  orderCode: string | null;
  orderTotal: number | null;
}

export type PromoState = 'active' | 'scheduled' | 'expired' | 'exhausted' | 'inactive';

export const PROMO_STATE_LABEL: Record<PromoState, string> = {
  active: 'Actif',
  scheduled: 'Programmé',
  expired: 'Expiré',
  exhausted: 'Épuisé',
  inactive: 'Inactif',
};

/** Where a code stands right now. A switched-off code is inactive whatever its
 *  dates say; past its end it is expired before being exhausted. */
export function promoState(p: PromoLike, uses: number, now: Date = new Date()): PromoState {
  if (!p.active) return 'inactive';
  if (p.ends_at && Date.parse(p.ends_at) < now.getTime()) return 'expired';
  if (p.max_uses != null && uses >= p.max_uses) return 'exhausted';
  if (p.starts_at && Date.parse(p.starts_at) > now.getTime()) return 'scheduled';
  return 'active';
}

/** Filled share of the quota (0–1), or null for an unlimited code. */
export function usageRatio(uses: number, maxUses: number | null): number | null {
  if (maxUses == null || maxUses <= 0) return null;
  return Math.min(1, uses / maxUses);
}

/** promo_redemptions rows with the embedded order → redemptions. */
export function toRedemptions(rows: unknown): Redemption[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const x = r as {
      id: string;
      promotion_id: string;
      discount_dh: number | string | null;
      created_at: string;
      orders: { code: string | null; total_dh: number | string | null } | { code: string | null; total_dh: number | string | null }[] | null;
    };
    const order = Array.isArray(x.orders) ? x.orders[0] ?? null : x.orders;
    return {
      id: x.id,
      promotionId: x.promotion_id,
      discount: Number(x.discount_dh ?? 0) || 0,
      createdAt: x.created_at,
      orderCode: order?.code ?? null,
      orderTotal: order?.total_dh == null ? null : Number(order.total_dh),
    };
  });
}

/** Redemptions of the codes the caller can see — a branch gérant reads every
 *  redemption row, but only their agency's codes. */
export function visibleRedemptions(promos: PromoLike[], redemptions: Redemption[]): Redemption[] {
  const ids = new Set(promos.map((p) => p.id));
  return redemptions.filter((r) => ids.has(r.promotionId));
}

/** Uses per promo id. */
export function usesByPromo(redemptions: Redemption[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of redemptions) out[r.promotionId] = (out[r.promotionId] ?? 0) + 1;
  return out;
}

export interface PromoKpis {
  active: number;
  uses: number;
  discount: number;
  revenue: number;
}

/** Header figures: codes active now, total uses, discount granted and the order
 *  revenue those codes brought in. */
export function promoKpis(promos: PromoLike[], redemptions: Redemption[], now: Date = new Date()): PromoKpis {
  const mine = visibleRedemptions(promos, redemptions);
  const uses = usesByPromo(mine);
  return {
    active: promos.filter((p) => promoState(p, uses[p.id] ?? 0, now) === 'active').length,
    uses: mine.length,
    discount: mine.reduce((n, r) => n + r.discount, 0),
    revenue: mine.reduce((n, r) => n + (r.orderTotal ?? 0), 0),
  };
}

/** Latest visible redemptions, newest first. */
export function recentRedemptions(promos: PromoLike[], redemptions: Redemption[], n = 10): Redemption[] {
  return visibleRedemptions(promos, redemptions)
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, n);
}

/** Columns the screen and the page read from promo_redemptions — with the order
 *  it paid for, embedded through the order_id foreign key. */
export const REDEMPTIONS_SELECT = 'id, promotion_id, discount_dh, created_at, orders(code, total_dh)';
