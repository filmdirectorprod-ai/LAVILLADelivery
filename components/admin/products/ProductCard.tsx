// components/admin/products/ProductCard.tsx
// One catalogue tile in the admin Produits grid: a photo (or a placeholder when the
// product has no image), the name + universe, an editable price, and signature /
// published toggles. Local state only holds the in-progress price edit; every
// committed change is a callback the container turns into an admin_update_product
// RPC (0016).
'use client';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { Product } from '@/lib/types';

export interface ProductCardProps {
  product: Product;
  busy: boolean;
  onToggleActive: (product: Product) => void;
  onToggleSignature: (product: Product) => void;
  onToggleStock: (product: Product) => void;
  onSavePrice: (product: Product, price: number) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export function ProductCard({ product, busy, onToggleActive, onToggleSignature, onToggleStock, onSavePrice, onEdit, onDelete }: ProductCardProps) {
  const [price, setPrice] = useState(String(product.price_dh));
  const parsed = Number(price);
  const dirty = price.trim() !== '' && Number.isFinite(parsed) && parsed >= 0 && parsed !== product.price_dh;

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: 16,
        boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        opacity: product.active ? 1 : 0.6,
      }}
    >
      {/* Photo or placeholder */}
      <div style={{ position: 'relative', height: 124, background: 'var(--soft)' }}>
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--muted)' }}>
            <Icon name="camera" size={26} color="var(--line)" />
            <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5 }}>{product.photo_label || 'Sans photo'}</span>
          </div>
        )}
        {product.is_signature && (
          <span style={{ position: 'absolute', top: 10, left: 10, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--ui-font)', fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--gold)', borderRadius: 999, padding: '3px 9px' }}>
            <Icon name="star" size={12} color="#fff" /> Signature
          </span>
        )}
        <span style={{ position: 'absolute', top: 10, right: 10, fontFamily: 'var(--ui-font)', fontSize: 11, fontWeight: 600, color: product.active ? 'var(--brand-d)' : 'var(--muted)', background: product.active ? 'rgba(255,255,255,0.92)' : 'var(--soft)', borderRadius: 999, padding: '3px 9px' }}>
          {product.active ? 'En vente' : 'Masqué'}
        </span>
        {!product.in_stock && (
          <span style={{ position: 'absolute', bottom: 10, left: 10, fontFamily: 'var(--ui-font)', fontSize: 11, fontWeight: 700, color: '#fff', background: '#d24b4b', borderRadius: 999, padding: '3px 9px' }}>
            Rupture de stock
          </span>
        )}
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
            style={{ width: 72, fontFamily: 'var(--ui-font)', fontSize: 13.5, padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 8, textAlign: 'right', color: 'var(--ink)' }}
          />
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>DH</span>
          <button
            type="button"
            disabled={busy || !dirty}
            onClick={() => onSavePrice(product, parsed)}
            style={{ marginLeft: 'auto', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: busy || !dirty ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: '#fff', background: 'var(--brand)', opacity: dirty && !busy ? 1 : 0.4 }}
          >
            OK
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => onToggleSignature(product)}
            title={product.is_signature ? 'Retirer des signatures' : 'Marquer comme signature'}
            style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px', cursor: busy ? 'default' : 'pointer', background: product.is_signature ? 'rgba(168,151,35,0.14)' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
          >
            <Icon name="star" size={14} color={product.is_signature ? 'var(--gold)' : 'var(--line)'} />
            <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, color: product.is_signature ? 'var(--gold)' : 'var(--muted)' }}>Signature</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onToggleActive(product)}
            style={{ flex: 1, border: 'none', borderRadius: 8, padding: '6px 10px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: product.active ? 'var(--brand-d)' : 'var(--muted)', background: product.active ? 'rgba(19,124,139,0.12)' : 'var(--soft)' }}
          >
            {product.active ? 'En vente' : 'Masqué'}
          </button>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => onToggleStock(product)}
          style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '7px 10px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: product.in_stock ? '#2f9e6f' : '#d24b4b', background: product.in_stock ? 'rgba(47,158,111,0.12)' : 'rgba(210,75,75,0.12)' }}
        >
          <span style={{ width: 8, height: 8, borderRadius: 999, background: product.in_stock ? '#2f9e6f' : '#d24b4b' }} />
          {product.in_stock ? 'En stock' : 'Rupture de stock'}
        </button>

        <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => onEdit(product)}
            style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '7px 10px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
          >
            <Icon name="edit" size={13} color="var(--ink)" /> Modifier
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDelete(product)}
            style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '7px 10px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: '#C0392B', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
          >
            <Icon name="x" size={13} color="#C0392B" /> Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
