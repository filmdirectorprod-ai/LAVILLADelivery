'use client';
// Driver order detail + workflow. Quatre responsabilités :
//   1) Montrer la course (articles, adresse, contact client une fois prise).
//   2) Piloter la livraison via les RPC 0008 :
//        available → driver_accept_order → 2 (récupérée) → 3 (en route) → 4 (livrée)
//   3) Diffuser la position réelle du téléphone dans order_tracking, pour la
//      carte du client.
//   4) 0054 : ouvrir l'itinéraire, clore la course avec le code du client (ou
//      une photo du dépôt), signaler un incident au gérant, et rappeler ce
//      qu'il faut encaisser en espèces.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/lib/toast-store';
import { formatDH } from '@/lib/format';
import { customerMessage } from '@/lib/order-error-messages';
import { directionsUrl } from '@/lib/eta';
import { slotShortLabel } from '@/lib/checkout-slots';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { Btn } from '@/components/ui/Btn';

import type { OrderDetail, DriverContact } from '@/lib/queries';
import type { OrderTracking } from '@/lib/types';
import dynamic from 'next/dynamic';

// The Maps SDK (~200 kB) is only needed once a delivery is on screen — load it
// on demand rather than in every driver bundle. ssr:false: it touches window.
const GoogleDeliveryMap = dynamic(
  () => import('@/components/ui/GoogleDeliveryMap').then((m) => m.GoogleDeliveryMap),
  { ssr: false },
);

// Real Fès map renders when a browser Maps key is configured; otherwise a
// neutral placeholder keeps the layout intact (no key required to build).
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const STAGE_LABEL: Record<number, string> = {
  0: 'Confirmée',
  1: 'En préparation',
  2: 'Récupérée',
  3: 'En route',
  4: 'Livrée',
};

// The driver-facing course is a 4-step journey. Stages 0/1 (order still being
// prepared) both map to step 1 "en route vers le restaurant".
const STEP_PHRASE: Record<number, string> = {
  1: 'En route vers le restaurant',
  2: 'Commande récupérée',
  3: 'En route vers le client',
  4: 'Commande livrée',
};
function stepIndex(stage: number): number {
  return stage <= 1 ? 1 : Math.min(stage, 4);
}

const INCIDENT_KINDS: { id: string; label: string }[] = [
  { id: 'retard', label: 'Retard' },
  { id: 'litige', label: 'Litige' },
  { id: 'accident', label: 'Accident' },
  { id: 'autre', label: 'Autre' },
];

