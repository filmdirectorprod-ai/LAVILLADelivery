// components/admin/products/ProductsScreen.tsx
// Live container for the admin Produits screen. Renders the server snapshot of the
// catalogue grouped by category as a photo grid, subscribes to postgres_changes on
// products / categories and refetches the same raw shapes on any change, and turns
// each edit into an admin_update_product RPC (0016) and each creation into an
// admin_create_product RPC (0019). Grouping and counts come from
// lib/admin-products.ts so server and client agree. Real-time: a price/visibility
// change or a new product here propagates to the customer app instantly.
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { buildProductGroups, catalogueStats } from '@/lib/admin-products';
import type { AdminProductsData } from '@/lib/queries';
import type { Product, Category } from '@/lib/types';
import { ProductCard } from './ProductCard';
import { ProductForm, type ProductDraft } from './ProductForm';

export function ProductsScreen({ initial }: { initial: AdminProductsData }) {
  const [products, setProducts] = useState<Product[]>(initial.products);
  const [categories, setCategories] = useState<Category[]>(initial.categories);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

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

  const onCreate = useCallback(
    async (draft: ProductDraft) => {
      setBusy(true);
      const supabase = createClient();
      await supabase.rpc('admin_create_product', {
        p_name: draft.name,
        p_universe: draft.universe,
        p_category: draft.category,
        p_price_dh: draft.price_dh,
        p_photo_label: draft.photo_label || null,
        p_is_signature: draft.is_signature,
        p_active: draft.active,
      });
      setBusy(false);
      setShowForm(false);
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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>Produits</h1>
          <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
            {stats.total} produit{stats.total > 1 ? 's' : ''} · {stats.active} en vente · {stats.signature} signature{stats.signature > 1 ? 's' : ''}
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            style={{ border: 'none', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13.5, color: '#fff', background: 'var(--brand)' }}
          >
            + Ajouter un produit
          </button>
        )}
      </div>

      {showForm && (
        <ProductForm categories={categories} busy={busy} onCreate={onCreate} onCancel={() => setShowForm(false)} />
      )}

      {groups.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: '40px 22px', textAlign: 'center', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>
          Aucun produit au catalogue.
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.key} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 16, color: 'var(--ink)', margin: 0 }}>{group.label}</h2>
              <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 12.5, color: 'var(--muted)' }}>
                {group.products.length} produit{group.products.length > 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, alignItems: 'start' }}>
              {group.products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  busy={busy}
                  onToggleActive={onToggleActive}
                  onToggleSignature={onToggleSignature}
                  onSavePrice={onSavePrice}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
