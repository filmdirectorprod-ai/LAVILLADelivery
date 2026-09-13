// components/admin/products/ProductEditModal.tsx
// Edit a product (name / universe / category / price / description / signature /
// en-vente / stock) and upload its photo. Image goes to the product-images storage
// bucket (staff-only write); the public URL is saved via admin_edit_product (0029).
// With several agencies, stock can be overridden per agency.
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/lib/toast-store';
import { staffMessage } from '@/lib/order-error-messages';
import { Icon } from '@/components/ui/Icon';
import { useBranches } from '@/lib/use-branches';
import type { Category, Product, Universe } from '@/lib/types';
import { revalidateCatalogue } from '@/lib/revalidate-catalogue';
import { FormError, GhostButton, Modal, PrimaryButton, Switch, fieldStyle, labelStyle } from '@/components/admin/ui/Glass';

const text = { fontFamily: 'var(--ui-font)' } as const;

export function ProductEditModal({ product, categories, onClose, onDone }: { product: Product; categories: Category[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast((t) => t.show);
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
    // L'interrupteur bougeait quoi qu'il arrive : le gérant croyait avoir mis
    // le produit en rupture, et les clients continuaient de le commander.
    const { error } = await createClient().rpc('admin_set_product_branch_stock', { p_product: product.id, p_branch: branchId, p_in_stock: next });
    if (error) {
      setBranchStock((p) => ({ ...p, [branchId]: !next })); // on remet l'interrupteur où il était
      toast(staffMessage(error.message), 'alert');
      return;
    }
    revalidateCatalogue(); // la pastille « Rupture » vient du catalogue en cache
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
    const { error: e } = await createClient().rpc('admin_edit_product', {
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

  const toggle = (label: string, checked: boolean, onChange: (v: boolean) => void) => (
    <span style={{ ...text, display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink)' }}>
      <Switch checked={checked} onChange={onChange} label={label} />
      {label}
    </span>
  );

  return (
    <Modal title="Modifier le produit" onClose={onClose} width={540}>
      <div style={{ display: 'flex', gap: 14, marginBottom: 18, alignItems: 'center' }}>
        <div style={{ width: 110, height: 110, borderRadius: 18, background: 'var(--soft)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {imageUrl ? (
            // Upload preview: the src can be an object URL, which next/image
            // cannot optimise — a plain <img> is the right tool here.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Icon name="camera" size={26} color="var(--muted)" />
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
          <GhostButton onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Envoi…' : imageUrl ? 'Changer la photo' : 'Ajouter une photo'}
          </GhostButton>
          {imageUrl && (
            <GhostButton onClick={() => setImageUrl('')} style={{ color: 'var(--a-accent)' }}>
              Retirer la photo
            </GhostButton>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle} htmlFor="edit-prod-name">
            Nom
          </label>
          <input id="edit-prod-name" style={fieldStyle} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="edit-prod-universe">
            Univers
          </label>
          <select id="edit-prod-universe" style={fieldStyle} value={universe} onChange={(e) => setUniverse(e.target.value as Universe)}>
            <option value="patisserie">Pâtisserie</option>
            <option value="restaurant">Restaurant</option>
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="edit-prod-category">
            Catégorie
          </label>
          <select id="edit-prod-category" style={fieldStyle} value={effCategory} onChange={(e) => setCategory(e.target.value)}>
            {cats.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="edit-prod-price">
            Prix (DH)
          </label>
          <input id="edit-prod-price" type="number" min={0} step={1} style={{ ...fieldStyle, textAlign: 'right' }} value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle} htmlFor="edit-prod-description">
            Description
          </label>
          <textarea id="edit-prod-description" style={{ ...fieldStyle, minHeight: 72, resize: 'vertical' }} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 16 }}>
        {toggle('Signature', isSignature, setIsSignature)}
        {toggle('En vente', active, setActive)}
        {toggle('En stock (toutes agences)', inStock, setInStock)}
      </div>

      {branches.length > 1 && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <div style={labelStyle}>Stock par agence</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {branches.map((b) => {
              const on = branchStock[b.id] ?? inStock;
              const short = b.name.replace(/ —.*$/, '');
              return (
                <div key={b.id} style={{ ...text, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 13, color: 'var(--ink)' }}>
                  <span>{short}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: on ? 'var(--ink)' : 'var(--a-accent)', fontWeight: 600 }}>
                    {on ? 'En stock' : 'Rupture'}
                    <Switch checked={on} onChange={(next) => toggleBranchStock(b.id, next)} label={`Stock à ${short}`} />
                  </span>
                </div>
              );
            })}
          </div>
          <p style={{ ...text, fontSize: 11.5, color: 'var(--muted)', margin: '8px 0 0' }}>Remplace la disponibilité globale pour chaque agence.</p>
        </div>
      )}

      {error && <FormError>{error}</FormError>}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <GhostButton onClick={onClose} disabled={busy} style={{ flex: 1 }}>
          Annuler
        </GhostButton>
        <PrimaryButton onClick={save} disabled={busy || uploading} style={{ flex: 1.4 }}>
          {busy ? '…' : 'Enregistrer'}
        </PrimaryButton>
      </div>
    </Modal>
  );
}
