// components/admin/products/ProductForm.tsx
// Inline form to create one product: name + universe (Pâtisserie/Restaurant) +
// category (constrained to the chosen universe) + price + optional photo caption,
// a "mise en avant premium" (signature) toggle and a "Publier dans l'app client"
// (active) toggle. Reports a validated draft via onCreate; the container turns it
// into an admin_create_product RPC (0019). A product published here is public-read
// at once, so it shows up in the customer app immediately.
'use client';
import { useMemo, useState } from 'react';
import type { Category, Universe } from '@/lib/types';

export interface ProductDraft {
  name: string;
  universe: Universe;
  category: string;
  price_dh: number;
  photo_label: string;
  is_signature: boolean;
  active: boolean;
}

export interface ProductFormProps {
  categories: Category[];
  busy: boolean;
  onCreate: (draft: ProductDraft) => void;
  onCancel: () => void;
}

const field: React.CSSProperties = {
  fontFamily: 'var(--ui-font)',
  fontSize: 13.5,
  padding: '8px 10px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  color: 'var(--ink)',
  width: '100%',
  background: '#fff',
};
const labelStyle: React.CSSProperties = { fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)', fontWeight: 600 };

export function ProductForm({ categories, busy, onCreate, onCancel }: ProductFormProps) {
  const [name, setName] = useState('');
  const [universe, setUniverse] = useState<Universe>('patisserie');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [photoLabel, setPhotoLabel] = useState('');
  const [isSignature, setIsSignature] = useState(false);
  const [active, setActive] = useState(true);

  // Categories valid for the chosen universe ('all' categories show everywhere).
  const universeCategories = useMemo(
    () => categories.filter((c) => c.universe === universe || c.universe === 'all'),
    [categories, universe],
  );

  // Keep the selected category valid when the universe changes.
  const effectiveCategory = universeCategories.some((c) => c.key === category)
    ? category
    : universeCategories[0]?.key ?? '';

  const parsedPrice = Number(price);
  const valid =
    name.trim() !== '' &&
    effectiveCategory !== '' &&
    price.trim() !== '' &&
    Number.isFinite(parsedPrice) &&
    parsedPrice >= 0;

  return (
    <div style={{ background: '#fff', border: '1px solid var(--brand)', borderRadius: 18, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Ajouter un produit</div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.5fr 1fr', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={labelStyle}>Nom</span>
          <input style={field} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} placeholder="Le Fraisier" />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={labelStyle}>Univers</span>
          <select style={field} value={universe} disabled={busy} onChange={(e) => setUniverse(e.target.value as Universe)}>
            <option value="patisserie">Pâtisserie</option>
            <option value="restaurant">Restaurant</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={labelStyle}>Catégorie</span>
          <select style={field} value={effectiveCategory} disabled={busy || universeCategories.length === 0} onChange={(e) => setCategory(e.target.value)}>
            {universeCategories.length === 0 && <option value="">Aucune catégorie</option>}
            {universeCategories.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={labelStyle}>Prix (DH)</span>
          <input style={{ ...field, textAlign: 'right' }} type="number" min={0} step={1} value={price} disabled={busy} onChange={(e) => setPrice(e.target.value)} placeholder="55" />
        </label>
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={labelStyle}>Légende photo (optionnel)</span>
        <input style={field} value={photoLabel} disabled={busy} onChange={(e) => setPhotoLabel(e.target.value)} placeholder="Fraises de Meknès, crème légère" />
      </label>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: busy ? 'default' : 'pointer' }}>
          <input type="checkbox" checked={isSignature} disabled={busy} onChange={(e) => setIsSignature(e.target.checked)} />
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--ink)' }}>Mise en avant premium</span>
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: busy ? 'default' : 'pointer' }}>
          <input type="checkbox" checked={active} disabled={busy} onChange={(e) => setActive(e.target.checked)} />
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--ink)' }}>Publier dans l&apos;app client</span>
        </label>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
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
            })
          }
          style={{ border: 'none', borderRadius: 10, padding: '9px 18px', cursor: busy || !valid ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13.5, color: '#fff', background: 'var(--brand)', opacity: valid && !busy ? 1 : 0.5 }}
        >
          Ajouter au catalogue
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '9px 18px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', background: '#fff' }}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
