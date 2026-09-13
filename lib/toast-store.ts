'use client';
// Ephemeral toast ("flash") messages, replacing the prototype's per-phone toast.
import { create } from 'zustand';

/** « ok » confirme une action, « alert » signale qu'elle a échoué. Le ton change
 *  l'icône et la couleur : un message d'échec affiché sous une coche verte se
 *  lit comme un succès, et l'utilisateur repart en croyant que c'est fait. */
export type ToastTone = 'ok' | 'alert';

interface ToastState {
  message: string | null;
  tone: ToastTone;
  show: (message: string, tone?: ToastTone) => void;
  hide: () => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export const useToast = create<ToastState>((set) => ({
  message: null,
  tone: 'ok',
  show: (message, tone = 'ok') => {
    set({ message, tone });
    if (timer) clearTimeout(timer);
    // Un échec doit rester lisible plus longtemps qu'une confirmation : on le
    // découvre sans l'attendre, et il demande souvent de relire.
    timer = setTimeout(() => set({ message: null }), tone === 'alert' ? 4200 : 1700);
  },
  hide: () => set({ message: null }),
}));
