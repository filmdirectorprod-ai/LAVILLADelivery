// components/admin/products/ProductsScreen.tsx
// Live container for the admin Produits screen, in the language of the Vue
// d'ensemble: headline figures (catalogue, on sale, out of stock, average price),
// a notice for out-of-stock products, state chips with counts (en vente, masqués,
// rupture, signatures, sans photo), universe chips, a search, and the catalogue
// grouped by category as photo cards. Subscribes to postgres_changes on products /
// categories and refetches on any change; each edit is an admin_update_product RPC
// (0016) and each creation an admin_create_product RPC (0019). A price, visibility
// or stock change here reaches the customer app at once.
'use client';
import { useCallback, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/lib/toast-store';
import { staffMessage } from '@/lib/order-error-messages';
import { formatAmount } from '@/lib/format';
import { PRODUCT_FILTER_LABEL, averagePrice, buildProductGroups, filterProducts, productFilterCounts, type ProductFilter } from '@/lib/admin-products';
import type { AdminProductsData } from '@/lib/queries';
import type { Product, Category, Universe } from '@/lib/types';
import { ProductCard } from './ProductCard';
import { ProductForm, type ProductDraft } from './ProductForm';
import { ProductEditModal } from './ProductEditModal';
import { useRealtime } from '@/lib/use-realtime';
import { revalidateCatalogue } from '@/lib/revalidate-catalogue';
import { HeroStat } from '@/components/admin/overview/HeroStat';
import { Chip, EmptyState, GlassPanel, Notice, PageHeader, PanelTitle, PrimaryButton, SearchField } from '@/components/admin/ui/Glass';

const FILTERS: ProductFilter[] = ['all', 'active', 'hidden', 'out', 'signature', 'nophoto'];
const UNIVERSES: { value: Universe | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous les univers' },
  { value: 'patisserie', label: 'Pâtisserie' },
  { value: 'restaurant', label: 'Restaurant' },
];

export function ProductsScreen({ initial }: { initial: AdminProductsData }) {
  const toast = useToast((t) => t.show);
  const [products, setProducts] = useState<Product[]>(initial.products);
  const [categories, setCategories] = useState<Category[]>(initial.categories);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [filter, setFilter] = useState<ProductFilter>('all');
  const [universe, setUniverse] = useState<Universe | 'all'>('all');
  const [query, setQuery] = useState('');

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const [productsRes, categoriesRes] = await Promise.all([supabase.from('products').select('*').order('name'), supabase.from('categories').select('*').order('sort')]);
    setProducts((productsRes.data ?? []) as Product[]);
    setCategories((categoriesRes.data ?? []) as Category[]);
  }, []);

  // Editing a product fires one event per changed row; debounced, the catalogue
  // reloads once.
  useRealtime('admin-products', [{ table: 'products' }, { table: 'categories' }], refetch);

  const update = useCallback(
    async (product: Product, patch: { active?: boolean; price_dh?: number; is_signature?: boolean; in_stock?: boolean }) => {
      setBusy(true);
      // Optimistic: the switch moves at once, the refetch settles it.
      setProducts((list) => list.map((p) => (p.id === product.id ? { ...p, ...patch } : p)));
      const { error } = await createClient().rpc('admin_update_product', {
        p_product: product.id,
        p_active: patch.active ?? product.active,
        p_price_dh: patch.price_dh ?? product.price_dh,
        p_is_signature: patch.is_signature ?? product.is_signature,
        p_in_stock: patch.in_stock ?? product.in_stock,
      });
      setBusy(false);
      // L'affichage optimiste se corrigeait au rechargement, mais sans un mot :
      // l'interrupteur revenait en arrière tout seul, ce qui passe pour un bug.
      if (error) toast(staffMessage(error.message), 'alert');
      revalidateCatalogue();
      refetch();
    },
    [refetch, toast],
  );

  const onDelete = useCallback(
    async (p: Product) => {
      if (!window.confirm(`Supprimer « ${p.name} » du catalogue ? Cette action est irréversible.`)) return;
      setBusy(true);
      const { error } = await createClient().rpc('admin_delete_product', { p_product: p.id });
      setBusy(false);
      if (error) window.alert('Suppression échouée : ' + error.message);
      else {
        revalidateCatalogue();
        refetch();
      }
    },
    [refetch],
  );

  const onCreate = useCallback(
    async (draft: ProductDraft) => {
      setBusy(true);
      const supabase = createClient();
      const { data: newId, error: createErr } = await supabase.rpc('admin_create_product', {
        p_name: draft.name,
        p_universe: draft.universe,
        p_category: draft.category,
        p_price_dh: draft.price_dh,
        p_photo_label: draft.photo_label || null,
        p_is_signature: draft.is_signature,
        p_active: draft.active,
      });
      // Création échouée : on garde le formulaire ouvert avec la saisie.
      if (createErr) {
        setBusy(false);
        toast(staffMessage(createErr.message), 'alert');
        return;
      }
      // Photo, maintenant que l'identifiant du produit existe.
      if (draft.imageFile && typeof newId === 'string') {
        const file = draft.imageFile;
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${newId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('product-images').upload(path, file, { upsert: true, contentType: file.type });
        if (upErr) {
          // Le produit existe, sa photo non : à dire, sinon le gérant croit à
          // un simple retard d'affichage et attend une image qui ne viendra pas.
          toast('Produit créé, mais la photo n’a pas pu être envoyée.', 'alert');
        } else {
          const { data } = supabase.storage.from('product-images').getPublicUrl(path);
          const { error: imgErr } = await supabase.rpc('admin_set_product_image', { p_product: newId, p_image_url: data.publicUrl });
          if (imgErr) toast('Produit créé, mais la photo n’a pas pu lui être associée.', 'alert');
        }
      }
      setBusy(false);
      setShowForm(false);
      revalidateCatalogue();
      refetch();
    },
    [refetch, toast],
  );

  const onToggleActive = useCallback((p: Product) => update(p, { active: !p.active }), [update]);
  const onToggleSignature = useCallback((p: Product) => update(p, { is_signature: !p.is_signature }), [update]);
  const onToggleStock = useCallback((p: Product) => update(p, { in_stock: !p.in_stock }), [update]);
  const onSavePrice = useCallback((p: Product, price_dh: number) => update(p, { price_dh }), [update]);

  const counts = useMemo(() => productFilterCounts(products), [products]);
  const visible = useMemo(() => filterProducts(products, filter, universe, query), [products, filter, universe, query]);
  const groups = useMemo(() => buildProductGroups(visible, categories), [visible, categories]);
  const avg = useMemo(() => averagePrice(products), [products]);

  return (
    <div style={{ padding: '30px 32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Produits"
        subtitle="Le catalogue de l'app client : prix, visibilité, stock et mises en avant."
        actions={!showForm ? <PrimaryButton onClick={() => setShowForm(true)}>+ Ajouter un produit</PrimaryButton> : undefined}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px 56px' }}>
        <HeroStat label={`Au catalogue · ${counts.signature} signature${counts.signature > 1 ? 's' : ''}`} value={String(counts.all)} />
        <HeroStat label="En vente" value={String(counts.active)} />
        <HeroStat label="En rupture" value={String(counts.out)} />
        <HeroStat label="Prix moyen en vente" value={formatAmount(avg)} unit="DH" />
      </div>

      {counts.out > 0 && filter !== 'out' && (
        <Notice icon="info">
          {counts.out} produit{counts.out > 1 ? 's sont' : ' est'} en rupture de stock et {counts.out > 1 ? 'affichés' : 'affiché'} comme tel{counts.out > 1 ? 's' : ''} aux clients.
        </Notice>
      )}

      {showForm && <ProductForm categories={categories} busy={busy} onCreate={onCreate} onCancel={() => setShowForm(false)} />}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div role="group" aria-label="Filtrer les produits" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <Chip key={f} on={filter === f} onClick={() => setFilter(f)} count={counts[f]}>
              {PRODUCT_FILTER_LABEL[f]}
            </Chip>
          ))}
        </div>
        <div role="group" aria-label="Filtrer par univers" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {UNIVERSES.map((u) => (
            <Chip key={u.value} on={universe === u.value} onClick={() => setUniverse(u.value)}>
              {u.label}
            </Chip>
          ))}
        </div>
        <SearchField value={query} onChange={setQuery} label="Rechercher un produit" style={{ maxWidth: 300, marginLeft: 'auto' }} />
      </div>

      {products.length === 0 ? (
        <GlassPanel>
          <EmptyState title="Aucun produit au catalogue." hint="Ajoutez un premier produit : il apparaîtra aussitôt dans l'app client." />
        </GlassPanel>
      ) : groups.length === 0 ? (
        <GlassPanel>
          <EmptyState title="Aucun produit ne correspond." hint="Changez de filtre ou de recherche." />
        </GlassPanel>
      ) : (
        groups.map((group) => (
          <section key={group.key} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <PanelTitle aside={`${group.products.length} produit${group.products.length > 1 ? 's' : ''}`}>
              <span style={{ color: 'var(--a-text)', fontSize: 17 }}>{group.label}</span>
            </PanelTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16, alignItems: 'start' }}>
              {group.products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  busy={busy}
                  onToggleActive={onToggleActive}
                  onToggleSignature={onToggleSignature}
                  onToggleStock={onToggleStock}
                  onSavePrice={onSavePrice}
                  onEdit={setEditing}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {editing && (
        <ProductEditModal
          product={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            revalidateCatalogue();
            refetch();
          }}
        />
      )}
    </div>
  );
}
