// Server-side data access for La Villa. All reads use the request-scoped
// (RLS-enforced) client; catalog tables are public-read, personal tables are
// owner-scoped by policy. Import only from Server Components / Route Handlers.
import { createServerSupabase } from '@/lib/supabase/server';
import { startOfTodayISO } from '@/lib/admin-overview';
import { DRIVER_POOL_STATUSES } from '@/lib/order-status';
import { buildAdminOrderRows, type AdminOrderRow } from '@/lib/admin-orders';
import { buildDriverRows, type DriverRow } from '@/lib/admin-drivers';
import { buildReviewRows, type ReviewRow } from '@/lib/admin-reviews';
import { buildIncidentRows, type IncidentRow } from '@/lib/admin-incidents';
import { buildShiftWeek, mondayOf, isoDate, type ShiftWeek } from '@/lib/admin-planning';
import { buildSupportThreads, type SupportThread, type RawSupportDriver } from '@/lib/admin-support';
import { loadKitchenBoard } from '@/lib/kitchen-data';
import type { KitchenBoard } from '@/lib/kitchen';
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
  Review,
  Incident,
  SupportMessage,
  DriverShift,
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

/**
 * The current driver's upcoming shifts for the "Mon planning" screen. RLS
 * (shifts_driver_read, 0018) scopes the table to this driver's own rows; we keep
 * only shifts that haven't ended yet, earliest first. The client refetches the
 * same shape on realtime changes and groups via lib/driver-planning.ts.
 */
export async function getMyShifts(): Promise<DriverShift[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('driver_shifts')
    .select('*')
    .gte('ends_at', new Date().toISOString())
    .order('starts_at');
  return (data ?? []) as DriverShift[];
}

/**
 * The current driver's support thread with the gérant for the "Support" screen,
 * oldest message first. RLS (support_driver_read, 0018) scopes it to this
 * driver's own thread; the client refetches/subscribes for live replies.
 */
export async function getMySupportMessages(): Promise<SupportMessage[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('support_messages').select('*').order('created_at');
  return (data ?? []) as SupportMessage[];
}

/** The current user's profile IFF they are staff (gérant), else null. Gate for
 *  the /admin section, mirroring getMyDriver() for the driver section. */
