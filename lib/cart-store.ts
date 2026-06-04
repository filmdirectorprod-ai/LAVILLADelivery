'use client';
// Client cart state (Zustand + localStorage), mirroring the prototype's
// serialisable cart (store.jsx / app.jsx). Each line is { productId, qty, opts }
// where opts.unit is the resolved unit price (base price × size multiplier).
//
// The server re-derives all money from authoritative prices at checkout
// (place_order RPC); this store only drives the cart UI + subtotal display.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartOpts {
  /** Resolved unit price in DH (base price × size multiplier). */
  unit: number;
  /** Size price multiplier (0.25 / 1 / 1.6); the server re-derives price from it. */
  sizeMult: number;
  sizeLabel: string | null;
  flavor: string | null;
  message: string;
  date: string;
}

export interface CartLine {
  productId: string;
  qty: number;
  opts: CartOpts;
}

/** Default options for a non-customized line at unit price. */
export function defaultOpts(unit: number): CartOpts {
  return { unit, sizeMult: 1, sizeLabel: null, flavor: null, message: '', date: '' };
}

interface CartState {
  items: CartLine[];
  add: (productId: string, qty: number, opts: CartOpts) => void;
  quickAdd: (product: { id: string; price_dh: number }) => void;
  setQty: (index: number, qty: number) => void;
  removeAt: (index: number) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (productId, qty, opts) =>
        set((s) => ({ items: [...s.items, { productId, qty, opts }] })),
      quickAdd: (product) =>
        set((s) => ({
          items: [...s.items, { productId: product.id, qty: 1, opts: defaultOpts(product.price_dh) }],
        })),
      setQty: (index, qty) =>
        set((s) => ({
          items: s.items.map((it, i) => (i === index ? { ...it, qty } : it)),
        })),
      removeAt: (index) =>
        set((s) => ({ items: s.items.filter((_, i) => i !== index) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'lv-cart' },
  ),
);

/** Total item count (Σ qty). */
export const cartCount = (items: CartLine[]): number =>
  items.reduce((n, it) => n + it.qty, 0);

/** Cart subtotal in DH (Σ opts.unit × qty). */
export const cartSubtotal = (items: CartLine[]): number =>
  items.reduce((n, it) => n + it.opts.unit * it.qty, 0);
