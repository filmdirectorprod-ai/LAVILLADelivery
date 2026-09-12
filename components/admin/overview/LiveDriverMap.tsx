// components/admin/overview/LiveDriverMap.tsx
// Suivi des livreurs en direct, sur la vraie carte.
//
// La version d'avant ne posait que des points : on voyait le livreur bouger
// sans savoir où il allait ni quand il arriverait. Elle trace désormais le
// TRAJET ROUTIER que Google calcule pour lui — mêmes rues, même distance, même
// durée que ce qu'il a sous les yeux — et l'affiche sous la carte, une ligne par
// course.
//
// ── Le coût, parce qu'il se paie à la requête ────────────────────────────────
// L'écran se rafraîchit à chaque changement de commande ; redemander un
// itinéraire à chaque fois se facturerait des milliers d'appels par soirée. Un
// trajet n'est donc recalculé que s'il a une raison de l'être :
//   · la destination a changé (nouvelle course),
//   · le livreur s'est déplacé de plus de 200 m,
//   · le dernier calcul a plus de 60 secondes (le trafic, lui, bouge).
// Entre-temps, la ligne déjà tracée reste affichée.
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import type { DriverPosition, DriverRun } from '@/lib/admin-overview';
import { LA_VILLA_BRANCHES, DEFAULT_BRANCH } from '@/lib/branches';
import { distanceKm } from '@/lib/eta';

const CENTER = { lat: DEFAULT_BRANCH.lat, lng: DEFAULT_BRANCH.lng };

/** Déplacement à partir duquel l'itinéraire mérite d'être refait. */
const MOVED_KM = 0.2;
/** Âge à partir duquel on redemande, pour suivre le trafic. */
const STALE_MS = 60_000;

const text = { fontFamily: 'var(--ui-font)' } as const;

export interface RouteInfo {
  driverId: string;
  driverName: string;
  orderCode: string;
  address: string | null;
  /** « 12 min », tel que Google le formule (trafic compris quand il le sait). */
  duration: string;
  /** « 5,0 km ». */
  distance: string;
}

export interface LiveDriverMapProps {
  apiKey: string | undefined;
  positions: DriverPosition[];
  /** Les courses en cours, chacune avec son point de départ et sa destination. */
  runs?: DriverRun[];
}

interface CachedRoute {
  line: google.maps.Polyline;
  target: google.maps.Marker;
  /** Destination servie, pour détecter un changement de course. */
  destKey: string;
  from: { lat: number; lng: number };
  at: number;
}

