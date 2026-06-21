// components/driver/DriverPresence.tsx
// Heartbeats the signed-in driver's presence so the admin sees them online live.
// Sets driver_set_presence(true) while the app is open + foreground (on mount, on
// every visibility regain, and every 60s), and false when backgrounded / unmounted.
// The admin applies a freshness window (lib/admin-presence) so a driver whose app
// closed without firing the event still goes offline within a few minutes.
'use client';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const HEARTBEAT_MS = 60_000;

export function DriverPresence() {
  useEffect(() => {
    const supabase = createClient();
    // NOTE: supabase-js query builders are LAZY — the HTTP request only fires when
    // the builder is awaited or .then()'d. Calling .rpc(...) without it (as before)
    // silently sent nothing, so the driver was never marked online. The .then() here
    // is what actually dispatches the heartbeat.
    const setPresence = (online: boolean) => {
      supabase.rpc('driver_set_presence', { p_online: online }).then(
        () => {},
        () => {},
      );
    };

    const goOnline = () => setPresence(true);
    const goOffline = () => setPresence(false);

    goOnline();
    const beat = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') setPresence(true);
    }, HEARTBEAT_MS);

    const onVisibility = () => setPresence(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', goOnline);
    window.addEventListener('pagehide', goOffline);

    return () => {
      clearInterval(beat);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', goOnline);
      window.removeEventListener('pagehide', goOffline);
      goOffline();
    };
  }, []);

  return null;
}
