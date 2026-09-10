// components/driver/DriverPresence.tsx
// Heartbeats the signed-in driver's presence so the admin sees them online live.
// The driver is reported ONLINE only when BOTH: they've kept themselves available
// (the dashboard switch, via useDriverOnline) AND the app is open + foreground.
// Toggling the switch off marks them offline immediately, even with the app open.
// The admin also applies a freshness window (lib/admin-presence) so a driver whose
// app closes without firing the event still goes offline within a few minutes.
'use client';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useDriverOnline } from '@/lib/driver-online-store';

const HEARTBEAT_MS = 60_000;

export function DriverPresence() {
  const online = useDriverOnline((s) => s.online);
  const hydrate = useDriverOnline((s) => s.hydrate);

  // Load the persisted availability once on the client.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const supabase = createClient();
    const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';
    // NOTE: supabase-js query builders are LAZY — the request only fires when the
    // builder is awaited or .then()'d. The .then() here is what dispatches the call.
    const setPresence = (v: boolean) => {
      supabase.rpc('driver_set_presence', { p_online: v }).then(
        () => {},
        () => {},
      );
    };
    const sync = () => setPresence(online && visible());
    const goOffline = () => setPresence(false);

    sync();
    const beat = setInterval(sync, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pageshow', sync);
    window.addEventListener('pagehide', goOffline);

    return () => {
      clearInterval(beat);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pageshow', sync);
      window.removeEventListener('pagehide', goOffline);
      goOffline();
    };
  }, [online]);

  return null;
}
