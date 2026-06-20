// Order pricing + loyalty math for La Villa.
//
// Pure, client-side mirror of the server-authoritative `place_order` RPC
// (supabase/migrations/0004_place_order.sql) and the prototype checkout
// (screens-order.jsx). Used only to DISPLAY the bill; the server recomputes
// everything from authoritative product prices at order time.
//
// Pricing model (verbatim from the prototype):
//   subtotal   = Σ price * qty
//   delivery   = mode==='retrait' ? 0 : (subtotal >= 200 ? 0 : zoneFee)   [zoneFee default 18]
//   discount   = promo ? round(subtotal * 0.15) : 0
//   baseTotal  = subtotal + delivery - discount
//   ptsDiscount= valid palier {pts,dh} & balance>=pts ? min(dh, baseTotal) : 0
//   total      = baseTotal - ptsDiscount
//   pointsEarned = floor(total)          (1 DH spent = 1 pt)

export const FREE_DELIVERY_THRESHOLD = 200;
export const DEFAULT_ZONE_FEE = 18;
export const PROMO_RATE = 0.15;

/** Discrete loyalty redemption paliers (pts -> DH off). */
export const REDEEM_PALIERS: { pts: number; dh: number }[] = [
  { pts: 250, dh: 25 },
  { pts: 500, dh: 60 },
  { pts: 1000, dh: 130 },
];

export interface PriceItem {
  /** Resolved unit price in DH (already includes any size multiplier). */
  price: number;
  qty: number;
}

export interface ComputeOrderInput {
  items: PriceItem[];
  mode: 'livraison' | 'retrait';
  /** Selected delivery-zone fee; defaults to 18 when omitted. */
  zoneFee?: number;
  promo: boolean;
  /** Explicit promo-code discount in DH (0035 promotions). When provided it
   *  replaces the blanket `promo` rate. Capped at the subtotal. */
  promoDiscount?: number;
  /** Chosen redemption palier points (0 = none). */
  redeemPts?: number;
  /** Chosen palier DH value (must pair with redeemPts to be honoured). */
  redeemDh?: number;
  /** Current loyalty balance, to validate affordability of the palier. */
  pointsBalance: number;
}

export interface ComputeOrderResult {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  baseTotal: number;
  pointsRedeemed: number;
  pointsDiscount: number;
  total: number;
  pointsEarned: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Is (pts, dh) a real palier the user can afford? */
function validPalier(pts: number, dh: number, balance: number): boolean {
  return (
    balance >= pts &&
    REDEEM_PALIERS.some((p) => p.pts === pts && p.dh === dh)
  );
}

export function computeOrder(input: ComputeOrderInput): ComputeOrderResult {
  const {
    items,
    mode,
    zoneFee = DEFAULT_ZONE_FEE,
    promo,
    promoDiscount,
    redeemPts = 0,
    redeemDh = 0,
    pointsBalance,
  } = input;

  const subtotal = round2(
    items.reduce((sum, it) => sum + it.price * it.qty, 0),
  );

  const deliveryFee =
    mode === 'retrait' || subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : zoneFee;

  const discount =
    promoDiscount != null
      ? Math.min(Math.max(0, Math.round(promoDiscount)), subtotal)
      : promo
        ? Math.round(subtotal * PROMO_RATE)
        : 0;

  const baseTotal = round2(subtotal + deliveryFee - discount);

  let pointsRedeemed = 0;
  let pointsDiscount = 0;
  if (redeemPts > 0 && validPalier(redeemPts, redeemDh, pointsBalance)) {
    pointsDiscount = Math.min(redeemDh, baseTotal);
    pointsRedeemed = redeemPts;
  }

  const total = round2(baseTotal - pointsDiscount);
  const pointsEarned = Math.floor(total);

  return {
    subtotal,
    deliveryFee,
    discount,
    baseTotal,
    pointsRedeemed,
    pointsDiscount,
    total,
    pointsEarned,
  };
}
