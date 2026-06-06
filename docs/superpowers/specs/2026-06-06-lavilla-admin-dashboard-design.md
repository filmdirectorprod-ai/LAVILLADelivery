# La Villa — Admin / Gérant back-office — Design

Date: 2026-06-06
Branch: feat/lavilla-customer-app
Status: Approved (design) — pending implementation plan

## Goal

Build the **admin (gérant) back-office** for La Villa: a full-width desktop
dashboard, served from the same Next.js app, that reads across **all**
customers and drivers and stays **synchronized in real time** with both the
customer app `(app)` and the driver app `/driver`.

A manager signs in with a dedicated staff account and manages the whole
operation from one place: live overview, orders, kitchen, products, drivers,
reviews, delivery zones, driver support, incidents, and planning.

## Non-goals (YAGNI)

- No multi-tenant / multi-restaurant. Single venue (La Villa, Fès).
- No granular roles (no separate "kitchen-only" vs "manager" logins yet) — one
  `is_staff` flag. Sub-roles can come later.
- No analytics warehouse / historical BI beyond what we can compute live from
  current tables.
- No payment/refund execution from the admin (out of scope, financial action).

## Users & access

- **Staff account**: the dedicated email **`admin@lavilla.ma`**, marked
  `profiles.is_staff = true` in migration 0014. (The account must be created via
  normal sign-up first so a `profiles` row exists; the migration flips the flag.)
- Customers and drivers must **never** reach `/admin` — gated by layout + RLS.

## Architecture

### Routing & layout
- New route group **`app/admin`** (URL prefix `/admin`).
  - `app/admin/layout.tsx` — server component. Calls `getMyStaff()`; if the
    user is not staff, render a friendly dead-end (`AdminGate`), mirroring
    `DriverGate`. Otherwise render `AdminChrome`.
  - `AdminChrome` (client) — desktop shell: fixed left **sidebar** (brand-d
    background, the 10 nav items + active highlight + manager identity footer)
    and a scrollable content area.
- **Escape the phone frame**: root `app/layout.tsx` wraps everything in
  `.lv-frame`. Admin must render full-width. Approach: `AdminChrome` sets a
  marker class and `globals.css` uses `.lv-frame:has(.lv-admin-root)` to drop
  the max-width / centering for admin only. (`:has()` is broadly supported.)
- Reuse existing design tokens (`--brand`, `--brand-d`, `--gold`, `--line`,
  cards radius 18, soft shadows) in a desktop scale.

### Pages (under `app/admin/`)
1. `/admin` — **Vue d'ensemble**
2. `/admin/orders` — **Commandes**
3. `/admin/kitchen` — **Cuisine**
4. `/admin/products` — **Produits**
5. `/admin/drivers` — **Livreurs**
6. `/admin/reviews` — **Avis clients**
7. `/admin/zones` — **Zones de livraison**
8. `/admin/support` — **Support livreurs**
9. `/admin/incidents` — **Incidents**
10. `/admin/planning` — **Planning**

### Data access — RLS "staff" (approved approach A)
- Migration **0014** adds:
  - `profiles.is_staff boolean not null default false` and marks the staff email.
  - `lv_is_staff()` — `SECURITY DEFINER` helper returning whether the current
    auth user is staff. SECURITY DEFINER avoids the RLS recursion fixed in 0009.
  - **Staff RLS policies** (`select` for all; `update`/`insert`/`delete` where a
    section needs writes) on: `orders`, `order_items`, `order_tracking`,
    `drivers`, `reviews`, `profiles`, `delivery_zones`, `products`,
    `categories`, `chat_messages`, plus the new tables below.
- All admin reads go through new server queries in `lib/queries.ts` using the
  request-scoped (RLS) client — no service-role in the browser.
- Admin writes (status change, product toggle, zone CRUD, incident resolve,
  driver assign) via RPCs (`SECURITY DEFINER`, staff-guarded) added in 0014,
  consistent with the driver RPC pattern (0008).

