'use client';
// MODE RAMADAN — curated Ftour selection with adapted delivery slots. Ported
// from the prototype (screens-account.jsx Ramadan), driven by the real catalog
// (products in the 'ramadan' category).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from '@/lib/types';
import { useFavorites } from '@/lib/favorites-store';
import { useCart } from '@/lib/cart-store';
import { useToast } from '@/lib/toast-store';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { SectionHead } from '@/components/ui/SectionHead';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import { ProductCard } from '@/components/ProductCard';

export interface RamadanScreenProps {
  products: Product[];
}

const SLOTS: [string, string, string][] = [
  ['ftour', 'Avant le Ftour', '18:45'],
  ['shour', "Pour le S'hour", '03:30'],
  ['day', 'En journée', 'Au choix'],
];

export function RamadanScreen({ products }: RamadanScreenProps) {
  const router = useRouter();
  const isFav = useFavorites((s) => s.isFav);
  const toggleFav = useFavorites((s) => s.toggle);
  const quickAdd = useCart((s) => s.quickAdd);
  const toast = useToast((s) => s.show);
  const [slot, setSlot] = useState('ftour');

  const add = (p: Product) => {
    quickAdd(p);
    toast('Ajouté au panier');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <PhotoSlot label="Table de Ftour au crépuscule" style={{ height: 200 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(9,42,47,0.95), rgba(9,42,47,0.3))' }} />
        <button onClick={() => router.push('/')} style={{ position: 'absolute', top: SAFE_TOP + 2, left: 16, width: 42, height: 42, borderRadius: 999, background: 'rgba(255,255,255,0.92)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="left" size={20} color="var(--ink)" />
        </button>
        <div style={{ position: 'absolute', bottom: 16, left: 18, right: 18 }}>
          <Badge gold style={{ background: 'rgba(168,151,35,0.3)', color: '#F0E4A8', border: '1px solid rgba(168,151,35,0.6)' }}>☾ MODE RAMADAN</Badge>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 700, color: '#fff', marginTop: 8 }}>Préparez votre Ftour</div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '18px 18px 12px' }}>
        <h3 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 15, color: 'var(--ink)', margin: '0 0 10px' }}>Créneau de livraison adapté</h3>
        <div style={{ display: 'flex', gap: 9 }}>
          {SLOTS.map(([id, t, s]) => {
            const on = slot === id;
            return (
              <button
                key={id}
                onClick={() => setSlot(id)}
                style={{ flex: 1, padding: '13px 6px', borderRadius: 14, cursor: 'pointer', textAlign: 'center', background: on ? 'rgba(168,151,35,0.1)' : '#fff', border: `1.5px solid ${on ? 'var(--gold)' : 'var(--line)'}` }}
              >
                <Icon name={id === 'shour' ? 'clock' : 'flame'} size={20} color={on ? 'var(--gold)' : 'var(--muted)'} fill={id !== 'shour' && on} />
                <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 12.5, color: on ? 'var(--gold)' : 'var(--ink)', marginTop: 6 }}>{t}</div>
                <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{s}</div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 22 }}>
          <SectionHead title="Sélection Ftour" />
          {products.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, marginTop: 13 }}>
              {products.map((p) => (
                <ProductCard key={p.id} p={p} onOpen={() => router.push(`/product/${p.slug}`)} fav={isFav(p.id)} onFav={() => toggleFav(p.id)} onAdd={() => add(p)} />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px', fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--muted)' }}>
              Sélection Ftour bientôt disponible.
            </div>
          )}
        </div>
        <div style={{ height: SAFE_BOTTOM + 8 }} />
      </div>
    </div>
  );
}
