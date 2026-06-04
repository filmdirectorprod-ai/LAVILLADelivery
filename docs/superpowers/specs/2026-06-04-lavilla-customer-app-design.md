# La Villa — Customer App Design Spec

**Date:** 2026-06-04
**Status:** Approved (design phase)
**Source:** Claude Design handoff bundle (`/Users/pro/Downloads/lavilla_extract/lavilla/`)

## 1. Overview

La Villa is a French-language food-ordering app for a Fès-based patisserie + restaurant
("La Villa"). This spec covers the **customer-facing app only** — rebuilt from the HTML/CSS/JS
prototype as a real, production-shaped web application with real authentication, real backend
persistence, and live order tracking.

Out of scope this phase: the Driver surface, the Admin surface, real payment processing, and
the in-app driver voice call (kept as a visual mock).

### Goals

- Pixel-faithful recreation of the prototype's customer screens (match visual output, not the
  prototype's internal React/Babel structure).
- Real Supabase Auth replacing the prototype's mock phone-OTP flow.
- Real backend for catalog, cart→order lifecycle, and loyalty.
- Live order tracking via Supabase Realtime driven by a simulated server-side "mover".

### Non-goals

- No driver/admin apps, no kitchen/dispatch tooling.
- No real card capture or payment settlement (payment UI is visual only; orders are created
  as if paid).
- No SMS/OTP infrastructure.

## 2. Tech Stack

| Concern        | Choice                                            |
|----------------|---------------------------------------------------|
| Framework      | Next.js (App Router) + TypeScript                 |
| Styling        | Tailwind CSS (design tokens as CSS variables)     |
| Backend / DB   | Supabase (Postgres + Auth + Realtime)             |
| Server logic   | Next.js Route Handlers + Supabase Edge Functions  |
| Scheduling     | pg_cron (advances the simulated mover)            |
| Auth           | Supabase Auth (email/password + OAuth Google)     |
| Hosting target | Vercel-compatible (Next.js) + Supabase project    |

### Location

Project lives directly in `/Users/pro` (user-confirmed twice). Git is initialized here. To
protect unrelated home-directory files, a `.gitignore` is created **before** the first commit
and only specific project files are ever staged — never `git add -A` / `git add .`.

## 3. Design Tokens

Ported verbatim from the prototype, exposed as CSS variables and mapped into Tailwind theme.

| Token        | Value      | Use                                  |
|--------------|------------|--------------------------------------|
| `--brand`    | `#137C8B`  | Primary teal                         |
| `--brand-d`  | `#0f606b`  | Brand darkened ~0.22 (gradients)     |
| `--gold`     | `#A89723`  | Accent / loyalty                     |
| `--ink`      | `#1A1D1E`  | Primary text                         |
| `--muted`    | `#6B7173`  | Secondary text                       |
| `--line`     | `#ECEEEF`  | Hairline borders                     |
| `--soft`     | `#F6F7F7`  | Soft surfaces / fills                |

- **Fonts:** Poppins (UI), Playfair Display (display/headings). Loaded via `next/font`.
- **Body background:** radial-gradient `at 50% -10%, #f1f5f4 0%, #e6ebea 55%, #dfe5e4 100%`.
- **Locale:** French (`fr`). **Currency:** Moroccan Dirham, formatted `00,00 DH`
  (`n.toFixed(2).replace('.',',') + ' DH'`), free delivery threshold 200 DH.
- **Animations:** `lvPulse` (tracking marker), `lvBannerIn`, `lvBlink` (live dot), `lvRing`.

## 4. Screens & Routes

Mobile-first responsive. Persistent bottom `TabBar`: Accueil / Recherche / Panier / Commandes / Profil.

| # | Screen        | Route                      | Notes                                            |
|---|---------------|----------------------------|--------------------------------------------------|
| 1 | Onboarding    | `/welcome`                 | 3 Playfair slides; shown to first-time users     |
| 2 | Auth          | `/auth`                    | Supabase email/password + Google OAuth           |
| 3 | Home          | `/` (Accueil)              | Location, search, mode (livraison/retrait), universe filter (all/patisserie/restaurant), categories, hero, favoris, Ramadan promo, discover |
| 4 | Catalog       | `/shop` (Recherche)        | Search, category chips, sort (populaire/prix/note), grid, empty state |
| 5 | Product       | `/shop/[slug]`             | Photo header, tags, saveur desc; customizable (size/flavor/message/date) OR diet badges; stepper; sticky add-to-cart |
| 6 | Cart          | `/cart` (Panier)           | Items, promo code (15%), summary, zone delivery fee, free ≥200 DH |
| 7 | Checkout      | `/checkout`                | Address/pickup, time slots, payment (visual mock), pay-with-points, place order |
| 8 | Tracking      | `/orders/[id]/track`       | SVG map + Realtime mover marker, ETA, driver card, 5-step timeline, proof, recap, help |
| 9 | Driver Chat   | `/orders/[id]/chat`        | Message thread + quick replies + input (persisted) |
|10 | Driver Call   | `/orders/[id]/call`        | Visual mock only                                 |
|11 | Orders        | `/orders` (Commandes)      | en_cours / terminee tabs; Suivre / Recommander   |
|12 | Profile       | `/profile` (Profil)        | Gradient header, avatar, loyalty card, menu, logout |
|13 | Ramadan       | `/ramadan`                 | Hero, ftour/shour/day slots, Ftour selection grid |
|14 | Loyalty       | `/loyalty`                 | Points hero, tier ladder, redeem paliers, rewards, review CTA, benefits, history |
|15 | Review        | `/orders/[id]/review`      | 5-star, tags, comment, photo, submit (+50 pts), success |
|16 | Notifications | `/notifications`           | List read/unread; order notifs → tracking        |

