# La Villa Customer App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the customer-facing "La Villa" food-ordering app from the Claude Design handoff as a real Next.js + Supabase web app with real auth, server-authoritative orders/loyalty, and live Realtime order tracking.

**Architecture:** Next.js App Router (TypeScript) renders a mobile-first responsive PWA-shaped UI styled with Tailwind using design tokens ported from the prototype. Supabase provides Postgres (under RLS), Auth, and Realtime. Money/loyalty math is computed server-side in Route Handlers; live tracking is driven by a server-side "simulated mover" (pg_cron + SQL function) that advances an `order_tracking` row, which the client observes over Realtime.

**Tech Stack:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, Supabase (postgres-js / `@supabase/ssr`), Vitest + React Testing Library, Playwright (smoke E2E).

**Source of truth for visuals & seed data:** the prototype at `/Users/pro/Downloads/lavilla_extract/lavilla/project/` — especially `data.jsx` (catalog, categories, loyalty, rewards, track steps), `store.jsx` (route polyline, zones), `ui.jsx` (primitives), and the `screens-*.jsx` files (per-screen layout). Port values **verbatim** from these files; match visual output of the screens.

**Project root:** `/Users/pro` (git already initialized here with a deny-by-default `.gitignore`). When staging, **always add files by explicit path — never `git add -A`/`git add .`** — to protect unrelated home files. After scaffolding `public/`, add `!/public/` back to `.gitignore` but verify `git status` never shows the macOS home `Public/` folder.

---

## Reference: ported constants

These appear in multiple tasks — defined once here, used verbatim.

**`formatDH`** (from `data.jsx:5`):
```ts
export const formatDH = (n: number) => n.toFixed(2).replace('.', ',') + ' DH';
```

**Design tokens** (from prototype CSS + `app.jsx:231-243`; `--brand-d` = brand darkened by 0.22):
```
--brand:#137C8B  --brand-d:#0f606b  --gold:#A89723  --ink:#1A1D1E
--muted:#6B7173  --line:#ECEEEF     --soft:#F6F7F7
body bg: radial-gradient(1200px 700px at 50% -10%, #f1f5f4 0%, #e6ebea 55%, #dfe5e4 100%)
fonts: Poppins (UI / --ui-font), Playfair Display (display)
```

**Delivery route polyline** (from `store.jsx:9-34`) — normalized %-coords inside a 280px-tall map, with lat/lng; plus `lvPosAt(p)` interpolation. Copy the `LV_ROUTE` array and `lvPosAt` exactly. Totals: `LV_ROUTE_TOTAL_KM = 3.2`, `LV_ROUTE_TOTAL_MIN = 28`.

**Business rules:** promo code gives 15% off subtotal; delivery free when subtotal ≥ 200 DH else zone fee; 1 DH spent ≈ 1 loyalty point earned; review submission awards +50 pts; 5 tracking stages (`TRACK_STEPS`, `data.jsx:194`).

---

## File Structure

```
/Users/pro
├── app/
│   ├── layout.tsx               # root: fonts, tokens, <body> bg, AppShell
│   ├── globals.css              # Tailwind directives + CSS vars + keyframes
│   ├── (app)/                   # authed shell w/ TabBar
│   │   ├── layout.tsx           # TabBar + safe-area; redirects if no session
│   │   ├── page.tsx             # Home (Accueil)
│   │   ├── shop/page.tsx        # Catalog
│   │   ├── shop/[slug]/page.tsx # Product
│   │   ├── cart/page.tsx
│   │   ├── checkout/page.tsx
│   │   ├── orders/page.tsx
│   │   ├── orders/[id]/track/page.tsx
│   │   ├── orders/[id]/chat/page.tsx
│   │   ├── orders/[id]/call/page.tsx
│   │   ├── orders/[id]/review/page.tsx
│   │   ├── profile/page.tsx
│   │   ├── loyalty/page.tsx
│   │   ├── ramadan/page.tsx
│   │   └── notifications/page.tsx
│   ├── welcome/page.tsx         # Onboarding (no TabBar)
│   ├── auth/page.tsx            # Auth
│   ├── auth/callback/route.ts   # OAuth code exchange
│   └── api/
│       ├── orders/route.ts      # POST place order (server-authoritative)
│       └── reviews/route.ts     # POST review (+50 pts)
├── components/
│   ├── ui/                      # Icon, Btn, Chip, Stars, Badge, Stepper, Segmented, ProductCard, SectionHead, PhotoSlot, TabBar
│   └── screens/                 # one component per screen, imported by routes
├── lib/
│   ├── format.ts                # formatDH + currency math
│   ├── pricing.ts               # subtotal/discount/fee/total + loyalty calc (pure, tested)
│   ├── route.ts                 # LV_ROUTE + lvPosAt
│   ├── types.ts                 # shared TS types (Product, Order, ...)
│   ├── supabase/client.ts       # browser client
│   ├── supabase/server.ts       # server client (cookies)
│   └── store/cart.ts            # Zustand cart (client-first, server sync)
├── supabase/
│   ├── migrations/*.sql         # schema + RLS + functions + cron
│   └── seed.sql                 # catalog/categories/zones/rewards/loyalty seed
├── public/                      # product images / icons (added later)
└── docs/superpowers/...         # spec + this plan
```

