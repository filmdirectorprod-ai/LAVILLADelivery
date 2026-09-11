// components/admin/products/ProductForm.tsx
// Inline form to create one product: name + universe (Pâtisserie/Restaurant) +
// category (constrained to the chosen universe) + price + optional photo and
// caption, a "mise en avant premium" (signature) switch and a "Publier dans l'app
// client" (active) switch. Reports a validated draft via onCreate; the container
// turns it into an admin_create_product RPC (0019). A product published here is
// public-read at once, so it shows up in the customer app immediately.
'use client';
import { useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { Category, Universe } from '@/lib/types';
import { GhostButton, GlassPanel, PanelTitle, PrimaryButton, Switch, fieldStyle, labelStyle } from '@/components/admin/ui/Glass';

export interface ProductDraft {
  name: string;
  universe: Universe;
  category: string;
  price_dh: number;
  photo_label: string;
  is_signature: boolean;
  active: boolean;
  /** Optional photo chosen at creation; uploaded by the container after insert. */
  imageFile: File | null;
}

export interface ProductFormProps {
  categories: Category[];
  busy: boolean;
  onCreate: (draft: ProductDraft) => void;
  onCancel: () => void;
}

export function ProductForm({ categories, busy, onCreate, onCancel }: ProductFormProps) {
  const [name, setName] = useState('');
  const [universe, setUniverse] = useState<Universe>('patisserie');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [photoLabel, setPhotoLabel] = useState('');
  const [isSignature, setIsSignature] = useState(false);
  const [active, setActive] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function pickImage(f: File | null) {
    setImageFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  // Categories valid for the chosen universe ('all' categories show everywhere).
  const universeCategories = useMemo(() => categories.filter((c) => c.universe === universe || c.universe === 'all'), [categories, universe]);

  // Keep the selected category valid when the universe changes.
  const effectiveCategory = universeCategories.some((c) => c.key === category) ? category : universeCategories[0]?.key ?? '';

  const parsedPrice = Number(price);
  const valid = name.trim() !== '' && effectiveCategory !== '' && price.trim() !== '' && Number.isFinite(parsedPrice) && parsedPrice >= 0;

  return (
    <GlassPanel>
      <PanelTitle>Ajouter un produit</PanelTitle>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
        <div>
          <label style={labelStyle} htmlFor="prod-name">
            Nom
          </label>
          <input id="prod-name" style={fieldStyle} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} placeholder="Le Fraisier" />
        </div>
        <div>
          <label style={labelStyle} htmlFor="prod-universe">
            Univers
          </label>
          <select id="prod-universe" style={fieldStyle} value={universe} disabled={busy} onChange={(e) => setUniverse(e.target.value as Universe)}>
            <option value="patisserie">Pâtisserie</option>
            <option value="restaurant">Restaurant</option>
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="prod-category">
            Catégorie
          </label>
          <select id="prod-category" style={fieldStyle} value={effectiveCategory} disabled={busy || universeCategories.length === 0} onChange={(e) => setCategory(e.target.value)}>
            {universeCategories.length === 0 && <option value="">Aucune catégorie</option>}
            {universeCategories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="prod-price">
            Prix (DH)
          </label>
          <input id="prod-price" style={{ ...fieldStyle, textAlign: 'right' }} type="number" min={0} step={1} value={price} disabled={busy} onChange={(e) => setPrice(e.target.value)} placeholder="55" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 76, height: 76, borderRadius: 16, background: 'var(--soft)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {preview ? (
            // Upload preview: the src can be an object URL, which next/image
            // cannot optimise — a plain <img> is the right tool here.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="aperçu" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Icon name="camera" size={22} color="var(--muted)" />
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => pickImage(e.target.files?.[0] ?? null)} />
        <GhostButton disabled={busy} onClick={() => fileRef.current?.click()}>
          {preview ? 'Changer la photo' : 'Ajouter une photo (optionnel)'}
        </GhostButton>
        {preview && (
          <GhostButton onClick={() => pickImage(null)} style={{ color: 'var(--a-accent)' }}>
            Retirer
          </GhostButton>
        )}
        <div style={{ flex: '1 1 240px' }}>
          <label style={labelStyle} htmlFor="prod-photo-label">
            Légende photo (si pas d&apos;image)
          </label>
          <input id="prod-photo-label" style={fieldStyle} value={photoLabel} disabled={busy} onChange={(e) => setPhotoLabel(e.target.value)} placeholder="Fraises de Meknès, crème légère" />
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, marginTop: 16 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--ink)' }}>
          <Switch checked={isSignature} onChange={setIsSignature} disabled={busy} label="Mise en avant premium" />
          Mise en avant premium
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--ink)' }}>
          <Switch checked={active} onChange={setActive} disabled={busy} label="Publier dans l'app client" />
          Publier dans l&apos;app client
        </span>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <PrimaryButton
          disabled={busy || !valid}
          onClick={() =>
            onCreate({
              name: name.trim(),
              universe,
              category: effectiveCategory,
              price_dh: parsedPrice,
              photo_label: photoLabel.trim(),
              is_signature: isSignature,
              active,
              imageFile,
            })
          }
        >
          Ajouter au catalogue
        </PrimaryButton>
        <GhostButton disabled={busy} onClick={onCancel}>
          Annuler
        </GhostButton>
      </div>
    </GlassPanel>
  );
}
