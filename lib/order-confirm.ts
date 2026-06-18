// lib/order-confirm.ts — Pure logic for the gérant order-confirmation panel.
// The gérant adjusts an order's items (qty / remove / add) and delivery while it
// is still `pending`. We recompute subtotal + delivery + total here for the live
// preview; the server (admin_update_order_* RPCs) recomputes authoritatively. The
// original promo discount and points redemption are preserved as fixed DH amounts
// (editing quantities shouldn't silently re-run loyalty math).
import { FREE_DELIVERY_THRESHOLD, DEFAULT_ZONE_FEE } from '@/lib/pricing';
import type { OrderMode, OrderItem } from '@/lib/types';

export interface ConfirmItem {
  /** order_items.id for existing rows, or a temp id ("new-…") for added ones. */
  id: string;
  product_id: string | null;
  name: string;
  /** Unit price in DH (price_snapshot for existing, product price for added). */
  price: number;
  qty: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Build editable items from the order's snapshot rows. */
export function toConfirmItems(items: OrderItem[]): ConfirmItem[] {
  return items.map((it) => ({
    id: it.id,
    product_id: it.product_id,
    name: it.name_snapshot,
    price: it.price_snapshot,
    qty: it.qty,
  }));
}

export function itemsSubtotal(items: ConfirmItem[]): number {
  return round2(items.reduce((sum, it) => sum + it.price * it.qty, 0));
}

export function computeDelivery(subtotal: number, mode: OrderMode, zoneFee: number): number {
  if (mode === 'retrait') return 0;
  if (subtotal >= FREE_DELIVERY_THRESHOLD) return 0;
  return zoneFee;
}

export interface RecomputeOpts {
  mode: OrderMode;
  zoneFee?: number;
  /** Original promo discount in DH, preserved across edits. */
  discountDh?: number;
  /** Original points-redemption discount in DH, preserved across edits. */
  pointsDiscountDh?: number;
}

export interface RecomputeResult {
  subtotal: number;
  deliveryFee: number;
  total: number;
}

export function recomputeTotals(items: ConfirmItem[], opts: RecomputeOpts): RecomputeResult {
  const subtotal = itemsSubtotal(items);
  const deliveryFee = computeDelivery(subtotal, opts.mode, opts.zoneFee ?? DEFAULT_ZONE_FEE);
  const total = Math.max(
    0,
    round2(subtotal + deliveryFee - (opts.discountDh ?? 0) - (opts.pointsDiscountDh ?? 0)),
  );
  return { subtotal, deliveryFee, total };
}

/** Set an item's quantity (clamped to ≥ 1). Use removeItem to delete. */
export function setItemQty(items: ConfirmItem[], id: string, qty: number): ConfirmItem[] {
  const q = Math.max(1, Math.floor(qty));
  return items.map((it) => (it.id === id ? { ...it, qty: q } : it));
}

export function removeItem(items: ConfirmItem[], id: string): ConfirmItem[] {
  return items.filter((it) => it.id !== id);
}

let addSeq = 0;
/** Append a product as a new line (qty 1), or bump qty if already present. */
export function addItem(
  items: ConfirmItem[],
  product: { id: string; name: string; price: number },
): ConfirmItem[] {
  const existing = items.find((it) => it.product_id === product.id);
  if (existing) return setItemQty(items, existing.id, existing.qty + 1);
  return [
    ...items,
    { id: `new-${product.id}-${addSeq++}`, product_id: product.id, name: product.name, price: product.price, qty: 1 },
  ];
}

/** A pending order can be confirmed only with at least one item, all qty ≥ 1. */
export function canConfirm(items: ConfirmItem[]): boolean {
  return items.length > 0 && items.every((it) => it.qty >= 1);
}

/** Payload for admin_update_order_items: minimal {product_id, qty} list. */
export function toItemsPayload(items: ConfirmItem[]): { product_id: string; qty: number }[] {
  return items
    .filter((it): it is ConfirmItem & { product_id: string } => it.product_id != null)
    .map((it) => ({ product_id: it.product_id, qty: it.qty }));
}