---

## Phase 0 — Project Scaffold

### Task 0.1: Scaffold Next.js + Tailwind + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx` (temp), `.env.example`, `vitest.config.ts`

- [ ] **Step 1: Create the Next.js app non-interactively**

Run from `/Users/pro`:
```bash
npx create-next-app@latest lavilla-tmp --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-npm
# move generated files up into /Users/pro, then remove the temp dir
rsync -a lavilla-tmp/ ./ && rm -rf lavilla-tmp
```
Expected: `app/`, `package.json`, `tailwind.config.ts`, `next.config.mjs` now exist at root.

- [ ] **Step 2: Add test + supabase deps**

```bash
npm i @supabase/supabase-js @supabase/ssr zustand
npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, setupFiles: ['./vitest.setup.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
```
Create `vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```
Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Verify build + test runner boot**

Run: `npm run build` → Expected: succeeds. Run: `npm test` → Expected: "No test files found" (exit 0 is fine) or passes.

- [ ] **Step 5: Update .gitignore allow-list, then commit**

Add `!/public/`, `!/eslint.config.mjs`, `!/.eslintrc.json`, `!/vitest.config.ts`, `!/vitest.setup.ts`, `!/next-env.d.ts` lines to `.gitignore`. Run `git status --short` and CONFIRM the macOS home `Public/` folder is NOT listed (if it is, remove the `!/public/` line and instead allow-list specific subpaths).
```bash
git add .gitignore package.json package-lock.json tsconfig.json next.config.mjs tailwind.config.ts postcss.config.mjs app eslint.config.mjs vitest.config.ts vitest.setup.ts next-env.d.ts
git commit -m "chore: scaffold Next.js + Tailwind + Vitest"
```

### Task 0.2: Design tokens, fonts, globals

**Files:**
- Modify: `app/globals.css`, `tailwind.config.ts`, `app/layout.tsx`

- [ ] **Step 1: Write a token test (CSS var presence via rendered layout)**

Create `lib/__tests__/format.test.ts` placeholder is for Task 1; for tokens, instead add `app/globals.css` containing the variables and keyframes (visual, not unit-tested). Write the CSS:

In `app/globals.css` (after `@tailwind base/components/utilities`):
```css
:root{
  --brand:#137C8B; --brand-d:#0f606b; --gold:#A89723; --ink:#1A1D1E;
  --muted:#6B7173; --line:#ECEEEF; --soft:#F6F7F7;
}
html,body{margin:0;padding:0}
body{
  min-height:100vh; font-family:var(--ui-font),'Poppins',system-ui,sans-serif; color:var(--ink);
  background:radial-gradient(1200px 700px at 50% -10%, #f1f5f4 0%, #e6ebea 55%, #dfe5e4 100%);
  -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
}
*::-webkit-scrollbar{width:0;height:0;display:none} *{scrollbar-width:none}
@keyframes lvPulse{0%{transform:scale(.7);opacity:.55}100%{transform:scale(2.7);opacity:0}}
.lv-pulse{animation:lvPulse 1.9s ease-out infinite}
@keyframes lvBannerIn{from{transform:translateY(-18px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes lvBlink{0%,100%{opacity:1}50%{opacity:.25}} .lv-livedot{animation:lvBlink 1.4s ease-in-out infinite}
@keyframes lvRing{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}} .lv-ring{animation:lvRing 1.1s ease-in-out infinite}
```

- [ ] **Step 2: Map tokens into Tailwind theme**

In `tailwind.config.ts` extend colors:
```ts
theme:{ extend:{ colors:{
  brand:'#137C8B', 'brand-d':'#0f606b', gold:'#A89723',
  ink:'#1A1D1E', muted:'#6B7173', line:'#ECEEEF', soft:'#F6F7F7',
}}}
```

- [ ] **Step 3: Load fonts via next/font in `app/layout.tsx`**

```tsx
import { Poppins, Playfair_Display } from 'next/font/google';
import './globals.css';
const poppins = Poppins({ subsets:['latin'], weight:['400','500','600','700'], variable:'--ui-font' });
const playfair = Playfair_Display({ subsets:['latin'], weight:['600','700'], variable:'--font-display' });
export default function RootLayout({ children }:{children:React.ReactNode}){
  return (<html lang="fr" className={`${poppins.variable} ${playfair.variable}`}><body>{children}</body></html>);
}
export const metadata = { title: 'La Villa', description: 'Commande La Villa' };
```

