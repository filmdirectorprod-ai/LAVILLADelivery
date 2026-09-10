'use client';
// Small shared "new message" chime built on the Web Audio API (no asset to load).
// Browsers block audio until the user interacts, so the AudioContext is created /
// resumed on the first pointer or key event. Used by the support + chat screens so
// a new incoming message is audible even before any push permission is granted.
import { useCallback, useEffect, useRef } from 'react';

export function useBeep() {
  const ctxRef = useRef<AudioContext | null>(null);

  const ensure = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (!ctxRef.current) {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctxRef.current = new Ctx();
      } catch {
        return null;
      }
    }
    ctxRef.current?.resume().catch(() => {});
    return ctxRef.current;
  }, []);

  // Unlock the audio context on the first user gesture.
  useEffect(() => {
    const onGesture = () => ensure();
    window.addEventListener('pointerdown', onGesture, { once: true });
    window.addEventListener('keydown', onGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, [ensure]);

  const beep = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime;
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.start(t);
      osc.stop(t + 0.26);
    } catch {
      /* ignore */
    }
  }, []);

  return { beep, ensure };
}
