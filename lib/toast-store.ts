'use client';
// Ephemeral toast ("flash") messages, replacing the prototype's per-phone toast.
import { create } from 'zustand';

interface ToastState {
  message: string | null;
  show: (message: string) => void;
  hide: () => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export const useToast = create<ToastState>((set) => ({
  message: null,
  show: (message) => {
    set({ message });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => set({ message: null }), 1700);
  },
  hide: () => set({ message: null }),
}));