- [ ] **Step 4: Verify**

Run: `npm run build` → Expected: success. Run dev server `npm run dev`, load `/` → Expected: gradient background + Poppins font visible.

- [ ] **Step 5: Commit**
```bash
git add app/globals.css tailwind.config.ts app/layout.tsx
git commit -m "feat: design tokens, fonts, global styles"
```

### Task 0.3: Supabase clients + env

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `.env.example`, `.env.local` (untracked)

- [ ] **Step 1: Env template**

`.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
Create local `.env.local` with real values (untracked via `.gitignore`).

- [ ] **Step 2: Browser client** — `lib/supabase/client.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr';
export const createClient = () =>
  createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
```

- [ ] **Step 3: Server client** — `lib/supabase/server.ts`:
```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export async function createServerSupabase() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (xs) => xs.forEach(({ name, value, options }) => store.set(name, value, options)),
    },
  });
}
```

- [ ] **Step 4: Verify build** — Run: `npm run build` → Expected: success.

- [ ] **Step 5: Commit**
```bash
git add lib/supabase/client.ts lib/supabase/server.ts .env.example
git commit -m "feat: supabase browser + server clients"
```

---

## Phase 1 — Database: schema, RLS, seed, functions

> Use the Supabase CLI (`npx supabase init`, `npx supabase db push`) or apply SQL via the dashboard. Each migration is a numbered file in `supabase/migrations/`.

### Task 1.1: Core schema migration

**Files:** Create `supabase/migrations/0001_core_schema.sql`

- [ ] **Step 1: Write the schema** (tables per spec §5). Include exactly these tables with columns from the spec: `profiles, products, categories, delivery_zones, carts, cart_items, orders, order_items, order_tracking, drivers, chat_messages, reviews, rewards, loyalty_ledger, notifications`. Use `uuid` PKs (`default gen_random_uuid()`), `numeric(10,2)` for money, `text[]` for arrays, `jsonb` for customization, FKs with `on delete cascade` where child-of-order. `order_tracking.order_id` UNIQUE (1:1). Enums via `text` + `check`.

Key fragment (orders + tracking — write all tables similarly):
```sql
create table orders (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','preparing','en_route','delivered','cancelled')),
  mode text not null check (mode in ('livraison','retrait')),
  address text, zone_id uuid references delivery_zones(id),
  subtotal_dh numeric(10,2) not null, delivery_fee_dh numeric(10,2) not null default 0,
  discount_dh numeric(10,2) not null default 0, total_dh numeric(10,2) not null,
  points_earned int not null default 0, points_redeemed int not null default 0,
  placed_at timestamptz not null default now(), eta_at timestamptz
);
create table order_tracking (
  order_id uuid primary key references orders(id) on delete cascade,
  stage int not null default 0 check (stage between 0 and 4),
  progress numeric(5,4) not null default 0,
  eta_at timestamptz, driver_id uuid references drivers(id), updated_at timestamptz not null default now()
);
```

- [ ] **Step 2: Apply** — Run: `npx supabase db push` (or paste in SQL editor). Expected: all tables created, no errors.

- [ ] **Step 3: Verify** — Run: `npx supabase db diff` (expect empty) or query `select count(*) from products;` → Expected: 0 rows, table exists.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/0001_core_schema.sql
git commit -m "feat(db): core schema"
```

### Task 1.2: RLS policies

**Files:** Create `supabase/migrations/0002_rls.sql`

- [ ] **Step 1: Enable RLS + policies.** Public-read for `products, categories, delivery_zones, drivers, rewards`. Owner-only (`auth.uid() = user_id`) for `profiles (id), carts, cart_items (via cart), orders, order_items (via order), order_tracking (via order), chat_messages (via order), reviews, loyalty_ledger, notifications`. Inserts to `orders/order_items/order_tracking/loyalty_ledger` happen via service-role server code (bypasses RLS) — client gets SELECT only.

Fragment:
```sql
alter table products enable row level security;
create policy products_read on products for select using (true);
alter table orders enable row level security;
create policy orders_owner_read on orders for select using (auth.uid() = user_id);
alter table profiles enable row level security;
create policy profiles_rw on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
```

- [ ] **Step 2: Apply + verify with two test users** — using the SQL editor impersonation or a quick script, confirm user A cannot `select` user B's order. Expected: 0 rows for cross-user.

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/0002_rls.sql
git commit -m "feat(db): row level security policies"
```

### Task 1.3: Profile auto-provision trigger

**Files:** Create `supabase/migrations/0003_profile_trigger.sql`

- [ ] **Step 1: Trigger** that inserts a `profiles` row on new `auth.users`:
```sql
create or replace function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, loyalty_points, loyalty_tier)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), 0, 'Gourmand');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
```

- [ ] **Step 2: Apply + verify** — sign up a test user, confirm a `profiles` row appears. Expected: 1 row.

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/0003_profile_trigger.sql
git commit -m "feat(db): auto-provision profile on signup"
```

