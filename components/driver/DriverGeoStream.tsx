// components/driver/DriverGeoStream.tsx
// Streams the driver's GPS the whole time they are ONLINE (the dashboard switch),
// so the admin live map shows every connected driver — not only those delivering.
// Each fix: driver_update_location (the driver's own live position) + when a
// delivery is active, driver_update_position (the customer's live tracking). The
// driver's order is resolved in the background and kept fresh via Realtime. Throttled.
'use client';
import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useDriverOnline } from '@/lib/driver-online-store';

export function DriverGeoStream() {
  const online = useDriverOnline((s) => s.online);
  const orderIdRef = useRef<string | null>(null);
  const lastPush = useRef(0);

  // Resolve the driver's active delivery, kept fresh on realtime changes.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function findActive() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: drv } = await supabase.from('drivers').select('id').eq('user_id', user.id).maybeSingle();
      if (!drv) return;
      const { data } = await supabase
        .from('order_tracking')
        .select('order_id, orders!inner(status)')
        .eq('driver_id', drv.id)
        .in('orders.status', ['ready', 'en_route'])
        .limit(1);
      if (!cancelled) orderIdRef.current = (data?.[0]?.order_id as string | undefined) ?? null;
    }

    findActive();
    const channel = supabase
      .channel('driver-geo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, findActive)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_tracking' }, findActive)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // Stream GPS while online.
  useEffect(() => {
    if (!online || typeof navigator === 'undefined' || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lastPush.current < 5000) return; // ~1 / 5s
        lastPush.current = now;
        const supabase = createClient();
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        // The driver's own live position (shown on the admin map for every online driver).
        await supabase.rpc('driver_update_location', { p_lat: lat, p_lng: lng });
        // The active delivery's tracking (the customer's live map), when delivering.
        if (orderIdRef.current) {
          await supabase.rpc('driver_update_position', {
            p_order: orderIdRef.current,
            p_lat: lat,
            p_lng: lng,
            p_progress: null,
          });
        }
      },
      () => {
        /* permission denied / unavailable — silent */
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [online]);

  return null;
}
