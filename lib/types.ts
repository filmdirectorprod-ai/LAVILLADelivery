// Shared domain types for La Villa, mirroring the Supabase schema
// (supabase/migrations/0001_core_schema.sql). Column names are snake_case to
// match Postgres / PostgREST rows returned by supabase-js.

export type Universe = 'patisserie' | 'restaurant';
export type CategoryUniverse = Universe | 'all';

export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'en_route'
  | 'delivered'
  | 'cancelled';

export type OrderMode = 'livraison' | 'retrait';

export type LoyaltyTier =
  | 'Gourmand'
  | 'Connaisseur'
  | 'Gourmet'
  | 'Cercle Villa';

export interface Category {
  id: string;
  key: string;
  label: string;
  universe: CategoryUniverse;
  sort: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  universe: Universe;
  category: string;
  price_dh: number;
  description: string;
  rating: number;
  reviews_count: number;
  image_url: string | null;
  photo_label: string | null;
  is_customizable: boolean;
  diet_badges: string[];
  tags: string[];
  is_signature: boolean;
  active: boolean;
  /** In stock vs out of stock (0029). Distinct from `active` (listed for sale). */
  in_stock: boolean;
  created_at: string;
}

export interface Zone {
  id: string;
  name: string;
  fee_dh: number;
  eta_min: number;
  eta_max: number;
  /** Neighbourhood boundary as a ring of [lng, lat] points (0025), or null. */
  polygon: [number, number][] | null;
  /** Owning agency (0033) — the branch that fulfils this zone's deliveries. */
  branch_id?: string | null;
}

/** A promo code (0037). `branch_id` null = valid at every agency. */
export interface Promotion {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  min_order_dh: number;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
  max_uses_per_user: number | null;
  branch_id: string | null;
  active: boolean;
  created_at: string;
}

/** A La Villa agency / branch (0033). */
export interface Branch {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  phone: string | null;
  plus_code: string | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
}

export interface Driver {
  id: string;
  name: string;
  avatar_url: string | null;
  vehicle: string | null;
  rating: number;
  phone: string | null;
  /** Linked auth user (0008) — null for seeded demo drivers. */
  user_id: string | null;
  /** Presence (0014) — set by the driver app on login/logout. */
  is_online?: boolean;
  last_seen?: string | null;
  /** Owning agency (0033). */
  branch_id?: string | null;
}

export interface Reward {
  id: string;
  title: string;
  cost_pts: number;
  image_url: string | null;
  active: boolean;
}

/** Per-user app preferences, persisted as the `profiles.settings` jsonb. */
export interface ProfileSettings {
  notify_orders?: boolean;
  notify_promos?: boolean;
  locale?: string;
}

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  loyalty_points: number;
  loyalty_tier: LoyaltyTier;
  settings: ProfileSettings;
  created_at: string;
  /** Staff member's agency (0033) — null = super-admin. */
  branch_id?: string | null;
  /** Internal CRM note (0039). */
  crm_note?: string | null;
  /** Shareable referral code (0048). */
  referral_code?: string | null;
  /** Who referred this customer (0048). */
  referred_by?: string | null;
}

/** A saved delivery address (owner-scoped). */
export interface Address {
  id: string;
  user_id: string;
  label: string;
  recipient: string | null;
  phone: string | null;
  line1: string;
  city: string;
  zone_id: string | null;
  details: string | null;
  /** Geocoded coordinates from Places autocomplete (0025), or null. */
  lat: number | null;
  lng: number | null;
  is_default: boolean;
  created_at: string;
}

export interface LoyaltyLedgerEntry {
  id: string;
  user_id: string;
  delta_pts: number;
  reason: string;
  order_id: string | null;
  created_at: string;
}

export interface Cart {
  id: string;
  user_id: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  qty: number;
  customization: Record<string, unknown>;
}

export interface Order {
  id: string;
  code: string;
  user_id: string;
  status: OrderStatus;
  mode: OrderMode;
  address: string | null;
  /** Contact phone captured at checkout (0031). */
  phone?: string | null;
  zone_id: string | null;
  /** Fulfilling agency (0033). */
  branch_id?: string | null;
  subtotal_dh: number;
  delivery_fee_dh: number;
  discount_dh: number;
  total_dh: number;
  points_earned: number;
  points_redeemed: number;
  placed_at: string;
  eta_at: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  name_snapshot: string;
  price_snapshot: number;
  qty: number;
  customization: Record<string, unknown>;
}

export interface OrderTracking {
  order_id: string;
  stage: number;
  progress: number;
  eta_at: string | null;
  driver_id: string | null;
  /** Live driver GPS (0008) — null until a real driver streams position. */
  lat: number | null;
  lng: number | null;
  /** True once a real driver has claimed the order (auto-mover lets go). */
  manual: boolean;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  order_id: string;
  sender: 'customer' | 'driver';
  body: string;
  created_at: string;
}

export interface Review {
  id: string;
  order_id: string;
  user_id: string;
  rating: number;
  tags: string[];
  comment: string;
  photo_url: string | null;
  points_awarded: number;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  order_id: string | null;
  read: boolean;
  created_at: string;
}

export type IncidentSeverity = 'basse' | 'moyenne' | 'haute';
export type IncidentStatus = 'open' | 'resolved';

/** An operational issue raised against an order and/or driver (admin Incidents). */
export interface Incident {
  id: string;
  order_id: string | null;
  driver_id: string | null;
  kind: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  detail: string;
  created_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

/** One message in a per-driver support thread (admin Support). */
export interface SupportMessage {
  id: string;
  driver_id: string;
  sender: 'driver' | 'staff';
  body: string;
  read_by_staff: boolean;
  created_at: string;
}

/** A scheduled delivery shift for one driver (admin Planning). */
export interface DriverShift {
  id: string;
  driver_id: string;
  starts_at: string;
  ends_at: string;
  note: string;
  created_at: string;
}
