'use client';
// Shared browsing/order mode (livraison vs retrait). In the prototype this
// lived on the per-phone AppInstance and was read by Home, Cart and Checkout.
// Here it is a tiny persisted store so the same choice follows the user across
// routes. It only affects display + the delivery-fee preview; the server
// re-derives the authoritative total at checkout.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OrderMode } from '@/lib/types';

interface OrderModeState {
  mode: OrderMode;
  setMode: (mode: OrderMode) => void;
  /** Whether the 15% promo code was applied in the cart (flows to checkout). */
  promo: boolean;
  setPromo: (promo: boolean) => void;
}

export const useOrderMode = create<OrderModeState>()(
  persist(
    (set) => ({
      mode: 'livraison',
      setMode: (mode) => set({ mode }),
      promo: false,
      setPromo: (promo) => set({ promo }),
    }),
    { name: 'lv-mode' },
  ),
);
