'use client';
// La course, dans la langue de l'admin : panneaux de verre sur le fond turquoise
// foncé. Quatre responsabilités :
//   1) Montrer la course (articles, adresse, contact client une fois prise).
//   2) Piloter la livraison via les RPC 0008 :
//        disponible → driver_accept_order → 2 (récupérée) → 3 (en route) → 4 (livrée)
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
import { MAPS_KEY_ABSENTE, hasMapsKey } from '@/lib/maps-status';
import { slotShortLabel } from '@/lib/checkout-slots';
import { useRealtime } from '@/lib/use-realtime';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import type { OrderDetail, DriverContact } from '@/lib/queries';
import type { OrderTracking } from '@/lib/types';
import dynamic from 'next/dynamic';
import {
  EmptyLine,
  FormError,
  GhostAction,
  Notice,
  Panel,
  Pill,
  PrimaryAction,
  SectionTitle,
  Well,
  fieldStyle,
  text,
} from '@/components/driver/ui/DriverUI';

// Le SDK Maps (~200 ko) n'est utile qu'une fois la course à l'écran — chargé à
// la demande. ssr:false : il touche window.
const GoogleDeliveryMap = dynamic(
  () => import('@/components/ui/GoogleDeliveryMap').then((m) => m.GoogleDeliveryMap),
  { ssr: false },
);

