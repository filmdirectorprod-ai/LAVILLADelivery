import { describe, it, expect } from 'vitest';
import {
  promoState, usageRatio, toRedemptions, promoKpis, recentRedemptions, usesByPromo, type PromoLike, type Redemption,
} from '@/lib/admin-promotions';

const now = new Date('2026-06-15T12:00:00Z');
const promo = (over: Partial<PromoLike> = {}): PromoLike => ({
  id: 'p1', code: 'X', active: true, starts_at: null, ends_at: null, max_uses: null, ...over,
});
const red = (over: Partial<Redemption> = {}): Redemption => ({
  id: 'r', promotionId: 'p1', discount: 10, createdAt: '2026-06-10T10:00:00Z', orderCode: 'LV-1', orderTotal: 100, ...over,
});

describe('admin-promotions', () => {
  it('donne l’état d’un code, avec les bonnes priorités', () => {
    expect(promoState(promo({ active: false, ends_at: '2026-01-01T00:00:00Z' }), 0, now)).toBe('inactive');
    expect(promoState(promo({ ends_at: '2026-06-01T00:00:00Z', max_uses: 1 }), 5, now)).toBe('expired');
    expect(promoState(promo({ max_uses: 3 }), 3, now)).toBe('exhausted');
    expect(promoState(promo({ starts_at: '2026-07-01T00:00:00Z' }), 0, now)).toBe('scheduled');
    expect(promoState(promo(), 0, now)).toBe('active');
  });

  it('remplit la jauge, nulle pour un code illimité', () => {
    expect(usageRatio(3, null)).toBeNull();
    expect(usageRatio(3, 10)).toBe(0.3);
    expect(usageRatio(12, 10)).toBe(1);
  });

  it('lit la commande intégrée, objet ou tableau', () => {
    const rows = toRedemptions([
      { id: 'a', promotion_id: 'p1', discount_dh: '12.5', created_at: 't', orders: { code: 'LV-9', total_dh: '90' } },
      { id: 'b', promotion_id: 'p1', discount_dh: null, created_at: 't', orders: [{ code: 'LV-8', total_dh: 40 }] },
      { id: 'c', promotion_id: 'p1', discount_dh: 5, created_at: 't', orders: null },
    ]);
    expect(rows.map((r) => [r.discount, r.orderCode, r.orderTotal])).toEqual([[12.5, 'LV-9', 90], [0, 'LV-8', 40], [5, null, null]]);
  });

  it('calcule les indicateurs sur les seuls codes visibles', () => {
    const promos = [promo({ id: 'p1' }), promo({ id: 'p2', active: false })];
    const reds = [red({ discount: 10, orderTotal: 100 }), red({ discount: 5, orderTotal: 50 }), red({ promotionId: 'p9', discount: 99, orderTotal: 999 })];
    expect(promoKpis(promos, reds, now)).toEqual({ active: 1, uses: 2, discount: 15, revenue: 150 });
    expect(usesByPromo(reds)).toEqual({ p1: 2, p9: 1 });
  });

  it('liste les utilisations récentes, plus récentes d’abord', () => {
    const promos = [promo({ id: 'p1' })];
    const reds = [
      red({ id: 'old', createdAt: '2026-06-01T10:00:00Z' }),
      red({ id: 'new', createdAt: '2026-06-12T10:00:00Z' }),
      red({ id: 'hidden', promotionId: 'p9', createdAt: '2026-06-14T10:00:00Z' }),
    ];
    expect(recentRedemptions(promos, reds, 5).map((r) => r.id)).toEqual(['new', 'old']);
  });
});
