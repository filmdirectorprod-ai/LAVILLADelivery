// components/admin/products/ProductCard.tsx
// One catalogue card in the admin Produits grid: a photo (or a placeholder), the
// name + universe, state pills, an editable price, and switches for "En vente",
// "En stock" and "Signature". Local state only holds the in-progress price edit;
// every committed change is a callback the container turns into an
// admin_update_product RPC (0016).
'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Icon } from '@/components/ui/Icon';
import type { Product } from '@/lib/types';
import { GhostButton, GlassPanel, Pill, Switch, fieldStyle } from '@/components/admin/ui/Glass';

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

const text = { fontFamily: 'var(--ui-font)' } as const;

function SwitchRow({ label, checked, onChange, disabled, name }: { label: string; checked: boolean; onChange: () => void; disabled: boolean; name: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ ...text, fontSize: 13, color: checked ? 'var(--ink)' : 'var(--muted)' }}>{label}</span>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={`${label} — ${name}`} />
    </div>
  );
}

export function ProductCard({ product, busy, onToggleActive, onToggleSignature, onToggleStock, onSavePrice, onEdit, onDelete }: ProductCardProps) {
  const [price, setPrice] = useState(String(product.price_dh));
  const parsed = Number(price);
  const dirty = price.trim() !== '' && Number.isFinite(parsed) && parsed >= 0 && parsed !== product.price_dh;

  return (
    <GlassPanel padding={0} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', height: 132, background: 'var(--soft)', opacity: product.active ? 1 : 0.55 }}>
        {product.image_url ? (
          <Image src={product.image_url} alt={product.name} fill sizes="240px" style={{ objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Icon name="camera" size={26} color="var(--muted)" />
            <span style={{ ...text, fontSize: 11.5, color: 'var(--muted)', padding: '0 12px', textAlign: 'center' }}>{product.photo_label || 'Sans photo'}</span>
          </div>
        )}
        <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {product.is_signature ? (
            <span style={{ ...text, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--a-on-white)', background: '#ffffff', borderRadius: 999, padding: '3px 9px' }}>
              <Icon name="star" size={11} color="var(--a-accent)" fill /> Signature
            </span>
          ) : (
            <span />
          )}
          {!product.active && (
            <span style={{ background: 'rgba(0, 0, 0, 0.6)', borderRadius: 999 }}>
              <Pill tone="muted">Masqué</Pill>
            </span>
          )}
        </div>
        {!product.in_stock && (
          <span style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(0, 0, 0, 0.7)', borderRadius: 999 }}>
            <Pill tone="accent">Rupture de stock</Pill>
          </span>
        )}
      </div>

      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ ...text, margin: 0, fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</h3>
          <div style={{ ...text, fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{product.universe === 'patisserie' ? 'Pâtisserie' : 'Restaurant'}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="number"
            min={0}
            step={1}
            value={price}
            disabled={busy}
            aria-label={`Prix de ${product.name} en dirhams`}
            onChange={(e) => setPrice(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && dirty) onSavePrice(product, parsed);
            }}
            style={{ ...fieldStyle, width: 88, padding: '7px 10px', textAlign: 'right', fontSize: 15, fontWeight: 600 }}
          />
          <span style={{ ...text, fontSize: 12.5, color: 'var(--muted)' }}>DH</span>
          {dirty && (
            <GhostButton disabled={busy} onClick={() => onSavePrice(product, parsed)} style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: 12.5 }}>
              Enregistrer
            </GhostButton>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <SwitchRow label="En vente" checked={product.active} onChange={() => onToggleActive(product)} disabled={busy} name={product.name} />
          <SwitchRow label="En stock" checked={product.in_stock} onChange={() => onToggleStock(product)} disabled={busy} name={product.name} />
          <SwitchRow label="Signature" checked={product.is_signature} onChange={() => onToggleSignature(product)} disabled={busy} name={product.name} />
        </div>

        <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <GhostButton disabled={busy} onClick={() => onEdit(product)} style={{ flex: 1 }} aria-label={`Modifier ${product.name}`}>
            Modifier
          </GhostButton>
          <GhostButton disabled={busy} onClick={() => onDelete(product)} aria-label={`Supprimer ${product.name}`} style={{ padding: '8px 11px' }}>
            <Icon name="x" size={14} color="var(--ink)" />
          </GhostButton>
        </div>
      </div>
    </GlassPanel>
  );
}
