'use client';
// ACCUEIL — Home screen. Ported from the prototype (screens-home.jsx Home),
// adapted to real fetched data + Next routing + the cart/favorites stores.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Category, Product, Zone } from '@/lib/types';
import type { CategoryUniverse, OrderMode } from '@/lib/types';
import { formatDH } from '@/lib/format';
import { useCart } from '@/lib/cart-store';
import { useFavorites } from '@/lib/favorites-store';
import { useOrderMode } from '@/lib/order-store';
import { useToast } from '@/lib/toast-store';
import { SAFE_TOP } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import { Chip } from '@/components/ui/Chip';
import { Badge } from '@/components/ui/Badge';
import { Btn } from '@/components/ui/Btn';
import { Segmented } from '@/components/ui/Segmented';
import { SectionHead } from '@/components/ui/SectionHead';
import { ProductCard } from '@/components/ProductCard';

export interface HomeScreenProps {
  products: Product[];
  categories: Category[];
  zone: Zone | null;
  unread: number;
}

export function HomeScreen({ products, categories, zone, unread }: HomeScreenProps) {
  const router = useRouter();
  const quickAddToCart = useCart((s) => s.quickAdd);
  const isFav = useFavorites((s) => s.isFav);
  const toggleFav = useFavorites((s) => s.toggle);
  const toast = useToast((s) => s.show);
  const mode = useOrderMode((s) => s.mode);
  const setMode = useOrderMode((s) => s.setMode);

  const [universe, setUniverse] = useState<CategoryUniverse>('all');

  const uniProducts =
    universe === 'all' ? products : products.filter((p) => p.universe === universe);
  const cats = categories.filter((c) => universe === 'all' || c.universe === universe);
  const favs = uniProducts.slice(0, 6);
  const hero =
    products.find((p) => p.slug.includes('fraisier')) ??
    products.find((p) => p.is_signature) ??
    products[0] ??
    null;

  const quickAdd = (p: Product) => {
    quickAddToCart(p);
    toast(`${p.name} ajouté`);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ padding: `${SAFE_TOP + 6}px 18px 14px`, background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)', fontWeight: 500 }}>
              {mode === 'retrait' ? 'Retrait à' : 'Livrer à'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
              <Icon name="pin" size={16} color="var(--brand)" fill />
              <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>
                Fès, Av. Hassan II
              </span>
              <Icon name="down" size={15} color="var(--ink)" />
            </div>
            {mode !== 'retrait' && zone && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 5,
                  background: 'rgba(19,124,139,0.08)',
                  borderRadius: 999,
                  padding: '3px 9px',
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--brand)' }} />
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11, fontWeight: 600, color: 'var(--brand)' }}>
                  Zone {zone.name} · ~{zone.eta_min} min · {formatDH(zone.fee_dh)}
                </span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => router.push('/notifications')}
              style={{
                position: 'relative',
                width: 42,
                height: 42,
                borderRadius: 999,
                border: '1px solid var(--line)',
                cursor: 'pointer',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="bell" size={21} color="var(--ink)" />
              {unread > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 7,
                    minWidth: 16,
                    height: 16,
                    padding: '0 4px',
                    borderRadius: 999,
                    background: 'var(--gold)',
                    color: '#fff',
                    fontSize: 9.5,
                    fontWeight: 700,
                    fontFamily: 'var(--ui-font)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1.5px solid #fff',
                  }}
                >
                  {unread}
                </span>
              )}
            </button>
            <button
              onClick={() => router.push('/profile')}
              style={{
                width: 42,
                height: 42,
                borderRadius: 999,
                border: '2px solid var(--gold)',
                cursor: 'pointer',
                padding: 2,
                background: '#fff',
                overflow: 'hidden',
              }}
            >
              <PhotoSlot label="avatar" style={{ width: '100%', height: '100%', borderRadius: 999 }} dim />
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <div
            onClick={() => router.push('/search')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              background: 'var(--soft)',
              borderRadius: 14,
              padding: '12px 14px',
              cursor: 'pointer',
            }}
          >
            <Icon name="search" size={19} color="var(--muted)" />
            <span style={{ fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--muted)' }}>
              Rechercher un gâteau, un plat…
            </span>
          </div>
          <button
            onClick={() => router.push('/search')}
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              background: 'var(--brand)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="sliders" size={20} color="#fff" />
          </button>
        </div>

        {/* Mode + universe */}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <Segmented
            style={{ flex: 1 }}
            value={mode}
            onChange={(v) => setMode(v as OrderMode)}
            options={[
              { value: 'livraison', label: 'Livraison', icon: <Icon name="scooter" size={16} /> },
              { value: 'retrait', label: 'Retrait', icon: <Icon name="store" size={16} /> },
            ]}
          />
        </div>
        <div style={{ marginTop: 10 }}>
          <Segmented
            value={universe}
            onChange={(v) => setUniverse(v as CategoryUniverse)}
            options={[
              { value: 'all', label: 'Tout' },
              { value: 'patisserie', label: 'Pâtisserie' },
              { value: 'restaurant', label: 'Restaurant' },
            ]}
          />
        </div>
      </div>

      {/* Categories */}
      <div style={{ display: 'flex', gap: 9, overflowX: 'auto', padding: '14px 18px 4px', scrollbarWidth: 'none' }}>
        {cats.map((c) => (
          <Chip key={c.id} onClick={() => router.push(`/search?category=${encodeURIComponent(c.key)}`)}>
            {c.label}
          </Chip>
        ))}
      </div>

      {/* Hero banner — Chef's Choice */}
      {hero && (
        <div style={{ padding: '14px 18px 0' }}>
          <div
            onClick={() => router.push(`/product/${hero.slug}`)}
            style={{
              position: 'relative',
              borderRadius: 22,
              overflow: 'hidden',
              cursor: 'pointer',
              height: 184,
              boxShadow: '0 14px 30px -16px rgba(19,124,139,0.5)',
            }}
          >
            <PhotoSlot label="Bannière héro — création du chef" src={hero.image_url} style={{ position: 'absolute', inset: 0 }} />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(105deg, rgba(11,58,64,0.92) 30%, rgba(11,58,64,0.25) 100%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <Badge
                gold
                style={{
                  alignSelf: 'flex-start',
                  background: 'rgba(168,151,35,0.25)',
                  color: '#F0E4A8',
                  border: '1px solid rgba(168,151,35,0.5)',
                }}
              >
                ★ ÉDITION LIMITÉE
              </Badge>
              <div
                style={{
                  fontFamily: 'Playfair Display, serif',
                  fontSize: 25,
                  fontWeight: 700,
                  color: '#fff',
                  marginTop: 10,
                  lineHeight: 1.1,
                  maxWidth: '78%',
                }}
              >
                La création du Chef
              </div>
              <p
                style={{
                  fontFamily: 'var(--ui-font)',
                  fontSize: 12.5,
                  color: 'rgba(255,255,255,0.82)',
                  margin: '6px 0 14px',
                  maxWidth: '66%',
                }}
              >
                Le Fraisier signature, fraises de Sefrou.
              </p>
              <Btn size="sm" variant="gold" style={{ alignSelf: 'flex-start' }}>
                Découvrir
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Favoris */}
      <div style={{ padding: '22px 18px 0' }}>
        <SectionHead title="Les Favoris de La Villa" action="Tout voir" onAction={() => router.push('/search')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, marginTop: 13 }}>
          {favs.map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              onOpen={() => router.push(`/product/${p.slug}`)}
              fav={isFav(p.id)}
              onFav={() => toggleFav(p.id)}
              onAdd={() => quickAdd(p)}
            />
          ))}
        </div>
      </div>

      {/* Secondary promo */}
      <div style={{ padding: '22px 18px 0' }}>
        <div
          onClick={() => router.push('/ramadan')}
          style={{
            borderRadius: 20,
            overflow: 'hidden',
            cursor: 'pointer',
            position: 'relative',
            background: 'linear-gradient(110deg, var(--brand), var(--brand-d))',
            padding: '20px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 16, color: '#fff' }}>
              Mode Ramadan
            </div>
            <p style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'rgba(255,255,255,0.85)', margin: '4px 0 0' }}>
              Plateaux Ftour &amp; créneaux dédiés. -15 % cette semaine.
            </p>
          </div>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'rgba(255,255,255,0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="flame" size={28} color="var(--gold)" fill />
          </div>
        </div>
      </div>

      <div style={{ padding: '22px 18px 0' }}>
        <SectionHead
          title={universe === 'restaurant' ? 'Nos plats du jour' : 'À découvrir'}
          action="Voir plus"
          onAction={() => router.push('/search')}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, marginTop: 13 }}>
          {uniProducts.slice(6, 10).map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              onOpen={() => router.push(`/product/${p.slug}`)}
              fav={isFav(p.id)}
              onFav={() => toggleFav(p.id)}
              onAdd={() => quickAdd(p)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
