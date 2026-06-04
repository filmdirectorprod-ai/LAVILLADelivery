'use client';
// Client-side favorites (Zustand + localStorage). The prototype kept favorites
// in its shared in-memory store; there is no server `favorites` table, so we
// persist the set of favorited product ids locally. Purely a UI affordance.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FavoritesState {
  ids: Record<string, boolean>;
  isFav: (id: string) => boolean;
  toggle: (id: string) => void;
}

export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      ids: {},
      isFav: (id) => !!get().ids[id],
      toggle: (id) =>
        set((s) => ({ ids: { ...s.ids, [id]: !s.ids[id] } })),
    }),
    { name: 'lv-favs' },
  ),
);
