// Server-side data access for La Villa. All reads use the request-scoped
// (RLS-enforced) client; catalog tables are public-read, personal tables are
// owner-scoped by policy. Import only from Server Components / Route Handlers.
import { createServerSupabase } from '@/lib/supabase/server';
import type {
  Category,
  Product,
  Zone,
  Profile,
  Order,
  OrderItem,
  OrderTracking,
  Reward,
  Notification,
  LoyaltyLedgerEntry,
} from '@/lib/types';

export async function getCategories(): Promise<Category[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('categories').select('*').order('sort');
  return data ?? [];
}

export async function getProducts(): Promise<Product[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('active', true)
    .order('created_at');
  return data ?? [];
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('products').select('*').eq('slug', slug).maybeSingle();
  return data ?? null;
}

export async function getZones(): Promise<Zone[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('delivery_zones').select('*').order('fee_dh');
  return data ?? [];
}

export async function getRewards(): Promise<Reward[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('rewards')
    .select('*')
    .eq('active', true)
    .order('cost_pts');
  return data ?? [];
}

/** Current signed-in user's profile (loyalty balance, tier), or null. */
export async function getMyProfile(): Promise<Profile | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return data ?? null;
}

export async function getMyOrders(): Promise<Order[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('orders').select('*').order('placed_at', { ascending: false });
  return data ?? [];
}

export interface OrderDetail {
  order: Order;
  items: OrderItem[];
  tracking: OrderTracking | null;
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const supabase = await createServerSupabase();
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return null;
  const [{ data: items }, { data: tracking }] = await Promise.all([
    supabase.from('order_items').select('*').eq('order_id', orderId),
    supabase.from('order_tracking').select('*').eq('order_id', orderId).maybeSingle(),
  ]);
  return { order, items: items ?? [], tracking: tracking ?? null };
}

export async function getMyLoyaltyLedger(): Promise<LoyaltyLedgerEntry[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('loyalty_ledger')
    .select('*')
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function getMyNotifications(): Promise<Notification[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });
  return data ?? [];
}
