'use client';
// SUIVI DE COMMANDE — live tracking. Ported from the prototype
// (screens-order.jsx Tracking), driven by Supabase Realtime instead of the
// in-memory mover: we subscribe to order_tracking UPDATEs and re-render the
// map marker + timeline as the server-side mover advances `progress`.
//
// DB stage is 0..4; the 5-step timeline uses ids 1..5, so active = stage + 1.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Driver, Order, OrderItem, OrderTracking } from '@/lib/types';
import { formatDH } from '@/lib/format';
import { TRACK_STEPS } from '@/lib/constants';
import { LV_ROUTE, LV_ROUTE_TOTAL_KM, LV_ROUTE_TOTAL_MIN, lvPosAt } from '@/lib/route';
import { createClient } from '@/lib/supabase/client';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import { Badge } from '@/components/ui/Badge';
import { GoogleDeliveryMap } from '@/components/ui/GoogleDeliveryMap';

// Real map renders only when a browser Maps key is configured; otherwise the
// built-in SVG map is used (graceful fallback, no key required).
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export interface TrackingScreenProps {
  order: Order;
  items: OrderItem[];
  tracking: OrderTracking | null;
  driver: Driver | null;
}

export function TrackingScreen({ order, items, tracking, driver }: TrackingScreenProps) {
  const router = useRouter();
  const [track, setTrack] = useState<OrderTracking | null>(tracking);
  // GPS readout for the chip — fed by the real map when present, else the SVG route.
  const [gps, setGps] = useState<{ lat: number; lng: number }>(() => {
    const p = lvPosAt(tracking?.progress ?? 0);
    return { lat: p.lat, lng: p.lng };
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`track-${order.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'order_tracking', filter: `order_id=eq.${order.id}` },
        (payload) => setTrack(payload.new as OrderTracking),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [order.id]);

  const stage = track?.stage ?? 0;
  const active = stage + 1; // map DB stage (0..4) onto the 1..5 timeline
  const delivered = active >= 5;
  const prog = track?.progress ?? 0;
  const pos = lvPosAt(prog);
  // Real driver GPS (0008): present once a real livreur is streaming position.
  const driverPos =
    track?.lat != null && track?.lng != null ? { lat: track.lat, lng: track.lng } : null;
  const gpsShown = driverPos ?? (MAPS_KEY ? gps : { lat: pos.lat, lng: pos.lng });
  const remainKm = Math.max(0, 1 - prog) * LV_ROUTE_TOTAL_KM;
  const remainMin = Math.max(1, Math.round(Math.max(0, 1 - prog) * LV_ROUTE_TOTAL_MIN));
  const itemCount = items.reduce((n, it) => n + it.qty, 0);

  const toVB = (p: { x: number; y: number }) => ({ x: (p.x / 100) * 400, y: (p.y / 100) * 280 });
  const vbPts = LV_ROUTE.map(toVB);
  const polyAll = vbPts.map((p) => `${p.x},${p.y}`).join(' ');
  const travelled = [...vbPts.filter((_, i) => i / (vbPts.length - 1) <= prog), { x: (pos.x / 100) * 400, y: (pos.y / 100) * 280 }]
    .map((p) => `${p.x},${p.y}`)
    .join(' ');
  const dest = LV_ROUTE[LV_ROUTE.length - 1];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Map */}
      <div style={{ position: 'relative', height: 280, flexShrink: 0, background: '#eaf0f0', overflow: 'hidden' }}>
        {MAPS_KEY && (
          <GoogleDeliveryMap
            apiKey={MAPS_KEY}
            progress={prog}
            destinationAddress={order.address}
            delivered={delivered}
            driverPos={driverPos}
            onPos={(lat, lng) => setGps({ lat, lng })}
          />
        )}
        {!MAPS_KEY && (
        <>
        <svg width="100%" height="100%" viewBox="0 0 400 280" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0 }}>
          <rect width="400" height="280" fill="#e9eeee" />
          {[40, 110, 180, 250].map((y) => (
            <line key={`h${y}`} x1="0" y1={y} x2="400" y2={y} stroke="#dfe6e6" strokeWidth="10" />
          ))}
          {[70, 170, 270, 350].map((x) => (
            <line key={`v${x}`} x1={x} y1="0" x2={x} y2="280" stroke="#dfe6e6" strokeWidth="10" />
          ))}
          <rect x="120" y="60" width="80" height="55" fill="#e2ebe9" />
          <rect x="240" y="150" width="70" height="60" fill="#e2ebe9" />
          <polyline points={polyAll} fill="none" stroke="#c4d6d6" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 11" />
          <polyline points={travelled} fill="none" stroke="var(--brand)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={vbPts[0].x} cy={vbPts[0].y} r="9" fill="#fff" stroke="var(--gold)" strokeWidth="3" />
          <circle cx={vbPts[0].x} cy={vbPts[0].y} r="3.5" fill="var(--gold)" />
        </svg>
        <div style={{ position: 'absolute', left: `${dest.x}%`, top: `${dest.y}%`, transform: 'translate(-50%,-92%)' }}>
          <Icon name="pin" size={30} color="var(--ink)" fill />
        </div>
        </>
        )}
        <div
          style={{
            position: 'absolute',
            top: SAFE_TOP + 2,
            right: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)',
            borderRadius: 999,
            padding: '6px 11px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
          }}
        >
          <span className="lv-livedot" style={{ width: 8, height: 8, borderRadius: 999, background: delivered ? 'var(--gold)' : 'var(--brand)' }} />
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: 'var(--ink)', fontWeight: 600 }}>
            GPS {gpsShown.lat.toFixed(4)}, {gpsShown.lng.toFixed(4)}
          </span>
        </div>
        {!MAPS_KEY && (
        <div
          style={{
            position: 'absolute',
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            transform: 'translate(-50%,-50%)',
            transition: 'left 1.5s linear, top 1.5s linear',
            zIndex: 2,
          }}
        >
          <div className="lv-pulse" style={{ position: 'absolute', inset: 0, margin: 'auto', width: 26, height: 26, borderRadius: 999, background: 'var(--brand)' }} />
          <div
            style={{
              position: 'relative',
              width: 40,
              height: 40,
              borderRadius: 999,
              background: 'var(--brand)',
              border: '3px solid #fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(19,124,139,0.5)',
            }}
          >
            <Icon name="scooter" size={22} color="#fff" />
          </div>
        </div>
        )}
        <button
          onClick={() => router.push('/orders')}
          style={{
            position: 'absolute',
            top: SAFE_TOP + 2,
            left: 16,
            width: 42,
            height: 42,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.95)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <Icon name="left" size={20} color="var(--ink)" />
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          background: '#fff',
          borderRadius: '24px 24px 0 0',
          marginTop: -22,
          position: 'relative',
          padding: '20px 18px 10px',
        }}
      >
        {/* ETA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)' }}>
              {delivered ? 'Commande livrée' : 'Arrivée estimée'}
            </div>
            <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)' }}>
              {delivered ? (
                'Bon appétit !'
              ) : (
                <>
                  {remainMin} min{' '}
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--brand)' }}>· {remainKm.toFixed(1)} km</span>
                </>
              )}
            </div>
          </div>
          <Badge gold style={{ fontSize: 12, padding: '7px 13px' }}>
            {delivered ? '✓ Livrée' : '● ' + (TRACK_STEPS[active - 1]?.label ?? 'En route')}
          </Badge>
        </div>

        {/* driver card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'var(--soft)', borderRadius: 18, padding: 13, marginTop: 16 }}>
          <PhotoSlot label={driver?.name ?? 'livreur'} src={driver?.avatar_url} style={{ width: 52, height: 52, borderRadius: 999 }} dim />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>
              {driver?.name ?? "Recherche d'un livreur…"}
            </div>
            <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {driver ? (
                <>
                  {driver.vehicle} · <Icon name="star" size={12} color="var(--gold)" fill />{' '}
                  {driver.rating.toFixed(1).replace('.', ',')}
                </>
              ) : (
                'Assignation en cours'
              )}
            </div>
          </div>
          <button
            onClick={() => router.push(`/call/${order.id}`)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              background: 'var(--brand)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 14px -6px var(--brand)',
            }}
          >
            <Icon name="phone" size={20} color="#fff" fill />
          </button>
          <button
            onClick={() => router.push(`/chat/${order.id}`)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              background: '#fff',
              border: '1.5px solid var(--line)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="message" size={20} color="var(--brand)" />
          </button>
        </div>

        {/* timeline */}
        <div style={{ marginTop: 22 }}>
          {TRACK_STEPS.map((s, i) => {
            const done = s.id < active;
            const cur = s.id === active;
            const reached = s.id <= active;
            return (
              <div key={s.id} style={{ display: 'flex', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 999,
                      flexShrink: 0,
                      background: reached ? 'var(--brand)' : '#fff',
                      border: `2px solid ${reached ? 'var(--brand)' : 'var(--line)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: cur ? '0 0 0 5px rgba(19,124,139,0.15)' : 'none',
                    }}
                  >
                    {done && <Icon name="check" size={14} color="#fff" strokeWidth={2.6} />}
                    {cur && <div style={{ width: 9, height: 9, borderRadius: 999, background: '#fff' }} />}
                  </div>
                  {i < TRACK_STEPS.length - 1 && (
                    <div style={{ width: 2, flex: 1, minHeight: 26, background: s.id < active ? 'var(--brand)' : 'var(--line)' }} />
                  )}
                </div>
                <div style={{ paddingBottom: 18 }}>
                  <div style={{ fontFamily: 'var(--ui-font)', fontWeight: cur ? 700 : 500, fontSize: 14.5, color: reached ? 'var(--ink)' : 'var(--muted)' }}>
                    {s.label}
                  </div>
                  <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{s.sub}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* order recap */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--soft)',
            borderRadius: 16,
            padding: '14px 16px',
          }}
        >
          <div>
            <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>Commande {order.code}</div>
            <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>
              {itemCount} article{itemCount > 1 ? 's' : ''} · {formatDH(order.total_dh)}
            </div>
          </div>
          {delivered && (
            <button
              onClick={() => router.push(`/review/${order.id}`)}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--ui-font)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--brand)',
              }}
            >
              Laisser un avis
            </button>
          )}
        </div>

        {/* help */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            border: '1px solid var(--line)',
            borderRadius: 16,
            padding: '14px 16px',
            marginTop: 12,
            marginBottom: SAFE_BOTTOM + 10,
          }}
        >
          <Icon name="info" size={20} color="var(--brand)" />
          <span style={{ flex: 1, fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--ink)' }}>
            Besoin d&apos;aide avec cette commande ?
          </span>
          <button
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--ui-font)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--brand)',
            }}
          >
            Support
          </button>
        </div>
      </div>
    </div>
  );
}