### New tables / columns (migration 0014)
- `drivers.is_online boolean default false`, `drivers.last_seen timestamptz` —
  powers "Livreurs en ligne X/Y". Driver app sets `is_online` on login/logout
  and refreshes `last_seen` with each `driver_update_position`.
- `incidents` — `id, order_id (nullable), driver_id (nullable), kind, severity,
  status ('open'|'resolved'), title, detail, created_by, created_at,
  resolved_at`.
- `support_messages` — admin↔driver channel, distinct from order chat:
  `id, driver_id, sender ('driver'|'admin'), body, read_by_admin, read_by_driver,
  created_at`.
- `driver_shifts` — planning: `id, driver_id, starts_at, ends_at, note,
  created_at`.

### Real-time
- Same pattern as the driver screens: browser `postgres_changes` subscriptions.
  - Overview: `orders`, `order_tracking`, `drivers`, `reviews`, `incidents`.
  - Orders/Kitchen: `orders`, `order_tracking`.
  - Drivers: `drivers`. Support: `support_messages`. Incidents: `incidents`.
- Server components render the first paint; client subscriptions refetch on
  change (the `refetch()` callback pattern already used in
  `DriverRequestsScreen`).

## Section detail

### Vue d'ensemble (`/admin`)
- **KPI cards** (live): Commandes du jour (+ en cours), Chiffre d'affaires du
  jour, Livreurs en ligne (online / total), Note clients (avg `reviews.rating`
  + count), Incidents ouverts.
- **Activité des commandes — aujourd'hui**: bar chart of orders per hour with
  peak marker (derived from `orders.placed_at`).
- **Suivi des livreurs · en direct**: map (reuse `GoogleDeliveryMap` infra) with
  each online driver's live position from `order_tracking.lat/lng`.
- **Commandes en cours**: table (Commande, Client, Articles, Total, Statut,
  Livreur).

### Commandes (`/admin/orders`)
- Full list, filter by status, search by code. Row → detail (items, tracking,
  customer, driver). Manual status change via staff RPC; manual driver
  (re)assignment.

### Cuisine (`/admin/kitchen`)
- Kanban/list of `preparing` orders with their items to prepare; mark ready
  (advances to `en_route` pool) via RPC.

### Produits (`/admin/products`)
- Catalogue table: toggle `active`, edit `price_dh`, mark signature. Writes via
  staff RPC.

### Livreurs (`/admin/drivers`)
- Driver cards: online status, rating, vehicle, today's deliveries/earnings
  (reuse `driver_deliveries`-style aggregate, staff-scoped).

### Avis clients (`/admin/reviews`)
- All reviews, newest first, filter by rating; shows customer, order, driver.

### Zones de livraison (`/admin/zones`)
- CRUD on `delivery_zones` (name, fee_dh, eta_min, eta_max) via staff RPC.

### Support livreurs (`/admin/support`)
- Per-driver threads on `support_messages`; unread badge in sidebar; admin
  replies. Real-time.

### Incidents (`/admin/incidents`)
- List open/resolved; create from an order/driver; resolve (sets status +
  `resolved_at`). Feeds the "Incidents ouverts" KPI.

### Planning (`/admin/planning`)
- Weekly grid of `driver_shifts`; add/edit/remove a shift per driver.

## Build order
1. **Infra**: migration 0014 (is_staff, lv_is_staff, staff RLS, online cols,
   new tables, staff RPCs) + `app/admin` route group + `AdminChrome` /
   `AdminGate` + frame escape + `getMyStaff()`.
2. **Vue d'ensemble** (the headline, fully live).
3. **Commandes** + **Cuisine**.
4. **Produits** + **Livreurs** + **Zones** + **Avis**.
5. **Support** + **Incidents** + **Planning**.

## Risks / notes
- Migration 0014 is large and **run manually by the user** in the Supabase SQL
  Editor (project convention; idempotent, numbered after 0013).
- RLS staff policies must be reviewed carefully to avoid leaking customer PII
  beyond staff. Use `lv_is_staff()` everywhere; never widen anon/auth access.
- Driver app needs a small change to set `is_online`/`last_seen`.
- `GoogleDeliveryMap` reuse must handle multiple driver markers (currently one).
```