### Task 1.4: Place-order RPC (transactional, server-authoritative)

**Files:** Create `supabase/migrations/0004_place_order.sql`

- [ ] **Step 1: SQL function `place_order(p_user uuid, p_items jsonb, p_mode text, p_address text, p_zone uuid, p_promo bool, p_redeem_pts int)`** that, in one transaction: recomputes subtotal from `products` (ignoring any client price), applies 15% promo if `p_promo`, sets delivery fee from `delivery_zones` (0 if subtotal ≥ 200 or mode='retrait'), subtracts `p_redeem_pts` (1 pt = 1 DH, capped at profile balance and at total), computes total, generates `code` (`'CMD-'||lpad((floor(random()*9000)+1000)::text,4,'0')`), inserts `orders`+`order_items`, awards `floor(total)` points to profile, writes `loyalty_ledger` (+earned, -redeemed), recomputes tier, creates `order_tracking` (stage 0, progress 0, eta now()+28min, assigns a `drivers` row), and deletes the user's `cart_items`. Returns the new `orders.id`.

- [ ] **Step 2: Apply.** Expected: function created.

- [ ] **Step 3: Verify** — call `select place_order(...)` with a seeded product; confirm `orders`, `order_items`, `order_tracking`, `loyalty_ledger` rows and cleared cart. Expected: total matches hand-computed value.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/0004_place_order.sql
git commit -m "feat(db): transactional place_order rpc"
```

### Task 1.5: Simulated mover (pg_cron)

**Files:** Create `supabase/migrations/0005_mover.sql`

- [ ] **Step 1: Function `advance_deliveries()`** that, for every `order_tracking` joined to `orders.status in ('preparing','en_route')`, increments `progress` by `~1/28` per tick (clamped ≤ 1), derives `stage` from progress thresholds (0,.1,.4,.85,1 → 0..4), updates `eta_at`, and when `progress >= 1` sets `orders.status='delivered'`, `stage=4`. Schedule via pg_cron every 30s:
```sql
create extension if not exists pg_cron;
select cron.schedule('lv_mover', '30 seconds', $$ select advance_deliveries(); $$);
```
(If sub-minute cron is unavailable, schedule `* * * * *` and advance by `~2/28` per minute; document the cadence.)

- [ ] **Step 2: Enable Realtime** on `order_tracking` (and `notifications`): `alter publication supabase_realtime add table order_tracking, notifications;`

- [ ] **Step 3: Verify** — place an order, set status `en_route`, wait one tick, confirm `progress` advanced. Expected: progress increases over time.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/0005_mover.sql
git commit -m "feat(db): simulated delivery mover + realtime"
```

### Task 1.6: Seed catalog/categories/zones/rewards/loyalty

**Files:** Create `supabase/seed.sql`

- [ ] **Step 1: Port seed data verbatim from the prototype.** Translate `PRODUCTS` (19 rows incl. `p-fraisier` 165 DH signature), `CATEGORIES`, `LOYALTY` tiers/paliers, `REWARDS`, and delivery `zones` (from `store.jsx`) into INSERT statements. Keep names, prices, ratings, descriptions, universe/category, `is_customizable`, `diet_badges`, `tags` identical to `data.jsx`.

- [ ] **Step 2: Apply** — Run: `npx supabase db reset` (dev) or run `seed.sql`. Expected: `select count(*) from products` → 19.

- [ ] **Step 3: Commit**
```bash
git add supabase/seed.sql
git commit -m "feat(db): seed catalog, categories, zones, rewards, loyalty"
```

---

## Phase 2 — Pure logic libs (TDD)

### Task 2.1: `formatDH` + currency

**Files:** Create `lib/format.ts`, `lib/__tests__/format.test.ts`

- [ ] **Step 1: Failing test** — `lib/__tests__/format.test.ts`:
```ts
import { formatDH } from '@/lib/format';
describe('formatDH', () => {
  it('uses comma decimal and DH suffix', () => {
    expect(formatDH(165)).toBe('165,00 DH');
    expect(formatDH(12.5)).toBe('12,50 DH');
    expect(formatDH(0)).toBe('0,00 DH');
  });
});
```
- [ ] **Step 2: Run → fail** — `npm test -- format` → Expected: FAIL (module not found).
- [ ] **Step 3: Implement** — `lib/format.ts`: `export const formatDH = (n:number)=> n.toFixed(2).replace('.',',')+' DH';`
- [ ] **Step 4: Run → pass** — `npm test -- format` → Expected: PASS.
- [ ] **Step 5: Commit** — `git add lib/format.ts lib/__tests__/format.test.ts && git commit -m "feat: formatDH currency helper"`