const MAPS_KEY = hasMapsKey(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
  ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  : undefined;

const STAGE_LABEL: Record<number, string> = {
  0: 'Confirmée',
  1: 'En préparation',
  2: 'Récupérée',
  3: 'En route',
  4: 'Livrée',
};

// Côté livreur la course tient en 4 étapes. Les états 0/1 (commande encore en
// préparation) mènent tous deux à l'étape 1 « en route vers le restaurant ».
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

  const prog = tracking?.progress ?? 0;
  const driverPos =
    tracking?.lat != null && tracking?.lng != null ? { lat: tracking.lat, lng: tracking.lng } : null;
  const showMap = isDelivery;

  // Garde la position optimiste en phase avec le serveur (router.refresh).
  useEffect(() => {
    setTracking(detail.tracking);
  }, [detail.tracking]);

  // Cette course appartient aussi aux deux autres applications : le gérant peut
  // l'annuler depuis l'admin, un autre livreur peut la prendre avant nous. Sans
  // abonnement, l'écran ne bougeait que sur les actions du livreur lui-même et
  // le laissait rouler vers une commande déjà annulée.
  //
  // order_tracking n'est écouté que TANT QUE LA COURSE N'EST PAS À NOUS : une
  // fois prise, c'est nous qui écrivons dans cette ligne une position GPS toutes
  // les 4 s, et s'y abonner ferait recharger l'écran en boucle. Nos propres
  // étapes passent déjà par l'état optimiste et router.refresh().
  const refresh = useCallback(() => router.refresh(), [router]);
  useRealtime(
    'driver-order',
    [
      { table: 'orders', filter: `id=eq.${order.id}` },
      !mine && { table: 'order_tracking', filter: `order_id=eq.${order.id}` },
    ],
    refresh,
  );

  // ── Diffusion GPS (seulement pendant une livraison active) ──────────────────
  const pushPosition = useCallback(
    async (lat: number, lng: number) => {
      const now = Date.now();
      if (now - lastPushRef.current < 4000) return; // ~1 envoi / 4 s
      lastPushRef.current = now;
      await createClient().rpc('driver_update_position', {
        p_order: order.id,
        p_lat: lat,
        p_lng: lng,
        p_progress: null,
      });
    },
    [order.id],
  );

  useEffect(() => {
    const active = mine && !delivered && stage >= 2; // diffusion dès la récupération
    if (!active || typeof navigator === 'undefined' || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => pushPosition(pos.coords.latitude, pos.coords.longitude),
      () => {
        /* permission refusée / indisponible — les actions restent utilisables */
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
    const { error } = await createClient().rpc('driver_accept_order', { p_order: order.id });
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
    const { error } = await createClient().rpc('driver_update_status', {
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
    const { error } = await createClient().rpc('driver_report_incident', {
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

  // L'action principale dépend de l'étape.
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
      {/* En-tête */}
      <div style={{ padding: `${SAFE_TOP + 10}px 16px 14px`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.push('/driver')}
          aria-label="Retour"
          style={{ width: 42, height: 42, borderRadius: 999, border: '1px solid var(--a-glass-line)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <Icon name="left" size={20} color="var(--a-text)" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ ...text, margin: 0, fontWeight: 600, fontSize: 22, color: 'var(--a-text)' }}>{order.code}</h1>
          <div style={{ ...text, fontSize: 12.5, color: 'var(--a-muted)' }}>
            {isDelivery ? 'Livraison' : 'Retrait'} · {STAGE_LABEL[stage] ?? '—'}
            {slot ? ` · ${slot}` : ''}
          </div>
        </div>
        {mine && stage >= 2 && !delivered && <Pill tone="solid">GPS actif</Pill>}
      </div>

      {/* Carte en direct (livraisons) */}
      {showMap && (
        <div style={{ position: 'relative', height: 210, flexShrink: 0, margin: '0 16px', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--a-glass-line)' }}>
          {MAPS_KEY ? (
            <GoogleDeliveryMap
              apiKey={MAPS_KEY}
              progress={prog}
              destinationAddress={order.address}
              delivered={delivered}
              driverPos={driverPos}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, padding: '14px 18px', background: 'var(--a-card)' }}>
              <Icon name="pin" size={26} color="var(--a-accent)" />
              {/* « Carte indisponible » n'aidait personne : on nomme la cause. */}
              <span style={{ ...text, fontSize: 11.5, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.45 }}>
                {MAPS_KEY_ABSENTE}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Corps */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <StepBar isDelivery={isDelivery} step={stepIndex(stage)} />

        {/* Destination + itinéraire */}
        <Panel>
          <Row icon={isDelivery ? 'pin' : 'store'} label={isDelivery ? 'Adresse de livraison' : 'Retrait en boutique'} value={isDelivery ? order.address ?? '—' : 'La Villa — boutique'} />
          {isDelivery && (
            <a
              href={directionsUrl(destination, order.address)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...text, marginTop: 14, minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', background: '#ffffff', borderRadius: 999, padding: '14px', fontWeight: 600, fontSize: 16, color: 'var(--a-on-white)' }}
            >
              <Icon name="straight" size={18} color="var(--a-on-white)" /> Itinéraire
            </a>
          )}
        </Panel>

        {/* Encaissement */}
        {mine && !delivered && cashToCollect > 0 && (
          <Notice icon="cash">{formatDH(cashToCollect)} à encaisser en espèces à la remise.</Notice>
        )}

        {/* Contact client (une fois la course prise) */}
        {mine && initialContact && (
          <Panel>
            <Row icon="user" label="Client" value={initialContact.full_name || '—'} />
            <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
              <GhostAction onClick={() => router.push(`/driver/chat/${order.id}`)} full>
                <Icon name="message" size={18} color="var(--ink)" /> Message
              </GhostAction>
              {initialContact.phone && (
                <a
                  href={`tel:${initialContact.phone}`}
                  style={{ ...text, flex: 1, minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', border: '1px solid var(--a-glass-line)', borderRadius: 999, padding: '11px 18px', fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}
                >
                  <Icon name="phone" size={18} color="var(--ink)" /> Appeler
                </a>
              )}
            </div>
          </Panel>
        )}

        {/* Articles */}
        <Panel>
          <SectionTitle aside={items.length ? `${items.length} ligne${items.length > 1 ? 's' : ''}` : undefined}>Articles</SectionTitle>
          {items.length === 0 ? (
            <div style={{ ...text, fontSize: 13, color: 'var(--muted)' }}>
              {mine ? 'Aucun article.' : 'Acceptez la commande pour voir le détail.'}
            </div>
          ) : (
            items.map((it) => (
              <div key={it.id} style={{ ...text, display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', fontSize: 14, color: 'var(--ink)' }}>
                <span style={{ minWidth: 0 }}>
                  <b style={{ fontWeight: 600 }}>{it.qty}×</b> {it.name_snapshot}
                </span>
                <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{formatDH(it.price_snapshot * it.qty)}</span>
              </div>
            ))
          )}
          <div style={{ ...text, borderTop: '1px solid var(--line)', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>
            <span>Total</span>
            <span>{formatDH(order.total_dh)}</span>
          </div>
        </Panel>

        {/* Signaler un incident au gérant */}
        {mine && !delivered && (
          <Panel>
            {!incidentOpen ? (
              <GhostAction onClick={() => setIncidentOpen(true)} full style={{ color: 'var(--a-accent)', borderColor: 'var(--a-accent)' }}>
                <Icon name="info" size={18} color="var(--a-accent)" /> Signaler un problème
              </GhostAction>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <SectionTitle>Signaler un problème</SectionTitle>
                <div role="group" aria-label="Type d’incident" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {INCIDENT_KINDS.map((k) => {
                    const on = incidentKind === k.id;
                    return (
                      <button
                        key={k.id}
                        onClick={() => setIncidentKind(k.id)}
                        aria-pressed={on}
                        style={{
                          ...text,
                          border: on ? '1px solid #ffffff' : '1px solid var(--a-glass-line)',
                          background: on ? '#ffffff' : 'transparent',
                          color: on ? 'var(--a-on-white)' : 'var(--ink)',
                          borderRadius: 999,
                          padding: '9px 15px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: 13.5,
                        }}
                      >
                        {k.label}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  value={incidentDetail}
                  onChange={(e) => setIncidentDetail(e.target.value)}
                  placeholder="Que s'est-il passé ?"
                  aria-label="Détail de l'incident"
                  style={{ ...fieldStyle, minHeight: 80, resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <GhostAction onClick={() => setIncidentOpen(false)} style={{ flex: 1 }}>
                    Annuler
                  </GhostAction>
                  <PrimaryAction onClick={reportIncident} disabled={incidentBusy} full={false} style={{ flex: 1.4 }}>
                    {incidentBusy ? 'Envoi…' : 'Envoyer au gérant'}
                  </PrimaryAction>
                </div>
              </div>
            )}
          </Panel>
        )}

        {delivered && <EmptyLine title="Course terminée." hint="Merci — elle est enregistrée dans votre historique." />}
      </div>

      {/* Remise : code client ou photo */}
      {closing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end' }} onClick={() => setClosing(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              background: 'linear-gradient(rgba(0, 0, 0, 0.62), rgba(0, 0, 0, 0.62)), var(--a-ground)',
              borderRadius: '24px 24px 0 0',
              border: '1px solid var(--a-glass-line)',
              padding: `22px 18px ${SAFE_BOTTOM + 18}px`,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <h2 style={{ ...text, margin: 0, fontWeight: 600, fontSize: 19, color: 'var(--a-text)' }}>Code du client</h2>
            <p style={{ ...text, fontSize: 13.5, color: 'var(--a-muted)', margin: 0, lineHeight: 1.45 }}>
              Demandez les 4 chiffres affichés sur son suivi. S&apos;il est absent, prenez une photo du dépôt.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              autoFocus
              placeholder="0000"
              aria-label="Code de remise"
              style={{ ...fieldStyle, fontFamily: 'ui-monospace, monospace', fontSize: 28, letterSpacing: 12, textAlign: 'center', padding: '16px' }}
            />
            {closeError && <FormError>{closeError}</FormError>}
            <PrimaryAction onClick={() => advance(4, { code })} disabled={busy || code.length < 4}>
              {busy ? '…' : 'Valider la remise'}
            </PrimaryAction>
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
            <GhostAction onClick={() => photoRef.current?.click()} disabled={uploading} full>
              {uploading ? 'Envoi de la photo…' : 'Client absent — photo du dépôt'}
            </GhostAction>
          </div>
        </div>
      )}

      {/* Barre d'action */}
      <div style={{ padding: `12px 16px ${SAFE_BOTTOM + 12}px`, flexShrink: 0, borderTop: '1px solid var(--a-glass-line)', background: 'rgba(0,0,0,0.35)' }}>
        {delivered ? (
          <div style={{ ...text, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600, fontSize: 15, color: 'var(--a-text)' }}>
            <Icon name="check" size={20} color="var(--a-text)" /> Commande livrée
          </div>
        ) : primary ? (
          <PrimaryAction onClick={primary.run} disabled={busy}>
            {primary.label}
          </PrimaryAction>
        ) : null}
      </div>
    </div>
  );
}

// Progression en 4 segments + la phrase de l'étape, comme le suivi du client.
function StepBar({ isDelivery, step }: { isDelivery: boolean; step: number }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[1, 2, 3, 4].map((s) => (
          <span
            key={s}
            style={{
              flex: 1,
              height: 5,
              borderRadius: 999,
              background: s <= step ? '#ffffff' : 'rgba(255,255,255,0.16)',
            }}
          />
        ))}
      </div>
      <div style={{ ...text, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--a-muted)' }}>
        {isDelivery ? 'Livraison' : 'Retrait'} · Étape {step}/4
      </div>
      <h2 style={{ ...text, fontWeight: 600, fontSize: 21, color: 'var(--a-text)', margin: '4px 0 0' }}>{STEP_PHRASE[step]}</h2>
    </div>
  );
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={20} color="var(--ink)" />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...text, fontSize: 12, color: 'var(--muted)' }}>{label}</div>
        <div style={{ ...text, fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{value}</div>
      </div>
    </div>
  );
}

/** Conservé pour la lisibilité des blocs d'information secondaires. */
export function InfoWell({ children }: { children: React.ReactNode }) {
  return <Well>{children}</Well>;
}
