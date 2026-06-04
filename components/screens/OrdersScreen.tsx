'use client';
// COMMANDES — order history. Ported from the prototype (screens-account.jsx
// Orders), adapted to real orders + line items. Active vs finished are derived
// from the order status; reorder rebuilds the cart from the line snapshots.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OrderStatus, Product } from '@/lib/types';
import type { OrderWithItems } from '@/lib/queries';
import { formatDH } from '@/lib/format';
import { defaultOpts, useCart } from '@/lib/cart-store';
import { useToast } from '@/lib/toast-store';
import { SAFE_TOP } from '@/lib/layout';
import { Segmented } from '@/components/ui/Segmented';
import { Badge } from '@/components/ui/Badge';
import { Btn } from '@/components/ui/Btn';
import { PhotoSlot } from '@/components/ui/PhotoSlot';

export interface OrdersScreenProps {
  orders: OrderWithItems[];
  products: Product[];
}

const ACTIVE: OrderStatus[] = ['pending', 'preparing', 'en_route'];

function whenLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function OrdersScreen({ orders, products }: OrdersScreenProps) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const toast = useToast((s) => s.show);
  const [tab, setTab] = useState<'en_cours' | 'terminee'>('en_cours');

  const byId = new Map(products.map((p) => [p.id, p]));
  const list = orders.filter(({ order }) =>
    tab === 'en_cours' ? ACTIVE.includes(order.status) : !ACTIVE.includes(order.status),
  );

  const reorder = (items: OrderWithItems['items']) => {
    items.forEach((it) => {
      if (!it.product_id) return;
      add(it.product_id, it.qty, { ...defaultOpts(it.price_snapshot) });
    });
    toast('Articles ajoutés au panier');
    router.push('/cart');
  };

  return (
    <div>
      <div style={{ padding: `${SAFE_TOP + 6}px 18px 0`, background: '#fff' }}>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 24, color: 'var(--ink)', margin: '0 0 14px' }}>
          Mes commandes
        </h1>
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as 'en_cours' | 'terminee')}
          options={[
            { value: 'en_cours', label: 'En cours' },
            { value: 'terminee', label: 'Terminées' },
          ]}
        />
      </div>

      <div style={{ padding: '16px 18px 0', display: 'flex', flexDirection: 'column', gap: 13 }}>
        {list.map(({ order: o, items }) => {
          const active = ACTIVE.includes(o.status);
          const names = items.map((it) => it.name_snapshot).join(', ');
          return (
            <div key={o.id} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>{o.code}</span>
                  <Badge gold={active}>{active ? '● En route' : 'Livrée'}</Badge>
                </div>
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)' }}>{whenLabel(o.placed_at)}</span>
              </div>
              <div style={{ display: 'flex', gap: 11, marginTop: 12 }}>
                <div style={{ display: 'flex' }}>
                  {items.slice(0, 2).map((it, i) => (
                    <PhotoSlot
                      key={it.id}
                      label={it.name_snapshot}
                      src={it.product_id ? byId.get(it.product_id)?.image_url : null}
                      style={{ width: 48, height: 48, borderRadius: 11, marginLeft: i ? -14 : 0, border: '2px solid #fff' }}
                    />
                  ))}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--ui-font)',
                      fontSize: 13,
                      color: 'var(--ink)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {names}
                  </div>
                  <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {o.mode} · <b style={{ color: 'var(--brand)' }}>{formatDH(o.total_dh)}</b>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 13 }}>
                {active ? (
                  <Btn size="sm" full onClick={() => router.push(`/tracking/${o.id}`)}>
                    Suivre la commande
                  </Btn>
                ) : (
                  <>
                    <Btn size="sm" variant="outline" style={{ flex: 1 }} onClick={() => reorder(items)}>
                      Recommander
                    </Btn>
                    <Btn size="sm" variant="ghost" style={{ flex: 1 }} onClick={() => router.push(`/review/${o.id}`)}>
                      Laisser un avis
                    </Btn>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {list.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--muted)' }}>
            Aucune commande {tab === 'en_cours' ? 'en cours' : 'terminée'}.
          </div>
        )}
      </div>
    </div>
  );
}
