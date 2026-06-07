// components/admin/products/ProductsScreen.tsx
// Live container for the admin Produits screen. Renders the server snapshot of the
// catalogue grouped by category, subscribes to postgres_changes on products /
// categories and refetches the same raw shapes on any change, and turns each edit
// into an admin_update_product RPC (0016). Grouping and counts come from
// lib/admin-products.ts so server and client agree. Real-time: a price/visibility
// change here propagates to the customer app instantly via the same channel.
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { buildProductGroups, catalogueStats } from '@/lib/admin-products';
import type { AdminProductsData } from '@/lib/queries';
import type { Product, Category } from '@/lib/types';
import { ProductRow } from './ProductRow';

export function ProductsScreen({ initial }: { initial: AdminProductsData }) {
  const [products, setProducts] = useState<Product[]>(initial.products);
  const [categories, setCategories] = useState<Category[]>(initial.categories);
  const [busy, setBusy] = useState(false);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const [productsRes, categoriesRes] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('categories').select('*').order('sort'),
    ]);
    setProducts((productsRes.data ?? []) as Product[]);
    setCategories((categoriesRes.data ?? []) as Category[]);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, refetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const update = useCallback(
    async (product: Product, patch: { active?: boolean; price_dh?: number; is_signature?: boolean }) => {
      setBusy(true);
      const supabase = createClient();
      await supabase.rpc('admin_update_product', {
        p_product: product.id,
        p_active: patch.active ?? product.active,
        p_price_dh: patch.price_dh ?? product.price_dh,
        p_is_signature: patch.is_signature ?? product.is_signature,
      });
      setBusy(false);
      refetch();
    },
    [refetch],
  );

  const onToggleActive = useCallback((p: Product) => update(p, { active: !p.active }), [update]);
  const onToggleSignature = useCallback((p: Product) => update(p, { is_signature: !p.is_signature }), [update]);
  const onSavePrice = useCallback((p: Product, price_dh: number) => update(p, { price_dh }), [update]);

  const groups = useMemo(() => buildProductGroups(products, categories), [products, categories]);
  const stats = useMemo(() => catalogueStats(products), [products]);

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>Produits</h1>
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
          {stats.total} produit{stats.total > 1 ? 's' : ''} · {stats.active} en vente · {stats.signature} signature{stats.signature > 1 ? 's' : ''}
        </p>
      </div>

      {groups.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: '40px 22px', textAlign: 'center', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>
          Aucun produit au catalogue.
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.key} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{group.label}</span>
              <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--muted)' }}>{group.products.length}</span>
            </div>
            {group.products.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                busy={busy}
                onToggleActive={onToggleActive}
                onToggleSignature={onToggleSignature}
                onSavePrice={onSavePrice}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