### Task 2.2: Pricing + loyalty math

**Files:** Create `lib/pricing.ts`, `lib/__tests__/pricing.test.ts`

- [ ] **Step 1: Failing tests** covering subtotal, 15% promo, free-delivery threshold, zone fee, points-redeem cap, points-earned:
```ts
import { computeOrder } from '@/lib/pricing';
const items = [{ price:100, qty:1 }, { price:50, qty:2 }]; // subtotal 200
it('free delivery at >=200, earns floor(total) pts', () => {
  const r = computeOrder({ items, mode:'livraison', zoneFee:15, promo:false, redeemPts:0, pointsBalance:0 });
  expect(r.subtotal).toBe(200); expect(r.deliveryFee).toBe(0);
  expect(r.total).toBe(200); expect(r.pointsEarned).toBe(200);
});
it('applies 15% promo then charges zone fee under threshold', () => {
  const r = computeOrder({ items:[{price:100,qty:1}], mode:'livraison', zoneFee:15, promo:true, redeemPts:0, pointsBalance:0 });
  expect(r.discount).toBe(15); expect(r.deliveryFee).toBe(15); expect(r.total).toBe(100);
});
it('caps redeemed points at balance and total', () => {
  const r = computeOrder({ items:[{price:100,qty:1}], mode:'retrait', zoneFee:0, promo:false, redeemPts:999, pointsBalance:30 });
  expect(r.pointsRedeemed).toBe(30); expect(r.total).toBe(70);
});
```
- [ ] **Step 2: Run → fail** — `npm test -- pricing` → Expected: FAIL.
- [ ] **Step 3: Implement `computeOrder`** in `lib/pricing.ts` (pure function mirroring the `place_order` RPC math: subtotal = Σ price*qty; discount = promo?round(subtotal*0.15):0; base = subtotal-discount; fee = (mode==='retrait'||base>=200)?0:zoneFee; redeemed = min(redeemPts, pointsBalance, base+fee); total = base+fee-redeemed; pointsEarned = floor(total)). Round money to 2 decimals.
- [ ] **Step 4: Run → pass** — Expected: PASS.
- [ ] **Step 5: Commit** — `git add lib/pricing.ts lib/__tests__/pricing.test.ts && git commit -m "feat: order pricing + loyalty math"`

> NOTE: `place_order` (Task 1.4) and `computeOrder` must stay in sync. Task 5.4 adds an integration test asserting the RPC total equals `computeOrder` for the same inputs.

### Task 2.3: Route geometry `lvPosAt`

**Files:** Create `lib/route.ts`, `lib/__tests__/route.test.ts`

- [ ] **Step 1: Failing test**:
```ts
import { LV_ROUTE, lvPosAt } from '@/lib/route';
it('returns start at 0 and end at 1', () => {
  expect(lvPosAt(0)).toMatchObject({ x:17.5, y:78.6 });
  expect(lvPosAt(1)).toMatchObject({ x:57.5, y:33.9 });
});
it('clamps out-of-range', () => { expect(lvPosAt(-1)).toMatchObject({x:17.5}); expect(lvPosAt(2)).toMatchObject({x:57.5}); });
```
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** — copy `LV_ROUTE` (6 points) and `lvPosAt` verbatim from `store.jsx:9-34` into `lib/route.ts`, export both, add the totals constants.
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** — `git add lib/route.ts lib/__tests__/route.test.ts && git commit -m "feat: delivery route geometry"`

### Task 2.4: Shared types

**Files:** Create `lib/types.ts`

- [ ] **Step 1: Define** `Product, Category, Zone, CartItem, Order, OrderItem, OrderTracking, Driver, Reward, LoyaltyTier, Review, Notification` TS interfaces matching the DB columns (Task 1.1). No test (types only).
- [ ] **Step 2: Verify** — `npx tsc --noEmit` → Expected: success.
- [ ] **Step 3: Commit** — `git add lib/types.ts && git commit -m "feat: shared types"`

---

## Phase 3 — UI primitives

### Task 3.1: Icon + atomic primitives

**Files:** Create `components/ui/Icon.tsx`, `Btn.tsx`, `Chip.tsx`, `Stars.tsx`, `Badge.tsx`, `Stepper.tsx`, `Segmented.tsx`, `PhotoSlot.tsx`, `SectionHead.tsx`, `components/ui/index.ts`

