'use client';
// Shared "I'm available" switch for the driver app. The dashboard toggle writes it;
// DriverPresence reads it and heartbeats driver_set_presence accordingly, so the
// driver can mark themselves unavailable to the admin WITHOUT closing the app.
// Persisted to localStorage; default available.
import { create } from 'zustand';

const KEY = 'lv-driver-online';

interface DriverOnlineState {
  online: boolean;
  setOnline: (v: boolean) => void;
  toggle: () => void;
  /** Load the persisted preference (call once on the client). */
  hydrate: () => void;
}

export const useDriverOnline = create<DriverOnlineState>((set, get) => ({
  online: true,
  setOnline: (v) => {
    try {
      localStorage.setItem(KEY, v ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
    set({ online: v });
  },
  toggle: () => get().setOnline(!get().online),
  hydrate: () => {
    try {
      const v = localStorage.getItem(KEY);
      if (v !== null) set({ online: v === '1' });
    } catch {
      /* storage unavailable */
    }
  },
}));
