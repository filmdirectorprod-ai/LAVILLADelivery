-- La Villa — core schema
-- All money is numeric(10,2) DH. UUID PKs. French-domain catalog + orders + loyalty.

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ── Catalog ──────────────────────────────────────────────────────────────────
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  universe text not null check (universe in ('patisserie','restaurant','all')),
  sort int not null default 0
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  universe text not null check (universe in ('patisserie','restaurant')),
  category text not null,
  price_dh numeric(10,2) not null,
  description text not null default '',
  rating numeric(2,1) not null default 5.0,
  reviews_count int not null default 0,
  image_url text,
  photo_label text,
  is_customizable boolean not null default false,
  diet_badges text[] not null default '{}',
  tags text[] not null default '{}',
  is_signature boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fee_dh numeric(10,2) not null,
  eta_min int not null,
  eta_max int not null
);

create table if not exists drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar_url text,
  vehicle text,
  rating numeric(2,1) not null default 5.0,
  phone text
);

create table if not exists rewards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  cost_pts int not null,
  image_url text,
  active boolean not null default true
);

-- ── Identity / loyalty ───────────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_url text,
  loyalty_points int not null default 0,
  loyalty_tier text not null default 'Gourmand',
  created_at timestamptz not null default now()
);

create table if not exists loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta_pts int not null,
  reason text not null,
  order_id uuid,
  created_at timestamptz not null default now()
);

-- ── Cart (server-persisted mirror of the client cart) ────────────────────────
create table if not exists carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table if not exists cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id) on delete cascade,
  product_id uuid not null references products(id),
  qty int not null check (qty > 0),
  customization jsonb not null default '{}'
);

-- ── Orders ───────────────────────────────────────────────────────────────────
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','preparing','en_route','delivered','cancelled')),
  mode text not null check (mode in ('livraison','retrait')),
  address text,
  zone_id uuid references delivery_zones(id),
  subtotal_dh numeric(10,2) not null,
  delivery_fee_dh numeric(10,2) not null default 0,
  discount_dh numeric(10,2) not null default 0,
  total_dh numeric(10,2) not null,
  points_earned int not null default 0,
  points_redeemed int not null default 0,
  placed_at timestamptz not null default now(),
  eta_at timestamptz
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id),
  name_snapshot text not null,
  price_snapshot numeric(10,2) not null,
  qty int not null check (qty > 0),
  customization jsonb not null default '{}'
);

create table if not exists order_tracking (
  order_id uuid primary key references orders(id) on delete cascade,
  stage int not null default 0 check (stage between 0 and 4),
  progress numeric(5,4) not null default 0,
  eta_at timestamptz,
  driver_id uuid references drivers(id),
  updated_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  sender text not null check (sender in ('customer','driver')),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  tags text[] not null default '{}',
  comment text not null default '',
  photo_url text,
  points_awarded int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  order_id uuid references orders(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists idx_orders_user on orders(user_id, placed_at desc);
create index if not exists idx_order_items_order on order_items(order_id);
create index if not exists idx_chat_order on chat_messages(order_id, created_at);
create index if not exists idx_notifications_user on notifications(user_id, created_at desc);
create index if not exists idx_loyalty_user on loyalty_ledger(user_id, created_at desc);
create index if not exists idx_products_universe on products(universe, category);
