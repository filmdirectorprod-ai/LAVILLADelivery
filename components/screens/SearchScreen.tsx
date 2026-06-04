'use client';
// CATALOGUE / RECHERCHE — the /search tab. Ported from the prototype
// (screens-shop.jsx Catalog), adapted to fetched data + the cart/favorites
// stores. Filtering/sorting happen client-side over the full catalog.
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Category, Product } from '@/lib/types';
import { useCart } from '@/lib/cart-store';
import { useFavorites } from '@/lib/favorites-store';
import { useToast } from '@/lib/toast-store';
import { SAFE_TOP } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { Chip } from '@/components/ui/Chip';
import { ProductCard } from '@/components/ProductCard';

export interface SearchScreenProps {
  products: Product[];
  categories: Category[];
}

type Sort = 'populaire' | 'prix' | 'note';

export function SearchScreen({ products, categories }: SearchScreenProps) {
  const router = useRouter();
  const params = useSearchParams();
  const quickAddToCart = useCart((s) => s.quickAdd);
  const isFav = useFavorites((s) => s.isFav);
  const toggleFav = useFavorites((s) => s.toggle);
  const toast = useToast((s) => s.show);

  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>(params.get('category') ?? 'all');
  const [sort, setSort] = useState<Sort>('populaire');

  const cats = [{ key: 'all', label: 'Tout' }, ...categories.map((c) => ({ key: c.key, label: c.label }))];

  const list = useMemo(() => {
    let r = products;
    if (cat !== 'all') r = r.filter((p) => p.category === cat);
    if (q.trim()) {
      const needle = q.toLowerCase();
      r = r.filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(needle));
    }
    if (sort === 'prix') r = [...r].sort((a, b) => a.price_dh - b.price_dh);
    else if (sort === 'note') r = [...r].sort((a, b) => b.rating - a.rating);
    return r;
  }, [products, cat, q, sort]);

  const catLabel = categories.find((c) => c.key === cat)?.label;

  const quickAdd = (p: Product) => {
    quickAddToCart(p);
    toast(`${p.name} ajouté`);
  };

  return (
    <div>
      <div
        style={{
          padding: `${SAFE_TOP + 4}px 16px 12px`,
          background: '#fff',
          position: 'sticky',
          top: 0,
          zIndex: 5,
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              background: 'var(--soft)',
              borderRadius: 13,
              padding: '11px 13px',
            }}
          >
            <Icon name="search" size={18} color="var(--muted)" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un gâteau, un plat…"
              style={{
                flex: 1,
                border: 'none',
                background: 'none',
                outline: 'none',
                fontFamily: 'var(--ui-font)',
                fontSize: 14,
                color: 'var(--ink)',
              }}
            />
            {q && (
              <button
                onClick={() => setQ('')}
                style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}
              >
                <Icon name="x" size={16} color="var(--muted)" />
              </button>
            )}
          </div>
        </div>
        {/* category chips */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 12, scrollbarWidth: 'none' }}>
          {cats.map((c) => (
            <Chip key={c.key} active={c.key === cat} onClick={() => setCat(c.key)}>
              {c.label}
            </Chip>
          ))}
        </div>
      </div>

      {/* sort row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px 2px',
        }}
      >
        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>
          <b style={{ color: 'var(--ink)' }}>{list.length}</b>{' '}
          {catLabel && cat !== 'all' ? catLabel.toLowerCase() : 'résultats'}
        </span>
        <div style={{ display: 'flex', gap: 7 }}>
          {(
            [
              ['populaire', 'Populaire'],
              ['prix', 'Prix'],
              ['note', 'Note'],
            ] as [Sort, string][]
          ).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setSort(v)}
              style={{
                padding: '6px 11px',
                borderRadius: 999,
                cursor: 'pointer',
                fontFamily: 'var(--ui-font)',
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                background: sort === v ? 'var(--brand)' : 'var(--soft)',
                color: sort === v ? '#fff' : 'var(--muted)',
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, padding: '14px 18px 12px' }}>
        {list.map((p) => (
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
      {list.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '50px 30px',
            color: 'var(--muted)',
            fontFamily: 'var(--ui-font)',
            fontSize: 14,
          }}
        >
          Aucun résultat. Essayez un autre mot-clé.
        </div>
      )}
    </div>
  );
}
