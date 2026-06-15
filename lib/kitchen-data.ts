// lib/kitchen-data.ts — Shared kitchen-board loader (client- AND server-safe).
// Takes any Supabase client (browser or server) and assembles the inputs for
// buildKitchenBoard: the active+ready orders, their items, a product→universe
// map (for station routing) and a user→full_name map (for short customer names).
// The server query (lib/queries.ts) and the live client (KitchenScreen) both
// call this so first paint and realtime refetch produce identical shapes.
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildKitchenBoard, type KitchenBoard } from '@/lib/kitchen';
import type { Order, OrderItem, Universe } from '@/lib/types';

/** Statuses shown on the Cuisine board (the three kanban columns). */
export const KITCHEN_STATUSES = ['pending', 'preparing', 'ready'] as const;

export async function loadKitchenBoard(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<KitchenBoard> {
  const { data: ordersData } = await supabase
    .from('orders')
    .select('*')
    .in('status', KITCHEN_STATUSES as unknown as string[])
    .order('placed_at', { ascending: true });
  const orders = (ordersData ?? []) as Order[];

  const orderIds = orders.map((o) => o.id);
  const userIds = Array.from(new Set(orders.map((o) => o.user_id)));

  const [itemsRes, productsRes, profilesRes] = await Promise.all([
    orderIds.length
      ? supabase.from('order_items').select('*').in('order_id', orderIds)
      : Promise.resolve({ data: [] as OrderItem[] }),
    supabase.from('products').select('id, universe'),
    userIds.length
      ? supabase.from('profiles').select('id, full_name').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
  ]);

  const itemsByOrder = new Map<string, OrderItem[]>();
  for (const it of (itemsRes.data ?? []) as OrderItem[]) {
    const cur = itemsByOrder.get(it.order_id);
    if (cur) cur.push(it);
    else itemsByOrder.set(it.order_id, [it]);
  }

  const universeById = new Map<string, Universe>();
  for (const p of (productsRes.data ?? []) as { id: string; universe: Universe }[]) {
    universeById.set(p.id, p.universe);
  }

  const nameById = new Map<string, string | null>();
  for (const pr of (profilesRes.data ?? []) as { id: string; full_name: string | null }[]) {
    nameById.set(pr.id, pr.full_name);
  }

  return buildKitchenBoard({
    orders,
    itemsByOrder,
    universeOf: (productId) => (productId ? universeById.get(productId) ?? null : null),
    nameOf: (userId) => nameById.get(userId) ?? null,
    now,
  });
}
