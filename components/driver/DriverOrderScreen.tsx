'use client';
// Driver order detail + workflow. Three responsibilities:
//   1) Show the order (items, address, customer contact once claimed).
//   2) Drive the delivery state machine via the 0008 RPCs:
//        available → driver_accept_order → stage 2 (récupérée) → 3 (en route) → 4 (livrée)
//   3) Stream the device's real GPS to order_tracking while the delivery is
//      active, so the customer's live map shows the driver's true position.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/lib/toast-store';
import { formatDH } from '@/lib/format';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { Btn } from '@/components/ui/Btn';
import type { OrderDetail, DriverContact } from '@/lib/queries';
import type { OrderTracking } from '@/lib/types';

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
  const watchRef = useRef<number | null>(null);
  const lastPushRef = useRef(0);

  const mine = tracking?.driver_id === driverId && !!tracking?.manual;
  const stage = tracking?.stage ?? 0;
  const delivered = order.status === 'delivered' || stage >= 4;
  const isDelivery = order.mode === 'livraison';

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

  const advance = async (next: 2 | 3 | 4) => {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('driver_update_status', { p_order: order.id, p_stage: next });
    setBusy(false);
    if (error) {
      toast('Action impossible');
      return;
    }
    setTracking((t) => (t ? { ...t, stage: next } : t));
    toast(STAGE_LABEL[next]);
    router.refresh();
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
    primary = { label: 'Marquer livrée', run: () => advance(4) };
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: `${SAFE_TOP + 4}px 16px 14px`, background: 'var(--brand-d)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/driver')} aria-label="Retour" style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.16)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="left" size={20} color="#fff" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 18, color: '#fff', margin: 0 }}>{order.code}</h1>
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'rgba(255,255,255,0.72)' }}>
            {isDelivery ? 'Livraison' : 'Retrait'} · {STAGE_LABEL[stage] ?? '—'}
          </div>
        </div>
        {mine && stage >= 2 && !delivered && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--ui-font)', fontSize: 11, fontWeight: 600, color: '#fff', background: 'rgba(105,224,160,0.25)', borderRadius: 999, padding: '5px 10px' }}>
            <span className="lv-livedot" style={{ width: 6, height: 6, borderRadius: 999, background: '#69e0a0' }} /> GPS
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px' }}>
        {/* Step progress */}
        <StepBar isDelivery={isDelivery} step={stepIndex(stage)} />

        {/* Destination / mode */}
        <Card>
          <Row icon={isDelivery ? 'pin' : 'store'} label={isDelivery ? 'Adresse de livraison' : 'Retrait en boutique'} value={isDelivery ? order.address ?? '—' : 'La Villa — Av. Hassan II'} />
        </Card>

        {/* Customer contact (only once claimed) */}
        {mine && initialContact && (
          <Card>
            <Row icon="user" label="Client" value={initialContact.full_name || '—'} />
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button
                onClick={() => router.push(`/driver/chat/${order.id}`)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', background: 'var(--soft)', borderRadius: 12, padding: '11px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--brand)' }}
              >
                <Icon name="message" size={18} color="var(--brand)" /> Message
              </button>
              {initialContact.phone && (
                <a href={`tel:${initialContact.phone}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', background: 'var(--soft)', borderRadius: 12, padding: '11px', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--brand)' }}>
                  <Icon name="phone" size={18} color="var(--brand)" /> Appeler
                </a>
              )}
            </div>
          </Card>
        )}

        {/* Items */}
        <Card>
          <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 10 }}>Articles</div>
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
          <div style={{ borderTop: '1px solid var(--line)', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
            <span>Total</span>
            <span>{formatDH(order.total_dh)}</span>
          </div>
        </Card>
      </div>

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
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: 14, marginBottom: 12 }}>
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
