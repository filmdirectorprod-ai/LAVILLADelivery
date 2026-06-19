// components/driver/DriverGeoStream.tsx
// Streams the driver's GPS to their active delivery the whole time the driver app
// is open — not just on the order screen — so the admin live map always shows a
// delivering driver. Finds the driver's current order (assigned + ready/en_route),
// then watchPosition → driver_update_position (throttled). Renders nothing.
'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function DriverGeoStream() {
  const [orderId, setOrderId] = useState<string | null>(null);
  const lastPush = useRef(0);

  // Resolve the driver's active delivery, and keep it fresh on realtime changes.
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
      if (!cancelled) setOrderId((data?.[0]?.order_id as string | undefined) ?? null);
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

  // Stream the position while there is an active delivery.
  useEffect(() => {
    if (!orderId || typeof navigator === 'undefined' || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lastPush.current < 4000) return; // ~1 / 4s
        lastPush.current = now;
        const supabase = createClient();
        await supabase.rpc('driver_update_position', {
          p_order: orderId,
          p_lat: pos.coords.latitude,
          p_lng: pos.coords.longitude,
          p_progress: null,
        });
      },
      () => {
        /* permission denied / unavailable — silent */
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [orderId]);

  return null;
}