- [ ] **Step 1: Port `Icon`** — copy the `ICON_PATHS` dict and the special `star` case from `ui.jsx` into `components/ui/Icon.tsx` as a typed React component (`<Icon name size color/>` → inline `<svg>`).
- [ ] **Step 2: Port `Btn`** — variants `primary|gold|outline|ghost`, sizes `sm|md|lg`, matching prototype colors (primary uses `--brand`, gold uses `--gold`). Tailwind classes mapped from token colors.
- [ ] **Step 3: Port `Chip, Stars, Badge, Stepper, Segmented, PhotoSlot, SectionHead`** from `ui.jsx`, matching markup/spacing. `PhotoSlot` accepts optional `src` and renders the labeled placeholder when absent.
- [ ] **Step 4: Smoke test** — `components/ui/__tests__/btn.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { Btn } from '@/components/ui/Btn';
it('renders label + handles click role', () => { render(<Btn>Ajouter</Btn>); expect(screen.getByText('Ajouter')).toBeInTheDocument(); });
```
- [ ] **Step 5: Run test + tsc** — Expected: PASS, no type errors.
- [ ] **Step 6: Commit** — stage the listed files: `git commit -m "feat(ui): atomic primitives"`

### Task 3.2: ProductCard + TabBar

**Files:** Create `components/ui/ProductCard.tsx`, `components/ui/TabBar.tsx`

- [ ] **Step 1: Port `ProductCard`** from `ui.jsx` — image (PhotoSlot/src), name, price via `formatDH`, rating Stars, quick-add button → calls cart store `quickAdd`.
- [ ] **Step 2: Port `TabBar`** — 5 tabs Accueil/Recherche/Panier/Commandes/Profil with Icons; active state driven by `usePathname()`; links to routes; cart badge shows item count from cart store. Fixed bottom with safe-area padding.
- [ ] **Step 3: Smoke test** ProductCard renders price string `formatDH(price)`.
- [ ] **Step 4: Run test → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(ui): ProductCard + TabBar"`

### Task 3.3: Cart store (client-first)

**Files:** Create `lib/store/cart.ts`, `lib/__tests__/cart.test.ts`

- [ ] **Step 1: Failing test** for add/quickAdd/setQty/removeAt/clear/count/subtotal:
```ts
import { useCart } from '@/lib/store/cart';
it('adds and totals', () => {
  const s = useCart.getState();
  s.clear(); s.addToCart({ id:'p1', name:'X', price:50 }, 2, {});
  expect(useCart.getState().count()).toBe(2);
  expect(useCart.getState().subtotal()).toBe(100);
});
```
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** Zustand store with persist (localStorage) holding `items:{product,qty,opts}[]` + actions; `subtotal()` uses price*qty; reorder helper. (Server sync to `cart_items` is wired in Phase 5.)
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** — `git commit -m "feat: client cart store"`

---

## Phase 4 — Auth & Shell

### Task 4.1: App shell layout + TabBar wiring

**Files:** Create `app/(app)/layout.tsx`

- [ ] **Step 1:** Server layout that calls `createServerSupabase().auth.getUser()`; if no user → `redirect('/auth')`. Renders children inside a max-width mobile column with the `TabBar` and top safe-area.
- [ ] **Step 2: Verify** — visiting any `(app)` route while logged out redirects to `/auth`. Expected: redirect.
- [ ] **Step 3: Commit** — `git commit -m "feat: authed app shell"`

### Task 4.2: Auth screen (Supabase email/password + Google)

**Files:** Create `app/auth/page.tsx`, `components/screens/Auth.tsx`, `app/auth/callback/route.ts`

- [ ] **Step 1:** Build `Auth` matching `screens-home.jsx` `Auth` layout (logo, Playfair heading, fields). Replace mock OTP with: email+password sign-in/sign-up tabs + "Continuer avec Google" button (`supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: location.origin + '/auth/callback' }})`). Email/password via `signInWithPassword` / `signUp`.
- [ ] **Step 2:** `app/auth/callback/route.ts` exchanges `?code` for a session (`supabase.auth.exchangeCodeForSession`) and redirects to `/`.
- [ ] **Step 3: Verify** — sign up with email, confirm session cookie set, redirected into app; profile row created (Task 1.3). Expected: lands on Home.
- [ ] **Step 4: Commit** — `git commit -m "feat: supabase auth screen + oauth callback"`

### Task 4.3: Onboarding

**Files:** Create `app/welcome/page.tsx`, `components/screens/Onboarding.tsx`

- [ ] **Step 1:** Port 3-slide `Onboarding` (Playfair titles) from `screens-home.jsx`; "Commencer" → `/auth`. Show only when no session; first authed visit can skip.
- [ ] **Step 2: Verify** — `/welcome` shows 3 swipeable slides. 
- [ ] **Step 3: Commit** — `git commit -m "feat: onboarding"`

---

## Phase 5 — Browse → Cart → Order

### Task 5.1: Home (Accueil)

**Files:** Create `app/(app)/page.tsx`, `components/screens/Home.tsx`