## 5. Data Model (Supabase / Postgres)

All tables under RLS. `profiles.id` = `auth.users.id`.

- **profiles** — `id`, `full_name`, `phone`, `avatar_url`, `loyalty_points int`, `loyalty_tier`,
  `created_at`. RLS: owner read/write.
- **products** — `id`, `slug`, `name`, `universe` (patisserie/restaurant), `category`,
  `price_dh numeric`, `description`, `rating`, `image_url`, `is_customizable bool`,
  `diet_badges text[]`, `tags text[]`, `is_signature bool`, `active bool`. RLS: public read.
- **categories** — `id`, `key`, `label`, `universe`, `sort`. RLS: public read.
- **delivery_zones** — `id`, `name`, `fee_dh`, `eta_min`, `eta_max`. RLS: public read.
- **carts** / **cart_items** — per-user working cart; `cart_items` holds `product_id`, `qty`,
  and customization JSON. RLS: owner only. (Cart may also be client-state-first with server
  sync at checkout — see §6.)
- **orders** — `id`, `code` (CMD-XXXX), `user_id`, `status` (pending/preparing/en_route/
  delivered/cancelled), `mode` (livraison/retrait), `address`, `zone_id`, `subtotal_dh`,
  `delivery_fee_dh`, `discount_dh`, `total_dh`, `points_earned`, `points_redeemed`,
  `placed_at`, `eta_at`. RLS: owner read; insert via server.
- **order_items** — `order_id`, `product_id`, `name_snapshot`, `price_snapshot`, `qty`,
  `customization jsonb`. RLS: owner read.
- **order_tracking** — `order_id` (1:1 with active order), `stage` (0–4), `progress numeric`
  (0–1 along route), `eta_at`, `driver_id`, `updated_at`. **Realtime-enabled.** RLS: owner read.
- **drivers** — `id`, `name`, `avatar_url`, `vehicle`, `rating`, `phone`. RLS: public read of
  assigned driver.
- **chat_messages** — `order_id`, `sender` (customer/driver), `body`, `created_at`. RLS: owner.
- **reviews** — `id`, `order_id`, `user_id`, `rating`, `tags text[]`, `comment`, `photo_url`,
  `points_awarded`, `created_at`. RLS: owner write.
- **rewards** — catalog of redeemable rewards (`id`, `title`, `cost_pts`, `image_url`). Public read.
- **loyalty_ledger** — `user_id`, `delta_pts`, `reason`, `order_id?`, `created_at`. RLS: owner read.
- **notifications** — `user_id`, `kind`, `title`, `body`, `order_id?`, `read bool`, `created_at`.
  RLS: owner. Optionally Realtime-enabled.

Seed data ported from `data.jsx` (19 products, categories, zones, rewards, loyalty tiers/paliers)
and `store.jsx` (route polyline `LV_ROUTE` for the tracking map).

## 6. Key Flows & Server Logic

### Auth
Supabase Auth (email/password + Google OAuth). On first sign-in a `profiles` row is created
(trigger or server handler). Onboarding shown when profile is new. Replaces the prototype's
mock phone-OTP screen.

### Cart → Order
Cart lives in client state (Zustand or React context) for snappy UX, persisted to
`carts`/`cart_items` for the signed-in user. **Place Order** is a server action / Route Handler
that, in one transaction:
1. Recomputes subtotal, applies promo (15%), resolves zone delivery fee (free ≥200 DH),
   subtracts redeemed points, computes total — **server is source of truth for money**.
2. Inserts `orders` + `order_items` (with price snapshots).
3. Awards loyalty points (1 DH ≈ 1 pt) and writes `loyalty_ledger`; updates `profiles.points`/`tier`.
4. Creates `order_tracking` row (stage 0, progress 0), assigns a driver.
5. Clears the cart.

### Live Tracking (Realtime + simulated mover)
- The client subscribes to `order_tracking` changes for the active order via Supabase Realtime.
- A **server-side simulated mover** advances `progress`/`stage`/`eta_at` on a schedule
  (pg_cron calling a SQL function, or an Edge Function), walking the `LV_ROUTE` polyline.
  The marker position is derived client-side from `progress` via `lvPosAt(progress)`.
- Timeline reflects the 5 `TRACK_STEPS`. When `stage` reaches delivered, tracking finalizes and
  the review CTA unlocks.

### Loyalty
Server-authoritative. Points earned on order placement; redeemed at checkout (paliers) or
exchanged for `rewards`; reviews award +50 pts. All deltas recorded in `loyalty_ledger`; tier
recomputed from cumulative points.

### Chat
`chat_messages` persisted per order; customer messages insert rows; driver replies are seeded /
simulated. Optionally Realtime for instant display.

## 7. Deliberate Deviations from Prototype (user-confirmed)

1. **Mock phone-OTP → real Supabase Auth** (email/password + Google OAuth).
2. **Payment methods are visual mocks** — no card capture or settlement; order is created as paid.
3. **Driver voice-call screen stays a visual mock** — no real telephony.

## 8. Out of Scope (this phase)

- Driver app, Admin app, kitchen/dispatch tooling (`driver.jsx`, `admin.jsx`).
- Real payment processing.
- Real telephony / SMS.
- Push notifications infrastructure (in-app notifications only).

## 9. Testing Strategy

- Unit: currency formatting (`formatDH`), money math (subtotal/discount/zone fee/free-threshold),
  loyalty point/tier computation.
- Integration: place-order transaction (DB state after order), RLS policies (cross-user access denied).
- E2E (happy path): sign in → browse → add to cart → checkout → track → review.
- Visual: spot-check key screens against prototype screenshots for token/layout fidelity.
