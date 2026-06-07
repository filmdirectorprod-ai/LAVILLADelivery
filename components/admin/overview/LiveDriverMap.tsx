// components/admin/overview/LiveDriverMap.tsx
// Live map of online drivers for the admin overview. Unlike GoogleDeliveryMap
// (one driver, one animated route), this plots a marker per driver position and
// refits the viewport when positions change. With no Maps key it degrades to a
// readable list so the dashboard never breaks.
'use client';
import { useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import type { DriverPosition } from '@/lib/admin-overview';

// La Villa — Av. Hassan II, Ville Nouvelle, Fès (delivery origin).
const ORIGIN = { lat: 34.0331, lng: -4.9998 };

export interface LiveDriverMapProps {
  apiKey: string | undefined;
  positions: DriverPosition[];
}

export function LiveDriverMap({ apiKey, positions }: LiveDriverMapProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());

  // One-time map init.
  useEffect(() => {
    if (!apiKey || !divRef.current) return;
    let cancelled = false;
    const loader = new Loader({ apiKey, version: 'weekly' });
    loader
      .load()
      .then(() => {
        if (cancelled || !divRef.current) return;
        const map = new google.maps.Map(divRef.current, {
          center: ORIGIN,
          zoom: 13,
          disableDefaultUI: true,
          clickableIcons: false,
          styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
        });
        mapRef.current = map;
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
      })
      .catch(() => {
        /* load failed — fallback panel covers it */
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  // Sync markers whenever positions change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const live = markersRef.current;
    const seen = new Set<string>();

    for (const p of positions) {
      seen.add(p.id);
      const existing = live.get(p.id);
      if (existing) {
        existing.setPosition({ lat: p.lat, lng: p.lng });
      } else {
        live.set(
          p.id,
          new google.maps.Marker({
            position: { lat: p.lat, lng: p.lng },
            map,
            title: p.name,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: '#137C8B',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 4,
            },
          }),
        );
      }
    }
    // Drop markers for drivers no longer online.
    for (const [id, marker] of Array.from(live.entries())) {
      if (!seen.has(id)) {
        marker.setMap(null);
        live.delete(id);
      }
    }
    // Frame origin + all drivers.
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(ORIGIN);
    for (const p of positions) bounds.extend({ lat: p.lat, lng: p.lng });
    if (positions.length > 0) map.fitBounds(bounds, 60);
  }, [positions]);

  const shellStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid var(--line)',
    borderRadius: 18,
    boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)',
    overflow: 'hidden',
    height: 320,
    position: 'relative',
  };

  if (!apiKey) {
    return (
      <div style={shellStyle}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
          <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 16, color: 'var(--ink)', margin: 0 }}>
            Suivi des livreurs · en direct
          </h2>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto' }}>
          {positions.length === 0 ? (
            <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>
              Aucun livreur en ligne pour l&apos;instant.
            </span>
          ) : (
            positions.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--brand)' }} />
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{p.name}</span>
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)' }}>
                  {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1, padding: '14px 22px', background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0))' }}>
        <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 16, color: 'var(--ink)', margin: 0 }}>
          Suivi des livreurs · en direct
        </h2>
      </div>
      <div ref={divRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}