- [ ] **Step 1:** Server-fetch products/categories from Supabase. Build `Home` matching `screens-home.jsx`: location header, search bar (→ `/shop`), `Segmented` mode (livraison/retrait) + universe (all/patisserie/restaurant) stored in a small client context, category chips, hero banner "La création du Chef", favoris grid, Ramadan promo card (→ `/ramadan`), discover grid of `ProductCard`.
- [ ] **Step 2: Verify** — Home renders seeded products, chips filter universe. 
- [ ] **Step 3: Commit** — `git commit -m "feat: home screen"`

### Task 5.2: Catalog + Product

**Files:** Create `app/(app)/shop/page.tsx`, `components/screens/Catalog.tsx`, `app/(app)/shop/[slug]/page.tsx`, `components/screens/Product.tsx`

- [ ] **Step 1: Catalog** — search input, category chips, sort (populaire/prix/note), product grid, empty state — matching `screens-shop.jsx`. Filtering/sort client-side over fetched list.
- [ ] **Step 2: Product** — fetch by `slug`; 320px photo header, tags, price, "Profil de saveur" description; if `is_customizable` show size/flavor/message/date pre-order controls (CAKE_SIZES/CAKE_FLAVORS from seed) else diet badges; quantity `Stepper`; sticky add-to-cart bar showing live total → `addToCart`.
- [ ] **Step 3: Verify** — open `p-fraisier`, customize, add to cart; cart count increments. 
- [ ] **Step 4: Commit** — `git commit -m "feat: catalog + product screens"`

### Task 5.3: Cart + Checkout UI

**Files:** Create `app/(app)/cart/page.tsx`, `components/screens/Cart.tsx`, `app/(app)/checkout/page.tsx`, `components/screens/Checkout.tsx`

- [ ] **Step 1: Cart** — line items with `Stepper`/remove, promo code input (15%), summary using `computeOrder` for display (zone fee, free ≥200), total via `formatDH`; empty state; "Commander" → `/checkout`.
- [ ] **Step 2: Checkout** — address/pickup toggle, time slots (asap/12:30/19:00), payment options (cmi/hps/cashplus/virement/cod) as **visual mock** with CMI saved-card visual, pay-with-points redeem paliers, bill breakdown (`computeOrder`), "Payer" button.
- [ ] **Step 3: Verify** — totals match `computeOrder`; promo + points update the bill. 
- [ ] **Step 4: Commit** — `git commit -m "feat: cart + checkout UI"`

### Task 5.4: Place-order API + wiring

**Files:** Create `app/api/orders/route.ts`, `supabase/__tests__/place_order.int.test.ts` (or a script)

- [ ] **Step 1: Failing integration test** asserting the RPC total equals `computeOrder` for sample inputs (requires a test Supabase or local). If no DB in CI, mark as `it.skipIf(!process.env.SUPABASE_TEST_URL)`.
- [ ] **Step 2: Implement `POST /api/orders`** — server reads session, validates body (items, mode, address, zone, promo, redeemPts), calls `place_order` RPC via a **service-role** server client, returns new order id. Never trusts client prices.
- [ ] **Step 3:** Wire Checkout "Payer" → POST → on success clear client cart + `router.push('/orders/{id}/track')`.
- [ ] **Step 4: Verify** — place a real order end-to-end; DB shows order/items/tracking/ledger; cart cleared. Integration test passes against test DB.
- [ ] **Step 5: Commit** — `git commit -m "feat: place-order api + checkout wiring"`

---

## Phase 6 — Orders & Live Tracking

### Task 6.1: Orders list

**Files:** Create `app/(app)/orders/page.tsx`, `components/screens/Orders.tsx`

- [ ] **Step 1:** Fetch user orders; tabs `en_cours`/`terminee`; cards with code/total/status, "Suivre" (→ track) and "Recommander" (reorder → cart) — matching `screens-account.jsx` `Orders`.
- [ ] **Step 2: Verify** — placed order appears under en_cours. 
- [ ] **Step 3: Commit** — `git commit -m "feat: orders list"`

### Task 6.2: Tracking with Realtime

**Files:** Create `app/(app)/orders/[id]/track/page.tsx`, `components/screens/Tracking.tsx`

- [ ] **Step 1:** Server-fetch order+tracking+driver. Client component subscribes to `order_tracking` Realtime changes for this `order_id`.
- [ ] **Step 2:** Render the SVG 400×280 map with the `LV_ROUTE` polyline, destination pin, and a pulsing scooter marker positioned via `lvPosAt(progress)` (`.lv-pulse`); GPS chip; ETA from `eta_at`; driver card with call/chat buttons (→ routes); 5-step timeline from `TRACK_STEPS` driven by `stage`; proof-of-delivery + recap + help — matching `screens-order.jsx` `Tracking`.
- [ ] **Step 3: Verify** — with mover running, marker advances along route and timeline progresses live without refresh; on delivered, review CTA unlocks. 
- [ ] **Step 4: Commit** — `git commit -m "feat: live order tracking"`