export function LiveDriverMap({ apiKey, positions, runs = [] }: LiveDriverMapProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  // L'état (et non une ref) : l'effet des marqueurs doit se rejouer une fois le
  // chargeur asynchrone résolu, sinon les livreurs déjà présents au montage ne
  // seraient jamais dessinés.
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const routesRef = useRef<Map<string, CachedRoute>>(new Map());
  const [infos, setInfos] = useState<RouteInfo[]>([]);
  // Miroir des infos courantes, lisible depuis l'effet sans le relancer.
  const infosRef = useRef<RouteInfo[]>([]);
  infosRef.current = infos;

  // ── Carte, une seule fois ──────────────────────────────────────────────────
  useEffect(() => {
    if (!apiKey || !divRef.current) return;
    let cancelled = false;
    const loader = new Loader({ apiKey, version: 'weekly' });
    loader
      .load()
      .then(() => {
        if (cancelled || !divRef.current) return;
        const mapInstance = new google.maps.Map(divRef.current, {
          center: CENTER,
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
        });
        // Le trafic réel : c'est lui qui explique un retard, autant le voir.
        new google.maps.TrafficLayer().setMap(mapInstance);
        // Une pastille or par agence La Villa (Riad + Badie).
        for (const b of LA_VILLA_BRANCHES) {
          new google.maps.Marker({
            position: { lat: b.lat, lng: b.lng },
            map: mapInstance,
            title: b.name,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 7,
              fillColor: '#A89723',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 3,
            },
          });
        }
        setMap(mapInstance);
      })
      .catch(() => {
        /* chargement raté — le panneau de repli prend le relais */
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  // ── Marqueurs des livreurs ─────────────────────────────────────────────────
  useEffect(() => {
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
            zIndex: 3,
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
    for (const [id, marker] of Array.from(live.entries())) {
      if (!seen.has(id)) {
        marker.setMap(null);
        live.delete(id);
      }
    }

    const bounds = new google.maps.LatLngBounds();
    for (const b of LA_VILLA_BRANCHES) bounds.extend({ lat: b.lat, lng: b.lng });
    for (const p of positions) bounds.extend({ lat: p.lat, lng: p.lng });
    for (const r of runs) bounds.extend(r.to);
    map.fitBounds(bounds, 60);
  }, [map, positions, runs]);

  // ── Itinéraires réels ──────────────────────────────────────────────────────
  const drawRoute = useCallback(
    async (mapInstance: google.maps.Map, run: DriverRun): Promise<RouteInfo | null> => {
      const service = new google.maps.DirectionsService();
      let result: google.maps.DirectionsResult;
      try {
        result = await service.route({
          origin: run.from,
          destination: run.to,
          travelMode: google.maps.TravelMode.DRIVING,
          // Donne accès à duration_in_traffic : l'estimation honnête.
          drivingOptions: { departureTime: new Date() },
        });
      } catch {
        return null; // quota, hors zone, pas de route : on garde le point seul
      }
      const route = result.routes[0];
      const leg = route?.legs[0];
      if (!route || !leg) return null;

      const previous = routesRef.current.get(run.driverId);
      previous?.line.setMap(null);
      previous?.target.setMap(null);

      const line = new google.maps.Polyline({
        path: route.overview_path,
        map: mapInstance,
        strokeColor: '#ffffff',
        strokeOpacity: 0.95,
        strokeWeight: 5,
        zIndex: 2,
      });
      const target = new google.maps.Marker({
        position: run.to,
        map: mapInstance,
        title: `${run.orderCode}${run.address ? ' — ' + run.address : ''}`,
        zIndex: 4,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: '#A89723',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3,
        },
      });

      routesRef.current.set(run.driverId, {
        line,
        target,
        destKey: `${run.to.lat},${run.to.lng}`,
        from: run.from,
        at: Date.now(),
      });

      return {
        driverId: run.driverId,
        driverName: run.driverName,
        orderCode: run.orderCode,
        address: run.address,
        duration: leg.duration_in_traffic?.text ?? leg.duration?.text ?? '—',
        distance: leg.distance?.text ?? '—',
      };
    },
    [],
  );

  useEffect(() => {
    if (!map) return;
    let cancelled = false;

    (async () => {
      const active = new Set(runs.map((r) => r.driverId));
      // Course terminée : on efface son trajet.
      for (const [id, cached] of Array.from(routesRef.current.entries())) {
        if (!active.has(id)) {
          cached.line.setMap(null);
          cached.target.setMap(null);
          routesRef.current.delete(id);
        }
      }

      const next: RouteInfo[] = [];
      for (const run of runs) {
        const cached = routesRef.current.get(run.driverId);
        const destKey = `${run.to.lat},${run.to.lng}`;
        const stale =
          !cached ||
          cached.destKey !== destKey ||
          Date.now() - cached.at > STALE_MS ||
          distanceKm(cached.from, run.from) > MOVED_KM;

        if (!stale) {
          // Rien n'a bougé : on garde la ligne tracée et l'info précédente.
          const previous = infosRef.current.find((i) => i.driverId === run.driverId);
          if (previous) next.push(previous);
          continue;
        }
        const info = await drawRoute(map, run);
        if (cancelled) return;
        if (info) next.push(info);
      }
      if (!cancelled) setInfos(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [map, runs, drawRoute]);

  // ── Rendu ──────────────────────────────────────────────────────────────────
  const shellStyle: React.CSSProperties = {
    background: 'var(--a-card)',
    border: '1px solid var(--line)',
    borderRadius: 18,
    boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)',
    overflow: 'hidden',
    position: 'relative',
  };

  if (!apiKey) {
    return (
      <div style={{ ...shellStyle, height: 320 }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
          <h2 style={{ ...text, fontWeight: 600, fontSize: 16, color: 'var(--ink)', margin: 0 }}>
            Suivi des livreurs · en direct
          </h2>
          <div style={{ ...text, fontSize: 12, color: 'var(--a-accent)', marginTop: 4 }}>
            Carte indisponible : aucune clé Google Maps configurée.
          </div>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto' }}>
          {positions.length === 0 ? (
            <span style={{ ...text, fontSize: 13.5, color: 'var(--muted)' }}>
              Aucun livreur en ligne pour l&apos;instant.
            </span>
          ) : (
            positions.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: '#ffffff' }} />
                <span style={{ ...text, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{p.name}</span>
                <span style={{ ...text, fontSize: 12, color: 'var(--muted)' }}>
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
      <div style={{ position: 'relative', height: 320 }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1,
            padding: '14px 22px',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.7), rgba(0,0,0,0))',
            pointerEvents: 'none',
          }}
        >
          <h2 style={{ ...text, fontWeight: 600, fontSize: 16, color: 'var(--ink)', margin: 0 }}>
            Suivi des livreurs · en direct
          </h2>
        </div>
        <div ref={divRef} style={{ position: 'absolute', inset: 0 }} />
      </div>

      {/* Une ligne par course : le temps et la distance que Google donne au livreur. */}
      <div style={{ borderTop: '1px solid var(--line)' }}>
        {infos.length === 0 ? (
          <div style={{ ...text, fontSize: 13, color: 'var(--muted)', padding: '14px 22px' }}>
            {positions.length === 0
              ? 'Aucun livreur en ligne pour l’instant.'
              : `${positions.length} livreur${positions.length > 1 ? 's' : ''} en ligne · aucune course en cours.`}
          </div>
        ) : (
          infos.map((i, index) => (
            <div
              key={i.driverId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 22px',
                borderTop: index === 0 ? 'none' : '1px solid var(--line)',
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: 999, background: '#137C8B', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...text, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                  {i.driverName} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>· {i.orderCode}</span>
                </div>
                {i.address && (
                  <div
                    style={{
                      ...text,
                      fontSize: 12,
                      color: 'var(--muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {i.address}
                  </div>
                )}
              </div>
              <div
                style={{
                  ...text,
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {i.duration} · {i.distance}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