export async function getMyStaff(): Promise<Profile | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  return data && (data as Profile & { is_staff?: boolean }).is_staff ? (data as Profile) : null;
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
export async function getDriverBoard(branchId?: string | null): Promise<DriverOrder[]> {
  const supabase = await createServerSupabase();
  let q = supabase
    .from('orders')
    .select('*, order_tracking(*)')
    .in('status', DRIVER_POOL_STATUSES);
  // Multi-agences (0033): a driver only sees their own branch's orders.
  if (branchId) q = q.eq('branch_id', branchId);
  const { data } = await q.order('placed_at', { ascending: false });
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

export interface AdminOverviewData {
  /** Today's orders (placed_at >= local midnight), newest first. */
  orders: Order[];
  /** All drivers (for online/total counts, names, ratings). */
  drivers: Driver[];
  /** Every review's rating (for the average + count KPI). */
  ratings: number[];
  /** Driver GPS rows with coords, for the live map. */
  tracking: Pick<OrderTracking, 'order_id' | 'driver_id' | 'lat' | 'lng' | 'updated_at'>[];
}

/**
 * One-shot snapshot for the admin Vue d'ensemble first paint. Staff RLS (0014)
 * lets the gérant read every customer/driver row. The client container refetches
 * the same shapes on realtime changes and recomputes via lib/admin-overview.ts.
 */
export async function getAdminOverviewData(): Promise<AdminOverviewData> {
  const supabase = await createServerSupabase();
  const since = startOfTodayISO();
  const [ordersRes, driversRes, reviewsRes, trackingRes] = await Promise.all([
    supabase.from('orders').select('*').gte('placed_at', since).order('placed_at', { ascending: false }),
    supabase.from('drivers').select('*'),
    supabase.from('reviews').select('rating'),
    supabase
      .from('order_tracking')
      .select('order_id, driver_id, lat, lng, updated_at')
      .not('driver_id', 'is', null)
      .not('lat', 'is', null),
  ]);
  return {
    orders: ordersRes.data ?? [],
    drivers: driversRes.data ?? [],
    ratings: (reviewsRes.data ?? []).map((r) => (r as { rating: number }).rating),
    tracking: trackingRes.data ?? [],
  };
}

export interface AdminOrdersData {
  rows: AdminOrderRow[];
  /** All drivers, for the assignment dropdown (name-sorted). */
  drivers: Driver[];
}

/**
 * Snapshot for the admin Commandes first paint: the 200 most recent orders with
 * their items, tracking, customer and driver names, plus the driver roster for
 * reassignment. Staff RLS (0014) exposes every customer/driver row. The client
 * container refetches the same raw shapes and rebuilds via lib/admin-orders.ts.
 */
export async function getAdminOrdersData(): Promise<AdminOrdersData> {
  const supabase = await createServerSupabase();
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .order('placed_at', { ascending: false })
    .limit(200);
  const list = (orders ?? []) as Order[];
  const ids = list.map((o) => o.id);

  const [itemsRes, trackingRes, driversRes, profilesRes] = await Promise.all([
    ids.length
      ? supabase.from('order_items').select('*').in('order_id', ids)
      : Promise.resolve({ data: [] as OrderItem[] }),
    ids.length
      ? supabase.from('order_tracking').select('*').in('order_id', ids)
      : Promise.resolve({ data: [] as OrderTracking[] }),
    supabase.from('drivers').select('*').order('name'),
    supabase.from('profiles').select('id, full_name'),
  ]);

  const rows = buildAdminOrderRows(
    list,
    (itemsRes.data ?? []) as OrderItem[],
    (trackingRes.data ?? []) as OrderTracking[],
    (driversRes.data ?? []) as Driver[],
    (profilesRes.data ?? []) as { id: string; full_name: string | null }[],
  );
  return { rows, drivers: (driversRes.data ?? []) as Driver[] };
}

export interface AdminDriversData {
  rows: DriverRow[];
}

/**
 * Snapshot for the admin Livreurs screen: the full driver roster with each
 * driver's deliveries completed today and the earnings from them. Staff RLS
 * (0014) exposes every driver/order/tracking row; the per-driver aggregate is
 * built by lib/admin-drivers.ts so the client realtime refetch matches. "Today"
 * uses the same UTC boundary as the rest of the dashboard.
 */
export async function getAdminDriversData(): Promise<AdminDriversData> {
  const supabase = await createServerSupabase();
  const since = startOfTodayISO();
  const [driversRes, ordersRes, trackingRes, activeRes] = await Promise.all([
    supabase.from('drivers').select('*').order('name'),
    supabase
      .from('orders')
      .select('id, status, delivery_fee_dh')
      .eq('status', 'delivered')
      .gte('placed_at', since),
    supabase.from('order_tracking').select('order_id, driver_id').not('driver_id', 'is', null),
    supabase.from('orders').select('id, code, status').in('status', ['ready', 'en_route']),
  ]);
  const rows = buildDriverRows(
    (driversRes.data ?? []) as Driver[],
    (ordersRes.data ?? []) as { id: string; status: string; delivery_fee_dh: number }[],
    (trackingRes.data ?? []) as { order_id: string; driver_id: string | null }[],
    (activeRes.data ?? []) as { id: string; code: string; status: string }[],
  );
  return { rows };
}

export interface AdminReviewsData {
  rows: ReviewRow[];
}

/**
 * Snapshot for the admin Avis clients screen: every review joined to its
 * customer, order code and delivering driver, newest first. Staff RLS (0014)
 * exposes every review/profile/order/tracking/driver row; the join is built by
 * lib/admin-reviews.ts so the client realtime refetch matches.
 */
export async function getAdminReviewsData(): Promise<AdminReviewsData> {
  const supabase = await createServerSupabase();
  const { data: reviews } = await supabase
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false });
  const list = (reviews ?? []) as Review[];

  const [profilesRes, ordersRes, trackingRes, driversRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name'),
    supabase.from('orders').select('id, code'),
    supabase.from('order_tracking').select('order_id, driver_id').not('driver_id', 'is', null),
    supabase.from('drivers').select('id, name'),
  ]);

  const rows = buildReviewRows(
    list,
    (profilesRes.data ?? []) as { id: string; full_name: string | null }[],
    (ordersRes.data ?? []) as { id: string; code: string }[],
    (trackingRes.data ?? []) as { order_id: string; driver_id: string | null }[],
    (driversRes.data ?? []) as { id: string; name: string }[],
  );
  return { rows };
}

export interface AdminProductsData {
  products: Product[];
  categories: Category[];
}

/**
 * Snapshot for the admin Produits screen: the FULL catalogue (active and inactive
 * — products is public-read with no active filter) plus the categories for
 * grouping. The client container refetches the same shapes on realtime changes and
 * regroups via lib/admin-products.ts; edits go through the admin_update_product
 * RPC (0016).
 */
export async function getAdminProductsData(): Promise<AdminProductsData> {
  const supabase = await createServerSupabase();
  const [productsRes, categoriesRes] = await Promise.all([
    supabase.from('products').select('*').order('name'),
    supabase.from('categories').select('*').order('sort'),
  ]);
  return {
    products: (productsRes.data ?? []) as Product[],
    categories: (categoriesRes.data ?? []) as Category[],
  };
}

