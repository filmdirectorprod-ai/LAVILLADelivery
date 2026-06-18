'use client';
// Real Google Maps live-delivery map. Renders actual Fès map tiles, asks the
// Directions API for the driving route from La Villa to the customer's address
// (geocoded from order.address), and animates the driver marker along that route
// as `progress` (0..1) advances from Supabase Realtime. Used by TrackingScreen
// only when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set; otherwise the SVG map shows.
import { useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

// La Villa — 117 Av. Mohammed Bahnini, Ville Nouvelle, Fès (delivery origin).
const ORIGIN = { lat: 34.0261, lng: -5.014 };
// Fallback destination if the address can't be geocoded (matches the SVG route end).
const FALLBACK_DEST = { lat: 34.041, lng: -4.9897 };

export interface GoogleDeliveryMapProps {
  apiKey: string;
  /** Journey progress 0..1 (Supabase Realtime). Used when no real GPS is set. */
  progress: number;
  /** Free-text delivery address to geocode for the destination marker. */
  destinationAddress: string | null;
  delivered: boolean;
  /**
   * Real driver GPS from order_tracking (0008). When provided, the marker
   * follows these true coordinates instead of interpolating along the route by
   * `progress`. Null falls back to the simulated progress animation.
   */
  driverPos?: { lat: number; lng: number } | null;
  /** Reports the driver's current GPS so the parent can show a coordinate chip. */
  onPos?: (lat: number, lng: number) => void;
}

/** Point at a fraction (0..1) along a polyline path, by real spherical distance. */
function pointAtFraction(
  path: google.maps.LatLng[],
  fraction: number,
): google.maps.LatLng {
  const g = google.maps.geometry.spherical;
  if (path.length === 0) return new google.maps.LatLng(ORIGIN);
  if (path.length === 1) return path[0];
  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const d = g.computeDistanceBetween(path[i], path[i + 1]);
    segs.push(d);
    total += d;
  }
  let target = Math.max(0, Math.min(1, fraction)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i] || i === segs.length - 1) {
      const f = segs[i] === 0 ? 0 : Math.min(1, target / segs[i]);
      return g.interpolate(path[i], path[i + 1], f);
    }
    target -= segs[i];
  }
  return path[path.length - 1];
}

export function GoogleDeliveryMap({ apiKey, progress, destinationAddress, delivered, driverPos, onPos }: GoogleDeliveryMapProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const driverRef = useRef<google.maps.Marker | null>(null);
  const pathRef = useRef<google.maps.LatLng[]>([]);
  const animRef = useRef<number | null>(null);
  const shownFracRef = useRef(0);
  const lastPosRef = useRef<google.maps.LatLng | null>(null);
  const readyRef = useRef(false);

  // ── One-time map + route setup ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const loader = new Loader({ apiKey, version: 'weekly', libraries: ['geometry'] });

    loader
      .load()
      .then(async () => {
        if (cancelled || !divRef.current) return;

        const map = new google.maps.Map(divRef.current, {
          center: ORIGIN,
          zoom: 14,
          disableDefaultUI: true,
          gestureHandling: 'greedy',
          clickableIcons: false,
          styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
        });
        mapRef.current = map;

        // Resolve the destination — geocode the address, fall back to a fixed point.
        let dest: google.maps.LatLngLiteral = FALLBACK_DEST;
        if (destinationAddress && destinationAddress.trim()) {
          try {
            const geo = new google.maps.Geocoder();
            const { results } = await geo.geocode({
              address: `${destinationAddress}, Fès, Maroc`,
              region: 'ma',
            });
            if (results?.[0]) {
              const loc = results[0].geometry.location;
              dest = { lat: loc.lat(), lng: loc.lng() };
            }
          } catch {
            /* keep fallback */
          }
        }
        if (cancelled) return;

        // Restaurant + destination markers.
        new google.maps.Marker({
          position: ORIGIN,
          map,
          title: 'La Villa',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: '#A89723',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 3,
          },
        });
        new google.maps.Marker({
          position: dest,
          map,
          title: 'Livraison',
          icon: {
            path: 'M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z',
            fillColor: '#0F2E33',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 1,
            scale: 1.6,
            anchor: new google.maps.Point(12, 22),
          },
        });

        // Driving route from the Directions API.
        let path: google.maps.LatLng[] = [];
        try {
          const ds = new google.maps.DirectionsService();
          const res = await ds.route({
            origin: ORIGIN,
            destination: dest,
            travelMode: google.maps.TravelMode.DRIVING,
          });
          path = res.routes[0]?.overview_path ?? [];
        } catch {
          /* straight line fallback below */
        }
        if (path.length < 2) {
          path = [new google.maps.LatLng(ORIGIN), new google.maps.LatLng(dest)];
        }
        if (cancelled) return;
        pathRef.current = path;

        // Full route (faint) + travelled portion (brand) — travelled redrawn on progress.
        new google.maps.Polyline({
          path,
          map,
          strokeColor: '#9DBDBD',
          strokeOpacity: 0.9,
          strokeWeight: 5,
        });

        // Driver marker (scooter dot).
        driverRef.current = new google.maps.Marker({
          position: pointAtFraction(path, progress),
          map,
          zIndex: 999,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: '#137C8B',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 4,
          },
        });

        // Frame both endpoints.
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(ORIGIN);
        bounds.extend(dest);
        map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });

        readyRef.current = true;
        shownFracRef.current = progress;
        const p0 = driverPos
          ? new google.maps.LatLng(driverPos.lat, driverPos.lng)
          : pointAtFraction(path, progress);
        driverRef.current?.setPosition(p0);
        lastPosRef.current = p0;
        onPos?.(p0.lat(), p0.lng());
      })
      .catch(() => {
        /* load failed — TrackingScreen still shows overlays; map stays blank */
      });

    return () => {
      cancelled = true;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
    // Origin/destination are stable per order; progress handled in its own effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, destinationAddress]);

  // ── Animate the driver marker whenever progress advances ────────────────────
  // Skipped when a real GPS position is driving the marker (handled below).
  useEffect(() => {
    if (!readyRef.current || driverPos) return;
    const path = pathRef.current;
    const marker = driverRef.current;
    if (!marker || path.length === 0) return;

    const from = shownFracRef.current;
    const to = Math.max(0, Math.min(1, progress));
    const start = performance.now();
    const dur = 1200;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const frac = from + (to - from) * t;
      const pt = pointAtFraction(path, frac);
      marker.setPosition(pt);
      lastPosRef.current = pt;
      onPos?.(pt.lat(), pt.lng());
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        shownFracRef.current = to;
      }
    };
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, delivered, driverPos]);

  // ── Follow the real driver GPS when present (overrides progress) ─────────────
  useEffect(() => {
    if (!readyRef.current || !driverPos) return;
    const marker = driverRef.current;
    if (!marker) return;
    const g = google.maps.geometry.spherical;
    const to = new google.maps.LatLng(driverPos.lat, driverPos.lng);
    const from = lastPosRef.current ?? to;
    const start = performance.now();
    const dur = 1000;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const pt = g.interpolate(from, to, t);
      marker.setPosition(pt);
      lastPosRef.current = pt;
      onPos?.(pt.lat(), pt.lng());
      if (t < 1) animRef.current = requestAnimationFrame(tick);
    };
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverPos?.lat, driverPos?.lng]);

  return <div ref={divRef} style={{ position: 'absolute', inset: 0 }} />;
}
