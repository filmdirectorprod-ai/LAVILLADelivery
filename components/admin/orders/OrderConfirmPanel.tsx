// components/admin/orders/OrderConfirmPanel.tsx
// Gérant confirmation modal for a PENDING order. Lets the gérant adjust quantities,
// remove / add items and correct the delivery address + zone, with a live total
// preview (lib/order-confirm.ts). On "Confirmer" it persists any change via the
// edit RPCs (server recomputes authoritatively) then admin_confirm_order; "Annuler"
// calls admin_cancel_order with a reason. Fetches products + zones on open.
'use client';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDH } from '@/lib/format';
import { Icon } from '@/components/ui/Icon';
import {
  toConfirmItems,
  recomputeTotals,
  setItemQty,
  removeItem,
  addItem,
  canConfirm,
  toItemsPayload,
  type ConfirmItem,
} from '@/lib/order-confirm';
import type { AdminOrderRow } from '@/lib/admin-orders';
import type { Product, Zone } from '@/lib/types';

export interface OrderConfirmPanelProps {
  row: AdminOrderRow;
  onClose: () => void;
  onDone: () => void;
}

const label: React.CSSProperties = { fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, color: 'var(--muted)' };

export function OrderConfirmPanel({ row, onClose, onDone }: OrderConfirmPanelProps) {
  const order = row.order;
  const [items, setItems] = useState<ConfirmItem[]>(() => toConfirmItems(row.items));
  const [address, setAddress] = useState(order.address ?? '');
  const [zoneId, setZoneId] = useState<string | null>(order.zone_id);
  const [products, setProducts] = useState<Product[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [adding, setAdding] = useState(false);
  const [pquery, setPquery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [p, z] = await Promise.all([
        supabase.from('products').select('*').eq('active', true).order('name'),
        supabase.from('delivery_zones').select('*').order('fee_dh'),
      ]);
      setProducts((p.data ?? []) as Product[]);
      setZones((z.data ?? []) as Zone[]);
    })();
  }, []);

  // Original fixed discounts (promo + points), preserved across the edit.
  const discountDh = order.discount_dh;
  const pointsDiscountDh = Math.max(0, order.subtotal_dh + order.delivery_fee_dh - order.discount_dh - order.total_dh);
  const zoneFee = useMemo(() => zones.find((z) => z.id === zoneId)?.fee_dh, [zones, zoneId]);
  const totals = useMemo(
    () => recomputeTotals(items, { mode: order.mode, zoneFee, discountDh, pointsDiscountDh }),
    [items, order.mode, zoneFee, discountDh, pointsDiscountDh],
  );

  const itemsChanged = useMemo(() => {
    const orig = toConfirmItems(row.items);
    if (orig.length !== items.length) return true;
    return items.some((it, i) => orig[i]?.product_id !== it.product_id || orig[i]?.qty !== it.qty);
  }, [items, row.items]);
  const deliveryChanged = address !== (order.address ?? '') || zoneId !== order.zone_id;

  const filteredProducts = useMemo(() => {
    const q = pquery.trim().toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q)).slice(0, 40);
  }, [products, pquery]);

  async function run(action: 'confirm' | 'cancel') {
    setError(null);
    const supabase = createClient();
    try {
      setBusy(true);
      if (action === 'cancel') {
        const reason = window.prompt('Motif de l’annulation (optionnel) :') ?? '';
        const { error: e } = await supabase.rpc('admin_cancel_order', { p_order: order.id, p_reason: reason });
        if (e) throw e;
      } else {
        if (!canConfirm(items)) throw new Error('La commande doit contenir au moins un article.');
        if (itemsChanged) {
          const { error: e } = await supabase.rpc('admin_update_order_items', { p_order: order.id, p_items: toItemsPayload(items) });
          if (e) throw e;
        }
        if (deliveryChanged && order.mode === 'livraison') {
          const { error: e } = await supabase.rpc('admin_update_order_delivery', { p_order: order.id, p_address: address, p_zone: zoneId });
          if (e) throw e;
        }
        const { error: e } = await supabase.rpc('admin_confirm_order', { p_order: order.id });
        if (e) throw e;
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action échouée.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(8,28,31,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 100%)', maxHeight: '92vh', overflow: 'auto', background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 30px 70px -30px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 18, color: 'var(--ink)', margin: 0 }}>Confirmer {order.code}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'var(--soft)', borderRadius: 999, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={16} color="var(--ink)" />
          </button>
        </div>
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', margin: '0 0 16px' }}>
          {row.customerName ?? 'Client'} · {order.mode === 'livraison' ? 'Livraison' : 'Retrait'}
        </p>

        {/* Items */}
        <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Articles</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it) => (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--soft)', borderRadius: 12, padding: '8px 12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</div>
                <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)' }}>{formatDH(it.price)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => setItems((x) => setItemQty(x, it.id, it.qty - 1))} style={stepBtn}>−</button>
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 14, fontWeight: 700, minWidth: 18, textAlign: 'center' }}>{it.qty}</span>
                <button onClick={() => setItems((x) => setItemQty(x, it.id, it.qty + 1))} style={stepBtn}>+</button>
              </div>
              <button onClick={() => setItems((x) => removeItem(x, it.id))} title="Retirer" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#a23' }}>
                <Icon name="x" size={15} color="#a23" />
              </button>
            </div>
          ))}
          {items.length === 0 && <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: '#a23' }}>Aucun article — ajoutez-en un.</div>}
        </div>

        {/* Add item */}
        {adding ? (
          <div style={{ marginTop: 10, border: '1px solid var(--line)', borderRadius: 12, padding: 10 }}>
            <input autoFocus value={pquery} onChange={(e) => setPquery(e.target.value)} placeholder="Rechercher un produit…" style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px', fontFamily: 'var(--ui-font)', fontSize: 13, marginBottom: 8 }} />
            <div style={{ maxHeight: 180, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredProducts.map((p) => (
                <button key={p.id} onClick={() => { setItems((x) => addItem(x, { id: p.id, name: p.name, price: p.price_dh })); setAdding(false); setPquery(''); }} style={{ textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: '7px 8px', borderRadius: 8, fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--ink)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{p.name}</span><span style={{ color: 'var(--muted)' }}>{formatDH(p.price_dh)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={{ marginTop: 10, border: '1px dashed var(--brand)', borderRadius: 10, padding: '9px', width: '100%', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontSize: 13, fontWeight: 600, color: 'var(--brand)', background: '#fff' }}>+ Ajouter un article</button>
        )}

        {/* Delivery */}
        {order.mode === 'livraison' && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Livraison</div>
            <label style={label}>Adresse</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 11px', fontFamily: 'var(--ui-font)', fontSize: 13.5, marginTop: 5, marginBottom: 10 }} />
            <label style={label}>Zone</label>
            <select value={zoneId ?? ''} onChange={(e) => setZoneId(e.target.value || null)} style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 11px', fontFamily: 'var(--ui-font)', fontSize: 13.5, marginTop: 5, background: '#fff' }}>
              <option value="">Zone…</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name} · {formatDH(z.fee_dh)}</option>)}
            </select>
          </div>
        )}

        {/* Totals */}
        <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 12, fontFamily: 'var(--ui-font)', fontSize: 13.5 }}>
          <Row k="Sous-total" v={formatDH(totals.subtotal)} />
          {order.mode === 'livraison' && <Row k="Livraison" v={formatDH(totals.deliveryFee)} />}
          {discountDh > 0 && <Row k="Remise" v={'− ' + formatDH(discountDh)} />}
          {pointsDiscountDh > 0 && <Row k="Points" v={'− ' + formatDH(pointsDiscountDh)} />}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
            <span>Total</span><span>{formatDH(totals.total)}</span>
          </div>
        </div>

        {error && <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: '#C0392B', fontWeight: 600, marginTop: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={() => run('cancel')} disabled={busy} style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 12, padding: '12px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: '#a23', background: '#fff', opacity: busy ? 0.6 : 1 }}>Annuler la commande</button>
          <button onClick={() => run('confirm')} disabled={busy || !canConfirm(items)} style={{ flex: 1.4, border: 'none', borderRadius: 12, padding: '12px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14, color: '#fff', background: '#2f9e6f', opacity: busy || !canConfirm(items) ? 0.6 : 1 }}>{busy ? '…' : 'Confirmer → cuisine'}</button>
        </div>
      </div>
    </div>
  );
}

const stepBtn: React.CSSProperties = { border: '1px solid var(--line)', background: '#fff', borderRadius: 8, width: 26, height: 26, cursor: 'pointer', fontSize: 16, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 };

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', marginBottom: 3 }}>
      <span>{k}</span><span>{v}</span>
    </div>
  );
}
