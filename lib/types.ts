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
  created_at: string;
}

export interface Zone {
  id: string;
  name: string;
  fee_dh: number;
  eta_min: number;
  eta_max: number;
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
  zone_id: string | null;
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
