// components/driver/DriverPresence.tsx
// Heartbeats the signed-in driver's presence so the admin sees them online live.
// Calls driver_set_presence(true) on mount and every 60s, and best-effort false
// on unmount / page hide. The admin applies a freshness window (lib/admin-presence)
// so a driver whose app closed without firing the event still goes offline within
// a few minutes. Renders nothing.
'use client';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const HEARTBEAT_MS = 60_000;

export function DriverPresence() {
  useEffect(() => {
    const supabase = createClient();
    const setPresence = (online: boolean) =>
      supabase.rpc('driver_set_presence', { p_online: online });

    setPresence(true);
    const beat = setInterval(() => setPresence(true), HEARTBEAT_MS);
    const goOffline = () => setPresence(false);
    window.addEventListener('pagehide', goOffline);

    return () => {
      clearInterval(beat);
      window.removeEventListener('pagehide', goOffline);
      setPresence(false);
    };
  }, []);

  return null;
}
