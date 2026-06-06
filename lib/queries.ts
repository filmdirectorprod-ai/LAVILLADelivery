// Server-side data access for La Villa. All reads use the request-scoped
// (RLS-enforced) client; catalog tables are public-read, personal tables are
// owner-scoped by policy. Import only from Server Components / Route Handlers.
import { createServerSupabase } from '@/lib/supabase/server';
import type {
  Category,
  Product,
  Zone,
  Driver,
  Profile,
  Address,
  Order,
  OrderItem,
  OrderTracking,
  ChatMessage,
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

/** Current user's saved addresses (default first, then newest). */
export async function getMyAddresses(): Promise<Address[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('addresses')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function getMyOrders(): Promise<Order[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('orders').select('*').order('placed_at', { ascending: false });
  return data ?? [];
}

export interface OrderWithItems {
  order: Order;
  items: OrderItem[];
}

/** Current user's orders, each with its line items (newest first). */
export async function getMyOrdersWithItems(): Promise<OrderWithItems[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .order('placed_at', { ascending: false });
  return (data ?? []).map((row) => {
    const { order_items, ...order } = row as Order & { order_items: OrderItem[] };
    return { order: order as Order, items: order_items ?? [] };
  });
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

/** The Driver row linked to the current auth user, or null if not a driver. */
export async function getMyDriver(): Promise<Driver | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('drivers').select('*').eq('user_id', user.id).maybeSingle();
  return data ?? null;
}

export interface DriverOrder {
  order: Order;
  tracking: OrderTracking | null;
}

/**
 * Driver dashboard feed: every still-active order the driver may see — both the
 * unclaimed "available" pool and their own assigned deliveries (RLS decides
 * visibility via orders_driver_read). The caller splits the two by
 * tracking.driver_id / tracking.manual.
 */
export async function getDriverBoard(): Promise<DriverOrder[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('orders')
    .select('*, order_tracking(*)')
    .in('status', ['preparing', 'en_route'])
    .order('placed_at', { ascending: false });
  return (data ?? []).map((row) => {
    const { order_tracking, ...order } = row as Order & {
      order_tracking: OrderTracking | OrderTracking[] | null;
    };
    const tracking = Array.isArray(order_tracking)
      ? order_tracking[0] ?? null
      : order_tracking ?? null;
    return { order: order as Order, tracking };
  });
}

export interface DriverContact {
  full_name: string | null;
  phone: string | null;
  address: string | null;
}

/** Customer contact for an order the current driver has claimed (RPC, 0008). */
export async function getDriverOrderContact(orderId: string): Promise<DriverContact | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('driver_order_contact', { p_order: orderId });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
  return Array.isArray(data) ? data[0] : data;
}

export async function getDriverById(id: string | null): Promise<Driver | null> {
  if (!id) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('drivers').select('*').eq('id', id).maybeSingle();
  return data ?? null;
}

export interface DriverDelivery {
  order_id: string;
  code: string;
  mode: string;
  address: string | null;
  total_dh: number;
  delivery_fee_dh: number;
  delivered_at: string;
  placed_at: string;
}

/**
 * The current driver's COMPLETED deliveries. RLS only exposes still-active
 * orders (preparing/en_route), so finished ones come through a SECURITY DEFINER
 * RPC (migration 0010) scoped to lv_current_driver(). Source for the History and
 * Earnings screens — earnings = sum of delivery_fee_dh (0 for retrait).
 */
export async function getDriverDeliveries(): Promise<DriverDelivery[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('driver_deliveries');
  if (error || !data) return [];
  return data as DriverDelivery[];
}

export interface DriverReview {
  review_id: string;
  rating: number;
  tags: string[];
  comment: string;
  created_at: string;
  customer_name: string;
}

/**
 * Client reviews left on orders the current driver delivered (RPC, migration
 * 0011). Powers the "Mes évaluations clients" block on the Tournée screen.
 */
export async function getDriverReviews(): Promise<DriverReview[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('driver_reviews');
  if (error || !data) return [];
  return data as DriverReview[];
}

export async function getChatMessages(orderId: string): Promise<ChatMessage[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at');
  return data ?? [];
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
