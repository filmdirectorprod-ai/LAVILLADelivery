import { describe, it, expect, beforeEach } from 'vitest';
import { useCart, defaultOpts, cartCount, cartSubtotal } from '@/lib/cart-store';

beforeEach(() => {
  useCart.getState().clear();
});

describe('cart store', () => {
  it('quickAdd appends a line at unit price', () => {
    useCart.getState().quickAdd({ id: 'r-the', price_dh: 22 });
    const { items } = useCart.getState();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ productId: 'r-the', qty: 1 });
    expect(items[0].opts.unit).toBe(22);
  });

  it('computes count and subtotal from lines', () => {
    const { add } = useCart.getState();
    add('p-fraisier', 1, defaultOpts(165));
    add('r-the', 2, defaultOpts(22));
    const { items } = useCart.getState();
    expect(cartCount(items)).toBe(3);
    expect(cartSubtotal(items)).toBe(165 + 22 * 2);
  });

  it('setQty and removeAt mutate by index', () => {
    const { add } = useCart.getState();
    add('a', 1, defaultOpts(10));
    add('b', 1, defaultOpts(20));
    useCart.getState().setQty(0, 5);
    expect(useCart.getState().items[0].qty).toBe(5);
    useCart.getState().removeAt(0);
    expect(useCart.getState().items).toHaveLength(1);
    expect(useCart.getState().items[0].productId).toBe('b');
  });
});
