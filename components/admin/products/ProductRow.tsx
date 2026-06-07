// components/admin/products/ProductRow.tsx
// One catalogue row in the admin Produits screen: name + category, an editable
// price, a "signature" toggle and an active/inactive toggle. Local state only
// holds the in-progress price edit; every committed change is a callback the
// container turns into an admin_update_product RPC (0016).
'use client';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { Product } from '@/lib/types';

export interface ProductRowProps {
  product: Product;
  busy: boolean;
  onToggleActive: (product: Product) => void;
  onToggleSignature: (product: Product) => void;
  onSavePrice: (product: Product, price: number) => void;
}

export function ProductRow({ product, busy, onToggleActive, onToggleSignature, onSavePrice }: ProductRowProps) {
  const [price, setPrice] = useState(String(product.price_dh));
  const parsed = Number(price);
  const dirty = price.trim() !== '' && Number.isFinite(parsed) && parsed >= 0 && parsed !== product.price_dh;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto auto auto',
        alignItems: 'center',
        gap: 14,
        padding: '12px 16px',
        borderBottom: '1px solid var(--line)',
        opacity: product.active ? 1 : 0.55,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {product.name}
        </div>
        <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
          {product.universe === 'patisserie' ? 'Pâtisserie' : 'Restaurant'}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number"
          min={0}
          step={1}
          value={price}
          disabled={busy}
          onChange={(e) => setPrice(e.target.value)}
          style={{ width: 78, fontFamily: 'var(--ui-font)', fontSize: 13.5, padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 8, textAlign: 'right', color: 'var(--ink)' }}
        />
        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>DH</span>
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={() => onSavePrice(product, parsed)}
          style={{ border: 'none', borderRadius: 8, padding: '6px 10px', cursor: busy || !dirty ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: '#fff', background: 'var(--brand)', opacity: dirty && !busy ? 1 : 0.4 }}
        >
          OK
        </button>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => onToggleSignature(product)}
        title={product.is_signature ? 'Retirer des signatures' : 'Marquer comme signature'}
        style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px', cursor: busy ? 'default' : 'pointer', background: product.is_signature ? 'rgba(168,151,35,0.14)' : '#fff', display: 'inline-flex', alignItems: 'center', gap: 5 }}
      >
        <Icon name="star" size={15} color={product.is_signature ? 'var(--gold)' : 'var(--line)'} />
        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, color: product.is_signature ? 'var(--gold)' : 'var(--muted)' }}>Signature</span>
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={() => onToggleActive(product)}
        style={{ border: 'none', borderRadius: 999, padding: '6px 14px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: product.active ? 'var(--brand-d)' : 'var(--muted)', background: product.active ? 'rgba(19,124,139,0.12)' : 'var(--soft)' }}
      >
        {product.active ? 'En vente' : 'Masqué'}
      </button>
    </div>
  );
}
