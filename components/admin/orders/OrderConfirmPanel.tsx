// components/admin/orders/OrderConfirmPanel.tsx
// Gérant confirmation sheet for a PENDING order. Lets the gérant adjust quantities,
// remove / add items and correct the delivery address + zone, with a live total
// preview (lib/order-confirm.ts). On "Confirmer" it persists any change via the
// edit RPCs (server recomputes authoritatively) then admin_confirm_order; "Annuler"
// calls admin_cancel_order with a reason. Fetches products + zones on open.
'use client';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDH } from '@/lib/format';
import { Icon } from '@/components/ui/Icon';
import { toConfirmItems, recomputeTotals, setItemQty, removeItem, addItem, canConfirm, toItemsPayload, type ConfirmItem } from '@/lib/order-confirm';
import type { AdminOrderRow } from '@/lib/admin-orders';
import type { Product, Zone } from '@/lib/types';
import { FormError, GhostButton, Modal, PrimaryButton, SubPanel, fieldStyle, labelStyle } from '@/components/admin/ui/Glass';

export interface OrderConfirmPanelProps {
  row: AdminOrderRow;
  onClose: () => void;
  onDone: () => void;
}

const section: CSSProperties = { fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', margin: '0 0 8px' };

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
      const [p, z] = await Promise.all([supabase.from('products').select('*').eq('active', true).order('name'), supabase.from('delivery_zones').select('*').order('fee_dh')]);
      setProducts((p.data ?? []) as Product[]);
      setZones((z.data ?? []) as Zone[]);
    })();
  }, []);

  // Original fixed discounts (promo + points), preserved across the edit.
  const discountDh = order.discount_dh;
  const pointsDiscountDh = Math.max(0, order.subtotal_dh + order.delivery_fee_dh - order.discount_dh - order.total_dh);
  const zoneFee = useMemo(() => zones.find((z) => z.id === zoneId)?.fee_dh, [zones, zoneId]);
  const totals = useMemo(() => recomputeTotals(items, { mode: order.mode, zoneFee, discountDh, pointsDiscountDh }), [items, order.mode, zoneFee, discountDh, pointsDiscountDh]);

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
    <Modal title={`Confirmer ${order.code}`} onClose={onClose} width={560}>
      <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)', margin: '-8px 0 18px' }}>
        {row.customerName ?? 'Client'} · {order.mode === 'livraison' ? 'Livraison' : 'Retrait'}
        {order.phone ? ` · ${order.phone}` : ''}
      </p>

      <h3 style={section}>Articles</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it) => (
          <SubPanel key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</div>
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)' }}>{formatDH(it.price)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button type="button" aria-label={`Retirer un ${it.name}`} onClick={() => setItems((x) => setItemQty(x, it.id, it.qty - 1))} style={stepBtn}>
                −
              </button>
              <span style={{ fontFamily: 'var(--ui-font)', fontSize: 14, fontWeight: 600, minWidth: 18, textAlign: 'center', color: 'var(--ink)' }}>{it.qty}</span>
              <button type="button" aria-label={`Ajouter un ${it.name}`} onClick={() => setItems((x) => setItemQty(x, it.id, it.qty + 1))} style={stepBtn}>
                +
              </button>
            </div>
            <button type="button" onClick={() => setItems((x) => removeItem(x, it.id))} aria-label={`Supprimer ${it.name}`} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}>
              <Icon name="x" size={15} color="var(--a-accent)" />
            </button>
          </SubPanel>
        ))}
        {items.length === 0 && <FormError>Aucun article — ajoutez-en un.</FormError>}
      </div>

      {adding ? (
        <SubPanel style={{ marginTop: 10, padding: 10 }}>
          <input autoFocus value={pquery} onChange={(e) => setPquery(e.target.value)} placeholder="Rechercher un produit…" aria-label="Rechercher un produit" style={{ ...fieldStyle, marginBottom: 8 }} />
          <div style={{ maxHeight: 180, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setItems((x) => addItem(x, { id: p.id, name: p.name, price: p.price_dh }));
                  setAdding(false);
                  setPquery('');
                }}
                style={{ textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: '8px 8px', borderRadius: 10, fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--ink)', display: 'flex', justifyContent: 'space-between', gap: 10 }}
              >
                <span>{p.name}</span>
                <span style={{ color: 'var(--muted)' }}>{formatDH(p.price_dh)}</span>
              </button>
            ))}
          </div>
        </SubPanel>
      ) : (
        <GhostButton onClick={() => setAdding(true)} style={{ marginTop: 10, width: '100%', borderStyle: 'dashed' }}>
          + Ajouter un article
        </GhostButton>
      )}

      {order.mode === 'livraison' && (
        <div style={{ marginTop: 18 }}>
          <h3 style={section}>Livraison</h3>
          <label style={labelStyle} htmlFor="confirm-address">
            Adresse
          </label>
          <input id="confirm-address" value={address} onChange={(e) => setAddress(e.target.value)} style={{ ...fieldStyle, marginBottom: 12 }} />
          <label style={labelStyle} htmlFor="confirm-zone">
            Zone
          </label>
          <select id="confirm-zone" value={zoneId ?? ''} onChange={(e) => setZoneId(e.target.value || null)} style={fieldStyle}>
            <option value="">Zone…</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name} · {formatDH(z.fee_dh)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ marginTop: 18, borderTop: '1px solid var(--line)', paddingTop: 12, fontFamily: 'var(--ui-font)', fontSize: 13.5 }}>
        <Row k="Sous-total" v={formatDH(totals.subtotal)} />
        {order.mode === 'livraison' && <Row k="Livraison" v={formatDH(totals.deliveryFee)} />}
        {discountDh > 0 && <Row k="Remise" v={'− ' + formatDH(discountDh)} />}
        {pointsDiscountDh > 0 && <Row k="Points" v={'− ' + formatDH(pointsDiscountDh)} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontWeight: 600, fontSize: 17, color: 'var(--ink)' }}>
          <span>Total</span>
          <span>{formatDH(totals.total)}</span>
        </div>
      </div>

      {error && <FormError>{error}</FormError>}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <GhostButton onClick={() => run('cancel')} disabled={busy} style={{ flex: 1, color: 'var(--a-accent)' }}>
          Annuler la commande
        </GhostButton>
        <PrimaryButton onClick={() => run('confirm')} disabled={busy || !canConfirm(items)} style={{ flex: 1.4 }}>
          {busy ? '…' : 'Confirmer → cuisine'}
        </PrimaryButton>
      </div>
    </Modal>
  );
}

const stepBtn: CSSProperties = { border: '1px solid var(--a-glass-line)', background: 'transparent', borderRadius: 999, width: 28, height: 28, cursor: 'pointer', fontSize: 16, fontWeight: 600, color: 'var(--ink)', lineHeight: 1 };

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', marginBottom: 4 }}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
