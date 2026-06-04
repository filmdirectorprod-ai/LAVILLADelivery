import { describe, it, expect } from 'vitest';
import { computeOrder } from '@/lib/pricing';

describe('computeOrder', () => {
  const items = [
    { price: 100, qty: 1 },
    { price: 50, qty: 2 },
  ]; // subtotal 200

  it('gives free delivery at >=200 and earns floor(total) pts', () => {
    const r = computeOrder({
      items,
      mode: 'livraison',
      zoneFee: 15,
      promo: false,
      pointsBalance: 0,
    });
    expect(r.subtotal).toBe(200);
    expect(r.deliveryFee).toBe(0);
    expect(r.total).toBe(200);
    expect(r.pointsEarned).toBe(200);
  });

  it('applies 15% promo then charges zone fee under threshold', () => {
    const r = computeOrder({
      items: [{ price: 100, qty: 1 }],
      mode: 'livraison',
      zoneFee: 15,
      promo: true,
      pointsBalance: 0,
    });
    expect(r.subtotal).toBe(100);
    expect(r.discount).toBe(15);
    expect(r.deliveryFee).toBe(15);
    // base = 100 + 15 - 15 = 100
    expect(r.total).toBe(100);
    expect(r.pointsEarned).toBe(100);
  });

  it('defaults zone fee to 18 when omitted', () => {
    const r = computeOrder({
      items: [{ price: 100, qty: 1 }],
      mode: 'livraison',
      promo: false,
      pointsBalance: 0,
    });
    expect(r.deliveryFee).toBe(18);
    expect(r.total).toBe(118);
  });

  it('honours a valid palier when the balance can afford it', () => {
    const r = computeOrder({
      items: [{ price: 200, qty: 1 }],
      mode: 'retrait',
      promo: false,
      redeemPts: 500,
      redeemDh: 60,
      pointsBalance: 800,
    });
    expect(r.baseTotal).toBe(200);
    expect(r.pointsRedeemed).toBe(500);
    expect(r.pointsDiscount).toBe(60);
    expect(r.total).toBe(140);
    expect(r.pointsEarned).toBe(140);
  });

  it('rejects a palier when the balance is insufficient', () => {
    const r = computeOrder({
      items: [{ price: 200, qty: 1 }],
      mode: 'retrait',
      promo: false,
      redeemPts: 500,
      redeemDh: 60,
      pointsBalance: 100,
    });
    expect(r.pointsRedeemed).toBe(0);
    expect(r.pointsDiscount).toBe(0);
    expect(r.total).toBe(200);
  });

  it('rejects an unknown (pts, dh) palier pair', () => {
    const r = computeOrder({
      items: [{ price: 200, qty: 1 }],
      mode: 'retrait',
      promo: false,
      redeemPts: 250,
      redeemDh: 130, // 250 -> 25, not 130
      pointsBalance: 5000,
    });
    expect(r.pointsRedeemed).toBe(0);
    expect(r.pointsDiscount).toBe(0);
    expect(r.total).toBe(200);
  });

  it('caps the palier discount at the base total', () => {
    const r = computeOrder({
      items: [{ price: 50, qty: 1 }],
      mode: 'retrait',
      promo: false,
      redeemPts: 1000,
      redeemDh: 130,
      pointsBalance: 2000,
    });
    expect(r.pointsDiscount).toBe(50); // min(130, 50)
    expect(r.total).toBe(0);
    expect(r.pointsEarned).toBe(0);
  });
});

// These lock the rounding semantics that MUST agree with the server-side
// place_order RPC (supabase/migrations/0004_place_order.sql). The client only
// displays the bill, but if its rounding drifts from the SQL the user would be
// shown a different total than they are charged.
describe('computeOrder ↔ place_order parity (rounding)', () => {
  it('handles fractional unit prices from cake-size multipliers and floors earned pts', () => {
    // 165 DH × 0.25 (individuel) = 41.25 ; 11 DH × 1.6 (8–10 pers.) = 17.6
    const r = computeOrder({
      items: [
        { price: 41.25, qty: 1 },
        { price: 17.6, qty: 1 },
      ],
      mode: 'livraison',
      zoneFee: 18,
      promo: false,
      pointsBalance: 0,
    });
    expect(r.subtotal).toBe(58.85);
    expect(r.total).toBe(76.85); // 58.85 + 18
    expect(r.pointsEarned).toBe(76); // floor, not round
  });

  it('rounds the 15% promo half-up, matching Postgres round(x, 0)', () => {
    // subtotal 110 → 110 × 0.15 = 16.5 ; JS Math.round and Postgres round both
    // resolve the .5 away from zero → 17. retrait isolates the discount.
    const r = computeOrder({
      items: [{ price: 110, qty: 1 }],
      mode: 'retrait',
      promo: true,
      pointsBalance: 0,
    });
    expect(r.discount).toBe(17);
    expect(r.total).toBe(93); // 110 - 17
    expect(r.pointsEarned).toBe(93);
  });
});
