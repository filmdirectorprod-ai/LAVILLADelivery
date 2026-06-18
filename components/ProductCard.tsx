'use client';
// Product grid card. Ported from the prototype (ui.jsx) and adapted to the
// real `Product` schema (price_dh, reviews_count, photo_label, is_signature).
import { formatDH } from '@/lib/format';
import { GOLD_TAGS } from '@/lib/constants';
import type { Product } from '@/lib/types';
import { PhotoSlot } from './ui/PhotoSlot';
import { Badge } from './ui/Badge';
import { Stars } from './ui/Stars';
import { Icon } from './ui/Icon';

export interface ProductCardProps {
  p: Product;
  onOpen?: () => void;
  fav?: boolean;
  onFav?: () => void;
  onAdd?: () => void;
}

export function ProductCard({ p, onOpen, fav, onFav, onAdd }: ProductCardProps) {
  const goldTag = p.tags.find((t) => GOLD_TAGS.includes(t));
  return (
    <div
      onClick={onOpen}
      data-testid="product-card"
      style={{
        background: '#fff',
        borderRadius: 18,
        overflow: 'hidden',
        cursor: 'pointer',
        border: p.is_signature
          ? '1px solid rgba(168,151,35,0.35)'
          : '1px solid var(--line)',
        boxShadow: '0 6px 18px -12px rgba(0,0,0,0.25)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ position: 'relative' }}>
        <PhotoSlot label={p.photo_label ?? p.name} src={p.image_url} style={{ height: 118 }} />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFav?.();
          }}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 32,
            height: 32,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.92)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
          }}
        >
          <Icon name="heart" size={17} color={fav ? 'var(--brand)' : 'var(--muted)'} fill={fav} />
        </button>
        {goldTag && (
          <div style={{ position: 'absolute', top: 8, left: 8 }}>
            <Badge gold>{goldTag}</Badge>
          </div>
        )}
        {!p.in_stock && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 700, color: '#fff', background: '#d24b4b', borderRadius: 999, padding: '5px 14px' }}>
              Rupture de stock
            </span>
          </div>
        )}
      </div>
      <div
        style={{
          padding: '11px 12px 13px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          flex: 1,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--ui-font)',
            fontWeight: 600,
            fontSize: 14,
            lineHeight: 1.25,
            color: 'var(--ink)',
          }}
        >
          {p.name}
        </div>
        <Stars value={p.rating} reviews={p.reviews_count} size={12} />
        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 4,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--ui-font)',
              fontWeight: 700,
              fontSize: 15,
              color: 'var(--brand)',
            }}
          >
            {formatDH(p.price_dh)}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (p.in_stock) onAdd?.();
            }}
            disabled={!p.in_stock}
            title={p.in_stock ? 'Ajouter au panier' : 'Rupture de stock'}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: p.in_stock ? 'var(--brand)' : 'var(--line)',
              border: 'none',
              cursor: p.in_stock ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: p.in_stock ? '0 6px 14px -6px var(--brand)' : 'none',
            }}
          >
            <Icon name="plus" size={17} color="#fff" strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  );
}