### Task 6.3: Driver Chat + Call (mock)

**Files:** Create `app/(app)/orders/[id]/chat/page.tsx`, `components/screens/DriverChat.tsx`, `app/(app)/orders/[id]/call/page.tsx`, `components/screens/DriverCall.tsx`

- [ ] **Step 1: DriverChat** — fetch `chat_messages`, render thread + quick replies + input; sending inserts a row (optionally Realtime for instant echo).
- [ ] **Step 2: DriverCall** — port the gradient call UI, timer, mute/speaker/end controls as a **visual mock** (no telephony).
- [ ] **Step 3: Verify** — chat persists a sent message across reload; call screen renders. 
- [ ] **Step 4: Commit** — `git commit -m "feat: driver chat + call mock"`

---

## Phase 7 — Loyalty, Reviews, Account

### Task 7.1: Loyalty

**Files:** Create `app/(app)/loyalty/page.tsx`, `components/screens/Loyalty.tsx`

- [ ] **Step 1:** Fetch profile points/tier + `rewards` + `loyalty_ledger`. Render points hero (54px Playfair), tier ladder, redeem paliers, rewards horizontal scroll (exchange → ledger spend), leave-review CTA (+50), benefits list, points history — matching `screens-account.jsx` `Loyalty`. Reward exchange posts to a small server action that writes `loyalty_ledger` and decrements points (server-authoritative).
- [ ] **Step 2: Verify** — exchanging a reward decrements points and adds a history row. 
- [ ] **Step 3: Commit** — `git commit -m "feat: loyalty screen"`

### Task 7.2: Review (+50 pts)

**Files:** Create `app/(app)/orders/[id]/review/page.tsx`, `components/screens/Review.tsx`, `app/api/reviews/route.ts`

- [ ] **Step 1:** `Review` — 5-star rating, tags (REVIEW_TAGS), comment, photo (Supabase Storage optional/mock), submit. `POST /api/reviews` inserts `reviews`, awards +50 via `loyalty_ledger`, updates profile — server-side, idempotent per order.
- [ ] **Step 2: Verify** — submitting a review shows success screen and profile points +50; second submit for same order is rejected.
- [ ] **Step 3: Commit** — `git commit -m "feat: review submission + points"`

### Task 7.3: Profile, Ramadan, Notifications

**Files:** Create `app/(app)/profile/page.tsx` + `components/screens/Profile.tsx`; `app/(app)/ramadan/page.tsx` + `Ramadan.tsx`; `app/(app)/notifications/page.tsx` + `Notifications.tsx`

- [ ] **Step 1: Profile** — gradient header, avatar, loyalty progress card (→ /loyalty), menu list, logout (`supabase.auth.signOut()` → `/auth`), v1.0 footer.
- [ ] **Step 2: Ramadan** — hero, delivery slots (ftour/shour/day), Ftour selection grid — matching `screens-account.jsx` `Ramadan`.
- [ ] **Step 3: Notifications** — list read/unread from `notifications` (Realtime optional); tapping an order notif → tracking; mark-as-read updates row.
- [ ] **Step 4: Verify** — logout returns to /auth; notifications mark read; ramadan slots render.
- [ ] **Step 5: Commit** — `git commit -m "feat: profile, ramadan, notifications"`

---

## Phase 8 — Smoke E2E & polish

### Task 8.1: Playwright happy-path

**Files:** Create `e2e/happy-path.spec.ts`, `playwright.config.ts`

- [ ] **Step 1:** Install Playwright (`npm i -D @playwright/test && npx playwright install chromium`).
- [ ] **Step 2: Test** sign in → browse → add to cart → checkout → place order → see tracking. Use a seeded test user.
- [ ] **Step 3: Run** `npx playwright test` → Expected: PASS.
- [ ] **Step 4: Commit** — `git commit -m "test: happy-path e2e"`

### Task 8.2: Visual fidelity pass

- [ ] **Step 1:** Compare each screen against the prototype screenshots in `lavilla/project/` for token/spacing/typography fidelity; fix gaps.
- [ ] **Step 2:** Run `npm run build` + `npm test` + `npx tsc --noEmit` all green.
- [ ] **Step 3: Commit** — `git commit -m "polish: visual fidelity pass"`

---

## Self-Review Checklist (run after implementation of each phase)

- All money math goes through `computeOrder` / `place_order` — client prices never trusted.
- RLS verified with cross-user denial.
- Realtime tracking advances without manual refresh.
- Three confirmed mocks remain mocks: payment methods, driver call, (auth is REAL).
- Every `git add` lists explicit paths; macOS home `Public/` never staged.