export function DriverOrderScreen({
  driverId,
  detail,
  initialContact,
}: {
  driverId: string;
  detail: OrderDetail;
  initialContact: DriverContact | null;
}) {
  const router = useRouter();
  const toast = useToast((s) => s.show);
  const { order, items } = detail;

  const [tracking, setTracking] = useState<OrderTracking | null>(detail.tracking);
  const [busy, setBusy] = useState(false);
  // Remise : le code donné par le client, ou une photo du dépôt (0054).
  const [closing, setClosing] = useState(false);
  const [code, setCode] = useState('');
  const [closeError, setCloseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // Signalement d'incident au gérant (0054).
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentKind, setIncidentKind] = useState('retard');
  const [incidentDetail, setIncidentDetail] = useState('');
  const [incidentBusy, setIncidentBusy] = useState(false);
  const photoRef = useRef<HTMLInputElement | null>(null);
  const watchRef = useRef<number | null>(null);
  const lastPushRef = useRef(0);

  const mine = tracking?.driver_id === driverId && !!tracking?.manual;
  const stage = tracking?.stage ?? 0;
  const delivered = order.status === 'delivered' || stage >= 4;
  const isDelivery = order.mode === 'livraison';
  const cashToCollect = (order.payment_method ?? 'cod') === 'cod' ? order.total_dh : 0;
  const slot = slotShortLabel(order.slot_at);
  const destination =
    order.dest_lat != null && order.dest_lng != null ? { lat: order.dest_lat, lng: order.dest_lng } : null;

  // Map inputs: follow the driver's own streamed GPS when present, else animate
  // along the route by progress. Only meaningful for delivery (livraison) orders.
  const prog = tracking?.progress ?? 0;
  const driverPos =
    tracking?.lat != null && tracking?.lng != null ? { lat: tracking.lat, lng: tracking.lng } : null;
  const showMap = isDelivery;

  // Keep optimistic tracking in sync if the server props change (router.refresh).
  useEffect(() => {
    setTracking(detail.tracking);
  }, [detail.tracking]);

  // ── Live GPS streaming (only while this driver is actively delivering) ──────
  const pushPosition = useCallback(
    async (lat: number, lng: number) => {
      const now = Date.now();
      if (now - lastPushRef.current < 4000) return; // throttle to ~1 / 4s
      lastPushRef.current = now;
      const supabase = createClient();
      await supabase.rpc('driver_update_position', {
        p_order: order.id,
        p_lat: lat,
        p_lng: lng,
        p_progress: null,
      });
    },
    [order.id],
  );

  useEffect(() => {
    const active = mine && !delivered && stage >= 2; // streaming once picked up
    if (!active || typeof navigator === 'undefined' || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => pushPosition(pos.coords.latitude, pos.coords.longitude),
      () => {
        /* permission denied / unavailable — silent, stage actions still work */
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );
    watchRef.current = id;
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    };
  }, [mine, delivered, stage, pushPosition]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const accept = async () => {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('driver_accept_order', { p_order: order.id });
    setBusy(false);
    if (error) {
      toast('Commande déjà prise');
      router.refresh();
      return;
    }
    setTracking((t) => (t ? { ...t, driver_id: driverId, manual: true } : t));
    toast('Commande acceptée');
    router.refresh();
  };

  const advance = async (next: 2 | 3 | 4, opts?: { code?: string; proof?: string }) => {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('driver_update_status', {
      p_order: order.id,
      p_stage: next,
      p_code: opts?.code ?? null,
      p_proof: opts?.proof ?? null,
    });
    setBusy(false);
    if (error) {
      const msg = customerMessage(error.message);
      if (next === 4) setCloseError(msg);
      else toast(msg);
      return false;
    }
    setTracking((t) => (t ? { ...t, stage: next } : t));
    setClosing(false);
    setCloseError(null);
    toast(STAGE_LABEL[next]);
    router.refresh();
    return true;
  };

  /** Photo du dépôt : envoyée dans le bucket delivery-proofs, puis jointe à la commande. */
  const uploadProof = async (file: File) => {
    setCloseError(null);
    setUploading(true);
    const supabase = createClient();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${order.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('delivery-proofs').upload(path, file, { contentType: file.type });
    if (error) {
      setUploading(false);
      setCloseError("La photo n'a pas pu être envoyée. Réessayez ou demandez le code au client.");
      return;
    }
    const { data } = supabase.storage.from('delivery-proofs').getPublicUrl(path);
    setUploading(false);
    await advance(4, { proof: data.publicUrl });
  };

  const reportIncident = async () => {
    setIncidentBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('driver_report_incident', {
      p_order: order.id,
      p_kind: incidentKind,
      p_severity: incidentKind === 'accident' ? 'haute' : 'moyenne',
      p_detail: incidentDetail.trim(),
    });
    setIncidentBusy(false);
    if (error) {
      toast("L'incident n'a pas pu être envoyé.");
      return;
    }
    setIncidentOpen(false);
    setIncidentDetail('');
    toast('Incident transmis au gérant');
  };

  // Which primary action to show, given the current stage.
  let primary: { label: string; run: () => void } | null = null;
  if (!mine) {
    primary = { label: 'Accepter la commande', run: accept };
  } else if (stage < 2) {
    primary = { label: 'Marquer récupérée', run: () => advance(2) };
  } else if (stage === 2) {
    primary = isDelivery
      ? { label: 'Démarrer la livraison', run: () => advance(3) }
      : { label: 'Remettre au client', run: () => advance(4) };
  } else if (stage === 3) {
    primary = {
      label: 'Marquer livrée',
      run: () => {
        // Une livraison se clôt avec le code du client (ou une photo).
        if (isDelivery && order.delivery_code) {
          setCloseError(null);
          setCode('');
          setClosing(true);
        } else {
          advance(4);
        }
      },
    };
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: `${SAFE_TOP + 4}px 16px 14px`, background: 'linear-gradient(150deg, var(--brand), var(--brand-d))', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/driver')} aria-label="Retour" style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.16)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="left" size={20} color="#fff" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 18, color: '#fff', margin: 0 }}>{order.code}</h1>
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'rgba(255,255,255,0.72)' }}>
            {isDelivery ? 'Livraison' : 'Retrait'} · {STAGE_LABEL[stage] ?? '—'}
            {slot ? ` · ${slot}` : ''}
          </div>
        </div>
        {mine && stage >= 2 && !delivered && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--ui-font)', fontSize: 11, fontWeight: 600, color: '#fff', background: 'rgba(105,224,160,0.25)', borderRadius: 999, padding: '5px 10px' }}>
            <span className="lv-livedot" style={{ width: 6, height: 6, borderRadius: 999, background: '#69e0a0' }} /> GPS
          </span>
        )}
      </div>

      {/* Live map (delivery orders) */}
      {showMap && (
        <div style={{ position: 'relative', height: 230, flexShrink: 0, background: '#eaf0f0', overflow: 'hidden' }}>
          {MAPS_KEY ? (
            <GoogleDeliveryMap
              apiKey={MAPS_KEY}
              progress={prog}
              destinationAddress={order.address}
              delivered={delivered}
              driverPos={driverPos}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'var(--muted)' }}>
              <Icon name="pin" size={26} color="var(--muted)" />
              <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5 }}>Carte indisponible</span>
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: '16px',
          ...(showMap
            ? { marginTop: -18, borderTopLeftRadius: 20, borderTopRightRadius: 20, background: 'var(--bg, #f6f8f8)', position: 'relative', zIndex: 1, boxShadow: '0 -8px 22px -16px rgba(0,0,0,0.35)' }
            : {}),
        }}
      >
        {/* Step progress */}
        <StepBar isDelivery={isDelivery} step={stepIndex(stage)} />

        {/* Destination / mode + itinéraire */}
        <Card>
          <Row icon={isDelivery ? 'pin' : 'store'} label={isDelivery ? 'Adresse de livraison' : 'Retrait en boutique'} value={isDelivery ? order.address ?? '—' : 'La Villa — Av. Hassan II'} />
          {isDelivery && (
            <a
              href={directionsUrl(destination, order.address)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', background: 'var(--brand)', borderRadius: 999, padding: '12px', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14.5, color: '#fff' }}
            >
              <Icon name="straight" size={18} color="#fff" /> Itinéraire
            </a>
          )}
        </Card>

        {/* Encaissement */}
        {mine && !delivered && cashToCollect > 0 && (
          <Card>
            <Row icon="cash" label="À encaisser à la remise" value={`${formatDH(cashToCollect)} en espèces`} />
          </Card>
        )}

        {/* Customer contact (only once claimed) */}
        {mine && initialContact && (
          <Card>
            <Row icon="user" label="Client" value={initialContact.full_name || '—'} />
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button
                onClick={() => router.push(`/driver/chat/${order.id}`)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', background: 'var(--soft)', borderRadius: 999, padding: '12px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--brand)' }}
              >
                <Icon name="message" size={18} color="var(--brand)" /> Message
              </button>
              {initialContact.phone && (
                <a href={`tel:${initialContact.phone}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', background: 'var(--soft)', borderRadius: 999, padding: '12px', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--brand)' }}>
                  <Icon name="phone" size={18} color="var(--brand)" /> Appeler
                </a>
              )}
            </div>
          </Card>
        )}

        {/* Items */}
        <Card>
          <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 15, color: 'var(--ink)', marginBottom: 10 }}>Articles</div>
          {items.length === 0 ? (
            <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)' }}>
              {mine ? 'Aucun article.' : 'Acceptez la commande pour voir le détail.'}
            </div>
          ) : (
            items.map((it) => (
              <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--ink)' }}>
                <span style={{ minWidth: 0 }}>
                  <b style={{ color: 'var(--brand)' }}>{it.qty}×</b> {it.name_snapshot}
                </span>
                <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{formatDH(it.price_snapshot * it.qty)}</span>
              </div>
            ))
          )}
          <div style={{ borderTop: '1px solid var(--line)', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>
            <span>Total</span>
            <span>{formatDH(order.total_dh)}</span>
          </div>
        </Card>

        {/* Signaler un incident au gérant */}
        {mine && !delivered && (
          <Card>
            {!incidentOpen ? (
              <button
                onClick={() => setIncidentOpen(true)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1.5px solid var(--gold)', background: '#fff', borderRadius: 999, padding: '12px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--gold)' }}
              >
                <Icon name="info" size={18} color="var(--gold)" /> Signaler un problème
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>Signaler un problème</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {INCIDENT_KINDS.map((k) => (
                    <button
                      key={k.id}
                      onClick={() => setIncidentKind(k.id)}
                      style={{
                        border: `1.5px solid ${incidentKind === k.id ? 'var(--brand)' : 'var(--line)'}`,
                        background: incidentKind === k.id ? 'rgba(19,124,139,0.07)' : '#fff',
                        color: incidentKind === k.id ? 'var(--brand)' : 'var(--ink)',
                        borderRadius: 999,
                        padding: '8px 14px',
                        cursor: 'pointer',
                        fontFamily: 'var(--ui-font)',
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={incidentDetail}
                  onChange={(e) => setIncidentDetail(e.target.value)}
                  placeholder="Que s'est-il passé ?"
                  aria-label="Détail de l'incident"
                  style={{ minHeight: 70, resize: 'vertical', border: '1.5px solid var(--line)', borderRadius: 14, padding: '11px 13px', fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--ink)', outline: 'none' }}
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <Btn variant="ghost" onClick={() => setIncidentOpen(false)} style={{ flex: 1 }}>
                    Annuler
                  </Btn>
                  <Btn onClick={reportIncident} disabled={incidentBusy} style={{ flex: 1.4 }}>
                    {incidentBusy ? 'Envoi…' : 'Envoyer au gérant'}
                  </Btn>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Remise : code client ou photo */}
      {closing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(8,28,31,0.55)', display: 'flex', alignItems: 'flex-end' }} onClick={() => setClosing(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', background: '#fff', borderRadius: '22px 22px 0 0', padding: `20px 18px ${SAFE_BOTTOM + 18}px`, display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>Code du client</div>
            <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', margin: 0 }}>
              Demandez au client les 4 chiffres affichés sur son suivi. S&apos;il est absent, prenez une photo du dépôt.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              autoFocus
              placeholder="0000"
              aria-label="Code de remise"
              style={{ fontFamily: 'ui-monospace, monospace', fontSize: 26, letterSpacing: 10, textAlign: 'center', padding: '14px', borderRadius: 16, border: '1.5px solid var(--line)', outline: 'none', color: 'var(--ink)' }}
            />
            {closeError && (
              <div role="alert" style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: '#C0392B' }}>
                {closeError}
              </div>
            )}
            <Btn full size="lg" onClick={() => advance(4, { code })} disabled={busy || code.length < 4}>
              {busy ? '…' : 'Valider la remise'}
            </Btn>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadProof(f);
              }}
            />
            <Btn variant="ghost" full onClick={() => photoRef.current?.click()} disabled={uploading}>
              {uploading ? 'Envoi de la photo…' : 'Client absent — photo du dépôt'}
            </Btn>
          </div>
        </div>
      )}

      {/* Sticky action bar */}
      <div style={{ padding: `12px 16px ${SAFE_BOTTOM + 12}px`, background: '#fff', borderTop: '1px solid var(--line)' }}>
        {delivered ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: 'var(--brand)' }}>
            <Icon name="check" size={20} color="var(--brand)" /> Commande livrée
          </div>
        ) : primary ? (
          <Btn full size="lg" onClick={primary.run} disabled={busy}>
            {primary.label}
          </Btn>
        ) : null}
      </div>
    </div>
  );
}

// Four-segment progress + the current step's headline, mirroring the customer
// tracking sheet. `step` is 1..4 (see stepIndex).
function StepBar({ isDelivery, step }: { isDelivery: boolean; step: number }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[1, 2, 3, 4].map((s) => (
          <span
            key={s}
            style={{
              flex: 1,
              height: 5,
              borderRadius: 999,
              background: s <= step ? 'var(--brand)' : 'var(--line)',
            }}
          />
        ))}
      </div>
      <div
        style={{
          fontFamily: 'var(--ui-font)',
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: 'var(--muted)',
        }}
      >
        {isDelivery ? 'Livraison' : 'Retrait'} · Étape {step}/4
      </div>
      <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 20, color: 'var(--ink)', margin: '4px 0 0' }}>
        {STEP_PHRASE[step]}
      </h2>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: 14, marginBottom: 12, boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)' }}>
      {children}
    </div>
  );
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={20} color="var(--brand)" />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)' }}>{label}</div>
        <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>{value}</div>
      </div>
    </div>
  );
}
