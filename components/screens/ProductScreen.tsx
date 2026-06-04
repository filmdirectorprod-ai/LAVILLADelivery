'use client';
// FICHE PRODUIT — product detail. Ported from the prototype (screens-shop.jsx
// Product), adapted to the real Product schema + cart store. Customizable
// patisserie exposes size/flavor/message/date; everything else shows diet info.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from '@/lib/types';
import { formatDH } from '@/lib/format';
import { CAKE_SIZES, CAKE_FLAVORS, GOLD_TAGS } from '@/lib/constants';
import { useCart } from '@/lib/cart-store';
import { useFavorites } from '@/lib/favorites-store';
import { useToast } from '@/lib/toast-store';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import { Badge } from '@/components/ui/Badge';
import { Stars } from '@/components/ui/Stars';
import { Chip } from '@/components/ui/Chip';
import { Stepper } from '@/components/ui/Stepper';
import { Btn } from '@/components/ui/Btn';

export interface ProductScreenProps {
  product: Product;
}

const PICKUP_DAYS = ['Demain', 'Sam. 6', 'Dim. 7', 'Lun. 8', 'Mar. 9'];

export function ProductScreen({ product: p }: ProductScreenProps) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const isFav = useFavorites((s) => s.isFav);
  const toggleFav = useFavorites((s) => s.toggle);
  const toast = useToast((s) => s.show);

  const [qty, setQty] = useState(1);
  const [sizeId, setSizeId] = useState('4-6');
  const [flavor, setFlavor] = useState('Vanille');
  const [message, setMessage] = useState('');
  const [date, setDate] = useState('');

  const size = CAKE_SIZES.find((s) => s.id === sizeId) ?? CAKE_SIZES[1];
  const unit = p.is_customizable ? Math.round(p.price_dh * size.mult) : p.price_dh;
  const total = unit * qty;
  const fav = isFav(p.id);

  const addToCart = () => {
    add(p.id, qty, {
      unit,
      sizeMult: p.is_customizable ? size.mult : 1,
      sizeLabel: p.is_customizable ? size.label : null,
      flavor: p.is_customizable ? flavor : null,
      message,
      date,
    });
    toast(`${p.name} ajouté`);
    router.push('/cart');
  };

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Photo header */}
        <div style={{ position: 'relative' }}>
          <PhotoSlot label={p.photo_label ?? p.name} src={p.image_url} style={{ height: 320 }} />
          <button
            onClick={() => router.back()}
            style={{
              position: 'absolute',
              top: SAFE_TOP + 2,
              left: 16,
              width: 42,
              height: 42,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.92)',
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
          <button
            onClick={() => toggleFav(p.id)}
            style={{
              position: 'absolute',
              top: SAFE_TOP + 2,
              right: 16,
              width: 42,
              height: 42,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.92)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            <Icon name="heart" size={20} color={fav ? 'var(--brand)' : 'var(--muted)'} fill={fav} />
          </button>
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: '26px 26px 0 0',
            marginTop: -24,
            position: 'relative',
            padding: '22px 20px 12px',
          }}
        >
          {/* tags */}
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
            {p.tags.map((t) => (
              <Badge key={t} gold={GOLD_TAGS.includes(t)}>
                {t}
              </Badge>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <h1
              style={{
                fontFamily: 'var(--ui-font)',
                fontWeight: 700,
                fontSize: 23,
                color: 'var(--ink)',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {p.name}
            </h1>
            <Stars value={p.rating} reviews={p.reviews_count} size={14} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 24, color: 'var(--brand)' }}>
              {formatDH(unit)}
            </span>
            <button
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--ui-font)',
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--muted)',
                textDecoration: 'underline',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Icon name="info" size={15} color="var(--muted)" /> Infos nutritionnelles
            </button>
          </div>

          {/* description */}
          <div style={{ marginTop: 16 }}>
            <h3
              style={{
                fontFamily: 'var(--ui-font)',
                fontWeight: 600,
                fontSize: 14.5,
                color: 'var(--ink)',
                margin: '0 0 6px',
              }}
            >
              Profil de saveur
            </h3>
            <p style={{ fontFamily: 'var(--ui-font)', fontSize: 14, lineHeight: 1.55, color: 'var(--muted)', margin: 0 }}>
              {p.description}
            </p>
          </div>

          {p.is_customizable ? (
            <>
              {/* size */}
              <div style={{ marginTop: 20 }}>
                <h3
                  style={{
                    fontFamily: 'var(--ui-font)',
                    fontWeight: 600,
                    fontSize: 14.5,
                    color: 'var(--ink)',
                    margin: '0 0 10px',
                  }}
                >
                  Taille
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9 }}>
                  {CAKE_SIZES.map((s) => {
                    const on = s.id === sizeId;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSizeId(s.id)}
                        style={{
                          padding: '12px 6px',
                          borderRadius: 14,
                          cursor: 'pointer',
                          textAlign: 'center',
                          background: on ? 'rgba(19,124,139,0.07)' : '#fff',
                          border: `1.5px solid ${on ? 'var(--brand)' : 'var(--line)'}`,
                        }}
                      >
                        <div
                          style={{
                            fontFamily: 'var(--ui-font)',
                            fontWeight: 600,
                            fontSize: 13,
                            color: on ? 'var(--brand)' : 'var(--ink)',
                          }}
                        >
                          {s.label}
                        </div>
                        <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                          {s.parts}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* flavor */}
              <div style={{ marginTop: 18 }}>
                <h3
                  style={{
                    fontFamily: 'var(--ui-font)',
                    fontWeight: 600,
                    fontSize: 14.5,
                    color: 'var(--ink)',
                    margin: '0 0 10px',
                  }}
                >
                  Parfum
                </h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {CAKE_FLAVORS.map((f) => (
                    <Chip key={f} active={f === flavor} onClick={() => setFlavor(f)}>
                      {f}
                    </Chip>
                  ))}
                </div>
              </div>
              {/* message on cake */}
              <div style={{ marginTop: 18 }}>
                <h3
                  style={{
                    fontFamily: 'var(--ui-font)',
                    fontWeight: 600,
                    fontSize: 14.5,
                    color: 'var(--ink)',
                    margin: '0 0 8px',
                  }}
                >
                  Message sur le gâteau{' '}
                  <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}>· optionnel</span>
                </h3>
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={30}
                  placeholder="Ex. Joyeux anniversaire Sara"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    border: '1.5px solid var(--line)',
                    borderRadius: 14,
                    padding: '13px 14px',
                    fontFamily: 'var(--ui-font)',
                    fontSize: 14,
                    outline: 'none',
                    color: 'var(--ink)',
                  }}
                />
              </div>
              {/* pickup/delivery date — pre-order 24-48h */}
              <div style={{ marginTop: 18 }}>
                <h3
                  style={{
                    fontFamily: 'var(--ui-font)',
                    fontWeight: 600,
                    fontSize: 14.5,
                    color: 'var(--ink)',
                    margin: '0 0 8px',
                  }}
                >
                  Date de livraison
                </h3>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    background: 'rgba(168,151,35,0.08)',
                    border: '1px solid rgba(168,151,35,0.3)',
                    borderRadius: 14,
                    padding: '11px 13px',
                    marginBottom: 10,
                  }}
                >
                  <Icon name="info" size={17} color="var(--gold)" />
                  <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--gold)', fontWeight: 500 }}>
                    Pièce sur commande — prévoir 24 à 48 h.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
                  {PICKUP_DAYS.map((d) => {
                    const on = d === date;
                    return (
                      <button
                        key={d}
                        onClick={() => setDate(d)}
                        style={{
                          flexShrink: 0,
                          padding: '12px 16px',
                          borderRadius: 14,
                          cursor: 'pointer',
                          background: on ? 'var(--brand)' : '#fff',
                          border: `1.5px solid ${on ? 'var(--brand)' : 'var(--line)'}`,
                          color: on ? '#fff' : 'var(--ink)',
                          fontFamily: 'var(--ui-font)',
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div style={{ marginTop: 20, display: 'flex', gap: 18 }}>
              {['Halal', 'Fait maison', 'Frais du jour'].map((x) => (
                <div key={x} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      background: 'var(--soft)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="check" size={20} color="var(--brand)" />
                  </div>
                  <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)', textAlign: 'center' }}>
                    {x}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* quantity */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 }}>
            <h3 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', margin: 0 }}>
              Quantité
            </h3>
            <Stepper value={qty} onChange={setQty} />
          </div>
        </div>
      </div>

      {/* sticky add bar */}
      <div
        style={{
          flexShrink: 0,
          background: '#fff',
          borderTop: '1px solid var(--line)',
          padding: `12px 18px ${SAFE_BOTTOM + 12}px`,
        }}
      >
        <Btn full size="lg" onClick={addToCart}>
          <span style={{ display: 'inline-flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Ajouter au panier</span>
            <span style={{ fontWeight: 700 }}>{formatDH(total)}</span>
          </span>
        </Btn>
      </div>
    </div>
  );
}