export interface AdminZonesData {
  zones: Zone[];
}

/**
 * Snapshot for the admin Zones de livraison screen: every delivery zone. zones is
 * public-read (0002); CRUD goes through the admin_upsert_zone / admin_delete_zone
 * RPCs (0017). The client refetches the same shape on realtime changes and sorts
 * via lib/admin-zones.ts.
 */
export async function getAdminZonesData(): Promise<AdminZonesData> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('delivery_zones').select('*').order('fee_dh');
  return { zones: (data ?? []) as Zone[] };
}

export interface AdminIncidentsData {
  rows: IncidentRow[];
  /** Driver roster for the create form. */
  drivers: { id: string; name: string }[];
  /** Recent orders for the create form. */
  orders: { id: string; code: string }[];
}

/**
 * Snapshot for the admin Incidents screen: every incident joined to its
 * driver/order, plus the driver roster and recent orders for the create form.
 * incidents is staff-only (0018); the client refetches the same shapes on realtime
 * changes and reorders via lib/admin-incidents.ts.
 */
export async function getAdminIncidentsData(): Promise<AdminIncidentsData> {
  const supabase = await createServerSupabase();
  const [incidentsRes, driversRes, ordersRes] = await Promise.all([
    supabase.from('incidents').select('*').order('created_at', { ascending: false }),
    supabase.from('drivers').select('id, name').order('name'),
    supabase.from('orders').select('id, code').order('placed_at', { ascending: false }).limit(100),
  ]);
  const rows = buildIncidentRows(
    (incidentsRes.data ?? []) as Incident[],
    (driversRes.data ?? []) as { id: string; name: string }[],
    (ordersRes.data ?? []) as { id: string; code: string }[],
  );
  return {
    rows,
    drivers: (driversRes.data ?? []) as { id: string; name: string }[],
    orders: (ordersRes.data ?? []) as { id: string; code: string }[],
  };
}

export interface AdminPlanningData {
  week: ShiftWeek;
  drivers: { id: string; name: string }[];
  /** ISO date (YYYY-MM-DD) of the Monday this week starts on. */
  weekStart: string;
}

/**
 * Snapshot for the admin Planning screen: the shift roster for the week containing
 * `ref`, laid out as a driver × day grid, plus the driver roster for the add form.
 * driver_shifts is staff-only (0018); the client refetches and rebuilds via
 * lib/admin-planning.ts.
 */
export async function getAdminPlanningData(ref: Date = new Date()): Promise<AdminPlanningData> {
  const supabase = await createServerSupabase();
  const monday = mondayOf(ref);
  const nextMonday = new Date(monday.getTime() + 7 * 24 * 3600 * 1000);
  const [shiftsRes, driversRes] = await Promise.all([
    supabase
      .from('driver_shifts')
      .select('*')
      .gte('starts_at', monday.toISOString())
      .lt('starts_at', nextMonday.toISOString())
      .order('starts_at'),
    supabase.from('drivers').select('id, name').order('name'),
  ]);
  const drivers = (driversRes.data ?? []) as { id: string; name: string }[];
  const week = buildShiftWeek((shiftsRes.data ?? []) as DriverShift[], drivers, monday);
  return { week, drivers, weekStart: isoDate(monday) };
}

export interface AdminSupportData {
  threads: SupportThread[];
}

/**
 * Snapshot for the admin Support screen: one thread per driver in the roster
 * (including drivers with no messages), each carrying presence/avatar/matricule,
 * its messages oldest-first and the staff-unread count. support_messages is
 * staff-readable across all threads (0018); the client refetches the same shapes
 * on realtime changes and rebuilds via lib/admin-support.ts.
 */
export async function getAdminSupportData(): Promise<AdminSupportData> {
  const supabase = await createServerSupabase();
  const [messagesRes, driversRes] = await Promise.all([
    supabase.from('support_messages').select('*').order('created_at'),
    supabase.from('drivers').select('id, name, avatar_url, is_online').order('name'),
  ]);
  const threads = buildSupportThreads(
    (messagesRes.data ?? []) as SupportMessage[],
    (driversRes.data ?? []) as RawSupportDriver[],
  );
  return { threads };
}

/**
 * Snapshot for the redesigned Cuisine board: the three kanban columns (pending /
 * preparing / ready), the per-station load model and the late-order codes — all
 * derived by lib/kitchen.ts from the active+ready orders. The client refetches
 * the same shape (via lib/kitchen-data.ts) on realtime changes.
 */
export async function getKitchenBoard(): Promise<KitchenBoard> {
  const supabase = await createServerSupabase();
  return loadKitchenBoard(supabase);
}
