'use client';
// PANIER — cart. Ported from the prototype (screens-order.jsx Cart), adapted to
// the cart store + fetched product/zone data. The delivery-fee + promo preview
// here is purely cosmetic; the server re-derives the authoritative total.
import { useRouter } from 'next/navigation';
import type { Product, Zone } from '@/lib/types';
import { formatDH } from '@/lib/format';
import { FREE_DELIVERY_THRESHOLD, DEFAULT_ZONE_FEE } from '@/lib/pricing';
import { useCart } from '@/lib/cart-store';
import { useOrderMode } from '@/lib/order-store';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import { Stepper } from '@/components/ui/Stepper';
import { Btn } from '@/components/ui/Btn';

export interface CartScreenProps {
  products: Product[];
  zone: Zone | null;
}

function CartHeader({ mode }: { mode: string }) {
  return (
    <div style={{ padding: `${SAFE_TOP + 6}px 18px 14px`, background: '#fff' }}>
      <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 24, color: 'var(--ink)', margin: 0 }}>
        Mon panier
      </h1>
      <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)', margin: '2px 0 0' }}>
        {mode === 'retrait' ? 'Retrait en boutique' : 'Livraison à Fès, Av. Hassan II'}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  gold,
  green,
}: {
  label: string;
  value: string;
  gold?: boolean;
  green?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
      <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>{label}</span>
      <span
        style={{
          fontFamily: 'var(--ui-font)',
          fontSize: 13.5,
          fontWeight: 600,
          color: gold ? 'var(--gold)' : green ? 'var(--brand)' : 'var(--ink)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function CartScreen({ products, zone }: CartScreenProps) {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const removeAt = useCart((s) => s.removeAt);
  const mode = useOrderMode((s) => s.mode);

  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = items.map((it, idx) => ({ ...it, idx, product: byId.get(it.productId) ?? null }));

  const sub = items.reduce((n, it) => n + it.opts.unit * it.qty, 0);
  const zoneFee = zone ? zone.fee_dh : DEFAULT_ZONE_FEE;
  const delivery = mode === 'retrait' ? 0 : sub >= FREE_DELIVERY_THRESHOLD ? 0 : zoneFee;
  // Promo codes are entered + validated at checkout (real validate_promo), not here.
  const total = sub + delivery;

  if (items.length === 0) {
    return (
      <div>
        <CartHeader mode={mode} />
        <div
          style={{
            textAlign: 'center',
            padding: '70px 36px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 999,
              background: 'var(--soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="bag" size={38} color="var(--muted)" />
          </div>
          <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 18, color: 'var(--ink)' }}>
            Votre panier est vide
          </div>
          <p style={{ fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--muted)', margin: 0 }}>
            Parcourez nos pâtisseries et nos plats faits maison.
          </p>
          <Btn onClick={() => router.push('/')}>Découvrir la carte</Btn>
        </div>
      </div>
    );
  }

  return (
    <div>
      <CartHeader mode={mode} />
      <div style={{ padding: '6px 18px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {lines.map((it) => (
          <div
            key={it.idx}
            style={{
              display: 'flex',
              gap: 12,
              background: '#fff',
              border: '1px solid var(--line)',
              borderRadius: 18,
              padding: 10,
            }}
          >
            <PhotoSlot
              label={it.product?.photo_label ?? it.product?.name ?? 'article'}
              src={it.product?.image_url}
              style={{ width: 78, height: 78, borderRadius: 13, flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div
                  style={{
                    fontFamily: 'var(--ui-font)',
                    fontWeight: 600,
                    fontSize: 14,
                    color: 'var(--ink)',
                    lineHeight: 1.25,
                  }}
                >
                  {it.product?.name ?? 'Article'}
                </div>
                <button
                  onClick={() => removeAt(it.idx)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0, padding: 0 }}
                >
                  <Icon name="x" size={17} color="var(--muted)" />
                </button>
              </div>
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                {[it.opts.sizeLabel, it.opts.flavor].filter(Boolean).join(' · ') || 'Portion standard'}
                {it.opts.message ? ` · « ${it.opts.message} »` : ''}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: 'var(--brand)' }}>
                  {formatDH(it.opts.unit * it.qty)}
                </span>
                <Stepper size="sm" value={it.qty} onChange={(v) => setQty(it.idx, v)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* promo hint — the real code field is on the checkout step */}
      <div style={{ padding: '16px 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#fff', border: '1.5px solid var(--line)', borderRadius: 13, padding: '12px 13px' }}>
          <Icon name="tag" size={18} color="var(--muted)" />
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)' }}>
            Vous avez un code promo ? Saisissez-le à l&apos;étape paiement.
          </span>
        </div>
      </div>

      {/* summary */}
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{ background: 'var(--soft)', borderRadius: 18, padding: '16px 16px' }}>
          <Row label="Sous-total" value={formatDH(sub)} />
          <Row
            label={
              mode === 'retrait'
                ? 'Retrait en boutique'
                : delivery === 0
                  ? `Livraison ${zone ? zone.name : ''} (offerte)`
                  : `Livraison · ${zone ? zone.name : ''}`
            }
            value={delivery === 0 ? 'Offerte' : formatDH(delivery)}
            green={delivery === 0}
          />
          {mode !== 'retrait' && delivery > 0 && (
            <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--gold)', padding: '2px 0 4px' }}>
              Plus que {formatDH(FREE_DELIVERY_THRESHOLD - sub)} pour la livraison offerte
            </div>
          )}
          <div style={{ height: 1, background: 'var(--line)', margin: '10px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>Total</span>
            <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 20, color: 'var(--brand)' }}>
              {formatDH(total)}
            </span>
          </div>
        </div>
      </div>

      <div style={{ flexShrink: 0, background: '#fff', padding: `16px 18px ${SAFE_BOTTOM + 8}px`, marginTop: 14 }}>
        <Btn full size="lg" onClick={() => router.push('/checkout')}>
          <span style={{ display: 'inline-flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Commander</span>
            <span style={{ fontWeight: 700 }}>{formatDH(total)}</span>
          </span>
        </Btn>
      </div>
    </div>
  );
}
