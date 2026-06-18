import { describe, it, expect } from 'vitest';
import {
  toConfirmItems,
  itemsSubtotal,
  computeDelivery,
  recomputeTotals,
  setItemQty,
  removeItem,
  addItem,
  canConfirm,
  toItemsPayload,
  type ConfirmItem,
} from '@/lib/order-confirm';
import type { OrderItem } from '@/lib/types';

function row(p: Partial<OrderItem> & { id: string }): OrderItem {
  return {
    id: p.id,
    order_id: 'o1',
    product_id: p.product_id ?? 'prod-' + p.id,
    name_snapshot: p.name_snapshot ?? 'Article',
    price_snapshot: p.price_snapshot ?? 50,
    qty: p.qty ?? 1,
    customization: {},
  };
}

const items: ConfirmItem[] = [
  { id: 'a', product_id: 'p1', name: 'Tarte', price: 60, qty: 2 },
  { id: 'b', product_id: 'p2', name: 'Café', price: 20, qty: 1 },
];

describe('toConfirmItems', () => {
  it('maps snapshot rows to editable items', () => {
    const out = toConfirmItems([row({ id: 'a', name_snapshot: 'Tarte', price_snapshot: 60, qty: 2 })]);
    expect(out).toEqual([{ id: 'a', product_id: 'prod-a', name: 'Tarte', price: 60, qty: 2 }]);
  });
});

describe('itemsSubtotal', () => {
  it('sums price × qty', () => {
    expect(itemsSubtotal(items)).toBe(140); // 60*2 + 20*1
  });
});

describe('computeDelivery', () => {
  it('is 0 for retrait', () => {
    expect(computeDelivery(50, 'retrait', 18)).toBe(0);
  });
  it('is 0 above the free threshold', () => {
    expect(computeDelivery(250, 'livraison', 18)).toBe(0);
  });
  it('is the zone fee otherwise', () => {
    expect(computeDelivery(140, 'livraison', 15)).toBe(15);
  });
});

describe('recomputeTotals', () => {
  it('recomputes subtotal + delivery + total, preserving fixed discounts', () => {
    const r = recomputeTotals(items, { mode: 'livraison', zoneFee: 15, discountDh: 10, pointsDiscountDh: 0 });
    expect(r.subtotal).toBe(140);
    expect(r.deliveryFee).toBe(15);
    expect(r.total).toBe(145); // 140 + 15 - 10
  });
  it('never goes below 0', () => {
    const r = recomputeTotals([{ id: 'x', product_id: 'p', name: 'X', price: 5, qty: 1 }], { mode: 'retrait', discountDh: 100 });
    expect(r.total).toBe(0);
  });
});

describe('setItemQty', () => {
  it('updates one item, clamping to ≥ 1', () => {
    expect(setItemQty(items, 'a', 5).find((i) => i.id === 'a')!.qty).toBe(5);
    expect(setItemQty(items, 'a', 0).find((i) => i.id === 'a')!.qty).toBe(1);
  });
});

describe('removeItem', () => {
  it('drops the item', () => {
    expect(removeItem(items, 'a').map((i) => i.id)).toEqual(['b']);
  });
});

describe('addItem', () => {
  it('appends a new product line', () => {
    const out = addItem(items, { id: 'p3', name: 'Thé', price: 22 });
    expect(out).toHaveLength(3);
    expect(out[2]).toMatchObject({ product_id: 'p3', name: 'Thé', price: 22, qty: 1 });
  });
  it('bumps qty if the product is already present', () => {
    const out = addItem(items, { id: 'p1', name: 'Tarte', price: 60 });
    expect(out).toHaveLength(2);
    expect(out.find((i) => i.product_id === 'p1')!.qty).toBe(3);
  });
});

describe('canConfirm', () => {
  it('true with items, false when empty', () => {
    expect(canConfirm(items)).toBe(true);
    expect(canConfirm([])).toBe(false);
  });
});

describe('toItemsPayload', () => {
  it('produces {product_id, qty}, dropping null products', () => {
    const withNull = [...items, { id: 'c', product_id: null, name: 'Manuel', price: 10, qty: 1 }];
    expect(toItemsPayload(withNull)).toEqual([
      { product_id: 'p1', qty: 2 },
      { product_id: 'p2', qty: 1 },
    ]);
  });
});
