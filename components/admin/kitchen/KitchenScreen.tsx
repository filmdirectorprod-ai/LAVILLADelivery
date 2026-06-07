// components/admin/kitchen/KitchenScreen.tsx
// Live container for the Cuisine board. Renders the server snapshot of preparing
// orders, subscribes to postgres_changes on orders / order_items, and refetches
// the FIFO ticket list on any change. "Marquer prête" calls admin_mark_order_ready
// (0015); the order then leaves the board (it becomes 'ready') and enters the
// driver pool.
'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { KitchenTicket } from '@/lib/queries';
import type { Order, OrderItem } from '@/lib/types';
import { KitchenTicketCard } from './KitchenTicketCard';

export function KitchenScreen({ initial }: { initial: KitchenTicket[] }) {
  const [tickets, setTickets] = useState<KitchenTicket[]>(initial);
  const [busy, setBusy] = useState(false);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'preparing')
      .order('placed_at', { ascending: true });
    const list = (orders ?? []) as Order[];
    const ids = list.map((o) => o.id);
    const { data: items } = ids.length
      ? await supabase.from('order_items').select('*').in('order_id', ids)
      : { data: [] as OrderItem[] };
    const byOrder = new Map<string, OrderItem[]>();
    for (const it of (items ?? []) as OrderItem[]) {
      const cur = byOrder.get(it.order_id);
      if (cur) cur.push(it);
      else byOrder.set(it.order_id, [it]);
    }
    setTickets(list.map((order) => ({ order, items: byOrder.get(order.id) ?? [] })));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-kitchen')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, refetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const markReady = useCallback(
    async (orderId: string) => {
      setBusy(true);
      const supabase = createClient();
      await supabase.rpc('admin_mark_order_ready', { p_order: orderId });
      setBusy(false);
      refetch();
    },
    [refetch],
  );

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>Cuisine</h1>
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
          {tickets.length} commande{tickets.length > 1 ? 's' : ''} en préparation
        </p>
      </div>

      {tickets.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: '40px 22px', textAlign: 'center', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>
          Aucune commande en préparation.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18, alignItems: 'start' }}>
          {tickets.map((t) => (
            <KitchenTicketCard key={t.order.id} ticket={t} busy={busy} onMarkReady={markReady} />
          ))}
        </div>
      )}
    </div>
  );
}
