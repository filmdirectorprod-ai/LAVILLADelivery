// components/admin/products/ProductEditModal.tsx
// Edit a product (name / universe / category / price / description / signature /
// en-vente / stock) and upload its photo. Image goes to the product-images storage
// bucket (staff-only write); the public URL is saved via admin_edit_product (0029).
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@/components/ui/Icon';
import { useBranches } from '@/lib/use-branches';
import type { Category, Product, Universe } from '@/lib/types';

const field: React.CSSProperties = { fontFamily: 'var(--ui-font)', fontSize: 14, padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--ink)', width: '100%', background: '#fff' };
const label: React.CSSProperties = { fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)', fontWeight: 600 };

export function ProductEditModal({ product, categories, onClose, onDone }: { product: Product; categories: Category[]; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(product.name);
  const [universe, setUniverse] = useState<Universe>(product.universe);
  const [category, setCategory] = useState(product.category);
  const [price, setPrice] = useState(String(product.price_dh));
  const [description, setDescription] = useState(product.description ?? '');
  const [isSignature, setIsSignature] = useState(product.is_signature);
  const [active, setActive] = useState(product.active);
  const [inStock, setInStock] = useState(product.in_stock);
  const [imageUrl, setImageUrl] = useState(product.image_url ?? '');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const branches = useBranches();
  // Per-branch stock overrides (absent ⇒ falls back to the global flag).
  const [branchStock, setBranchStock] = useState<Record<string, boolean>>({});
  useEffect(() => {
    createClient()
      .from('product_branch')
      .select('branch_id, in_stock')
      .eq('product_id', product.id)
      .then(({ data }) => {
        const m: Record<string, boolean> = {};
        (data ?? []).forEach((r) => {
          m[(r as { branch_id: string }).branch_id] = (r as { in_stock: boolean }).in_stock;
        });
        setBranchStock(m);
      });
  }, [product.id]);

  async function toggleBranchStock(branchId: string, next: boolean) {
    setBranchStock((p) => ({ ...p, [branchId]: next }));
    await createClient().rpc('admin_set_product_branch_stock', { p_product: product.id, p_branch: branchId, p_in_stock: next });
  }

  const cats = useMemo(() => categories.filter((c) => c.universe === universe || c.universe === 'all'), [categories, universe]);
  const effCategory = cats.some((c) => c.key === category) ? category : cats[0]?.key ?? category;
  const parsedPrice = Number(price);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    const supabase = createClient();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${product.id}/${Date.now()}.${ext}`;
    const { error: e } = await supabase.storage.from('product-images').upload(path, file, { upsert: true, contentType: file.type });
    if (e) {
      setError("Échec de l'envoi de l'image : " + e.message);
    } else {
      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      setImageUrl(data.publicUrl);
    }
    setUploading(false);
  }

  async function save() {
    setError(null);
    if (!name.trim()) return setError('Le nom est requis.');
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) return setError('Prix invalide.');
    setBusy(true);
    const supabase = createClient();
    const { error: e } = await supabase.rpc('admin_edit_product', {
      p_product: product.id,
      p_name: name,
      p_universe: universe,
      p_category: effCategory,
      p_price_dh: parsedPrice,
      p_description: description,
      p_is_signature: isSignature,
      p_active: active,
      p_in_stock: inStock,
      p_image_url: imageUrl,
    });
    setBusy(false);
    if (e) return setError(e.message);
    onDone();
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(8,28,31,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px, 100%)', maxHeight: '92vh', overflow: 'auto', background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 30px 70px -30px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 18, color: 'var(--ink)', margin: 0 }}>Modifier le produit</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'var(--soft)', borderRadius: 999, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={16} color="var(--ink)" />
          </button>
        </div>

        {/* Photo */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 110, height: 110, borderRadius: 12, background: 'var(--soft)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Icon name="camera" size={26} color="var(--line)" />
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ border: '1px solid var(--brand)', borderRadius: 9, padding: '8px 14px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13, color: 'var(--brand)', background: '#fff' }}>
              {uploading ? 'Envoi…' : imageUrl ? 'Changer la photo' : 'Ajouter une photo'}
            </button>
            {imageUrl && (
              <button onClick={() => setImageUrl('')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontSize: 12, color: '#C0392B', textAlign: 'left' }}>Retirer la photo</button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: '1 / -1' }}>
            <span style={label}>Nom</span>
            <input style={field} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={label}>Univers</span>
            <select style={field} value={universe} onChange={(e) => setUniverse(e.target.value as Universe)}>
              <option value="patisserie">Pâtisserie</option>
              <option value="restaurant">Restaurant</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={label}>Catégorie</span>
            <select style={field} value={effCategory} onChange={(e) => setCategory(e.target.value)}>
              {cats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={label}>Prix (DH)</span>
            <input type="number" min={0} step={1} style={{ ...field, textAlign: 'right' }} value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: '1 / -1' }}>
            <span style={label}>Description</span>
            <textarea style={{ ...field, minHeight: 64, resize: 'vertical' }} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 14 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--ink)' }}>
            <input type="checkbox" checked={isSignature} onChange={(e) => setIsSignature(e.target.checked)} /> Signature
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--ink)' }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> En vente
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--ink)' }}>
            <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} /> En stock (toutes agences)
          </label>
        </div>

        {branches.length > 1 && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <div style={label}>Stock par agence</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {branches.map((b) => {
                const on = branchStock[b.id] ?? inStock;
                return (
                  <label key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer', fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--ink)' }}>
                    <span>{b.name.replace(/ —.*$/, '')}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: on ? '#2f9e6f' : '#d24b4b', fontWeight: 600 }}>
                      {on ? 'En stock' : 'Rupture'}
                      <input type="checkbox" checked={on} onChange={(e) => toggleBranchStock(b.id, e.target.checked)} />
                    </span>
                  </label>
                );
              })}
            </div>
            <p style={{ fontFamily: 'var(--ui-font)', fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
              Remplace la disponibilité globale pour chaque agence.
            </p>
          </div>
        )}

        {error &&<div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: '#C0392B', fontWeight: 600, marginTop: 14 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} disabled={busy} style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 10, padding: '12px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--ink)', background: '#fff' }}>Annuler</button>
          <button onClick={save} disabled={busy || uploading} style={{ flex: 1.4, border: 'none', borderRadius: 10, padding: '12px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14, color: '#fff', background: 'var(--brand)', opacity: busy || uploading ? 0.6 : 1 }}>{busy ? '…' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  );
}
