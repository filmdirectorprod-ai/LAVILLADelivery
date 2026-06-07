# La Villa — Admin Phase 3: Commandes + Cuisine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin **Commandes** (`/admin/orders`) and **Cuisine** (`/admin/kitchen`) screens — synchronized in real time with the customer and driver apps — and introduce a new `ready` order status that makes the kitchen a real gate before a driver can pick up an order.

**Architecture:** A new `ready` status is added between `preparing` and `en_route` (`pending → preparing → ready → en_route → delivered`, plus `cancelled`). The kitchen marks a cooked order `ready`, which is the moment it enters the driver pickup pool. All status semantics live in one shared, unit-tested module (`lib/order-status.ts`) consumed by customer, driver and admin surfaces. Database writes go through staff-guarded `SECURITY DEFINER` RPCs (migration 0015), mirroring the driver RPC pattern from 0008. Both admin screens follow the Phase 2 realtime pattern: a server component renders the first paint, a `'use client'` container seeds from `initial`, subscribes to `postgres_changes`, and refetches the same raw shapes — derived rows are built by a shared pure function so server and client agree.

**Tech Stack:** Next.js 14.2.35 App Router, TypeScript, Supabase (`@supabase/ssr`, Realtime `postgres_changes`), Vitest. All UI strings in French.

---

## Context the executor must know

- **Repo root:** `/Users/pro`. **Branch:** `feat/lavilla-customer-app`.
- **Migrations are DDL run MANUALLY by the USER** in the Supabase SQL editor — there is no local psql/CLI. Migrations are idempotent and numbered; the last applied is `0014`. This plan adds **`0015`**. Task 3 only *authors* the file; the user runs it. Tasks 4–7 (app code) assume 0015 has been applied when testing in the browser, but they compile and unit-test without it.
- **Order status enum** is a Postgres `CHECK` constraint (not a native enum) defined inline in `supabase/migrations/0001_core_schema.sql` and therefore auto-named `orders_status_check`.
- **Build:** `NODE_OPTIONS="--max-old-space-size=4096" npm run build`. **Type-check:** `npx tsc --noEmit`. **Tests:** `npx vitest run`. Lint is STRICT — `@typescript-eslint/no-unused-vars` is an ERROR, so never leave an unused import.
- **`tsconfig` has no explicit `target`** → never iterate a `Map`/`Set` with `for...of`; use `Array.from(...)` or `.find()`/`.filter()`.
- **Design tokens** (`globals.css`): `--brand #137c8b`, `--brand-d #0f606b`, `--gold #a89723`, `--ink`, `--muted`, `--line`, `--soft`. Cards: `#fff`, `1px solid var(--line)`, radius `18`, shadow `0 6px 18px -14px rgba(0,0,0,0.3)`. Fonts: `--ui-font` (Poppins), `--font-display` (Playfair).
- **The customer tracking timeline is `tracking.stage`-driven, NOT `orders.status`-driven** (`components/screens/TrackingScreen.tsx`). Adding `ready` therefore does **not** touch the timeline; it only affects the orders *list* badge, the driver pool, and the admin.
- **Realtime publication already includes** `orders` (0008), `order_tracking`, `drivers`, `reviews` (0014). No publication changes needed in 0015.

## File Structure

**Create:**
- `lib/order-status.ts` — single source of truth for status → French label, status → pill colours, and the active / in-progress / driver-pool status sets.
- `lib/__tests__/order-status.test.ts` — unit tests for the above.
- `lib/admin-orders.ts` — pure builders/filters for the Commandes screen (`buildAdminOrderRows`, `filterAdminOrders`) + types, shared by the server query and the client refetch.
- `lib/__tests__/admin-orders.test.ts` — unit tests for the above.
- `components/admin/orders/OrdersAdminScreen.tsx` — `'use client'` realtime container for `/admin/orders`.
- `components/admin/orders/OrderDetailPanel.tsx` — presentational detail + staff actions for the selected order.
- `app/admin/orders/page.tsx` — server first-paint for `/admin/orders`.
- `components/admin/kitchen/KitchenScreen.tsx` — `'use client'` realtime container for `/admin/kitchen`.
- `components/admin/kitchen/KitchenTicketCard.tsx` — presentational kitchen ticket.
- `app/admin/kitchen/page.tsx` — server first-paint for `/admin/kitchen`.
- `supabase/migrations/0015_admin_orders_kitchen.sql` — `ready` status + staff RPCs + driver pool/RPC/mover re-threading.

**Modify:**
- `lib/types.ts` — add `'ready'` to `OrderStatus`.
- `lib/admin-overview.ts` — `computeOverviewKpis` counts `ready` as in-progress (via the shared set).
- `lib/__tests__/admin-overview.test.ts` — update the KPI fixture/assertions for `ready`.
- `lib/queries.ts` — driver pool uses the shared pool set; add `getAdminOrdersData`, `getKitchenOrdersData`.
- `components/screens/OrdersScreen.tsx` — active set + badge label via the shared module.
- `components/driver/DriverRequestsScreen.tsx`, `components/driver/DriverDashboard.tsx` — pool query uses the shared pool set.
- `components/admin/overview/InProgressTable.tsx` — label + pill via the shared module; widen to include `ready`.
- `components/admin/overview/OverviewScreen.tsx` — in-progress filter via the shared module.

---

## Task 1: Shared order-status module

**Files:**
- Create: `lib/order-status.ts`
- Test: `lib/__tests__/order-status.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/order-status.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  orderStatusLabel,
  orderStatusPill,
  isActiveOrderStatus,
  isInProgressOrderStatus,
  ACTIVE_ORDER_STATUSES,
  IN_PROGRESS_ORDER_STATUSES,
  DRIVER_POOL_STATUSES,
} from '@/lib/order-status';

describe('orderStatusLabel', () => {
  it('maps every status to its French label', () => {
    expect(orderStatusLabel('pending')).toBe('En attente');
    expect(orderStatusLabel('preparing')).toBe('En préparation');
    expect(orderStatusLabel('ready')).toBe('Prête');
    expect(orderStatusLabel('en_route')).toBe('En route');
    expect(orderStatusLabel('delivered')).toBe('Livrée');
    expect(orderStatusLabel('cancelled')).toBe('Annulée');
  });

  it('falls back to the raw value for an unknown status', () => {
    expect(orderStatusLabel('weird')).toBe('weird');
  });
});

describe('status sets', () => {
  it('treats ready as active and in-progress, but not delivered/cancelled', () => {
    expect(isActiveOrderStatus('ready')).toBe(true);
    expect(isInProgressOrderStatus('ready')).toBe(true);
    expect(isActiveOrderStatus('delivered')).toBe(false);
    expect(isActiveOrderStatus('cancelled')).toBe(false);
  });

  it('active includes the kitchen+delivery flow plus pending', () => {
    expect(ACTIVE_ORDER_STATUSES).toEqual(['pending', 'preparing', 'ready', 'en_route']);
  });

  it('in-progress excludes pending (kitchen → delivery only)', () => {
    expect(IN_PROGRESS_ORDER_STATUSES).toEqual(['preparing', 'ready', 'en_route']);
    expect(isInProgressOrderStatus('pending')).toBe(false);
  });

  it('driver pool starts at ready (kitchen gate), never preparing', () => {
    expect(DRIVER_POOL_STATUSES).toEqual(['ready', 'en_route']);
    expect(DRIVER_POOL_STATUSES).not.toContain('preparing');
  });
});

describe('orderStatusPill', () => {
  it('gives en_route and ready distinct teal pills, cancelled a red one', () => {
    expect(orderStatusPill('en_route').fg).toBe('var(--brand-d)');
    expect(orderStatusPill('ready').fg).toBe('var(--brand)');
    expect(orderStatusPill('cancelled').fg).not.toBe(orderStatusPill('ready').fg);
    // preparing keeps the gold pill used by the Phase 2 overview table
    expect(orderStatusPill('preparing').fg).toBe('var(--gold)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/order-status.test.ts`
Expected: FAIL — `Cannot find module '@/lib/order-status'`.

- [ ] **Step 3: Write the implementation**

Create `lib/order-status.ts`:

```ts
// Single source of truth for order-status presentation and grouping. Consumed by
// the customer orders list, the driver pool, and the admin overview/orders/kitchen
// screens so every surface agrees on labels, colours and which statuses count as
// "active" / "in progress" / "pickable by a driver".
//
// Lifecycle: pending → preparing → ready → en_route → delivered  (+ cancelled).
//   • ready  : the kitchen has marked the food cooked — it now enters the driver
//              pickup pool. This is the kitchen "gate".
import type { OrderStatus } from '@/lib/types';

/** Statuses an order passes through while still open for the customer. */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = ['pending', 'preparing', 'ready', 'en_route'];

/** Statuses the admin counts as "in progress" (kitchen → delivery; excludes the
 *  never-used `pending`). */
export const IN_PROGRESS_ORDER_STATUSES: OrderStatus[] = ['preparing', 'ready', 'en_route'];

/** Statuses an order must be in to appear in / be claimed from the driver pool. */
export const DRIVER_POOL_STATUSES: OrderStatus[] = ['ready', 'en_route'];

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'En attente',
  preparing: 'En préparation',
  ready: 'Prête',
  en_route: 'En route',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

/** French label for a status; falls back to the raw value if unknown. */
export function orderStatusLabel(status: string): string {
  return STATUS_LABELS[status as OrderStatus] ?? status;
}

export function isActiveOrderStatus(status: string): boolean {
  return (ACTIVE_ORDER_STATUSES as string[]).includes(status);
}

export function isInProgressOrderStatus(status: string): boolean {
  return (IN_PROGRESS_ORDER_STATUSES as string[]).includes(status);
}

export interface StatusPill {
  bg: string;
  fg: string;
}

/** Pill background/foreground for a status badge. `preparing`/`pending` keep the
 *  gold treatment the Phase 2 overview table already used. */
export function orderStatusPill(status: string): StatusPill {
  switch (status) {
    case 'en_route':
      return { bg: 'rgba(19,124,139,0.12)', fg: 'var(--brand-d)' };
    case 'ready':
      return { bg: 'rgba(19,124,139,0.10)', fg: 'var(--brand)' };
    case 'delivered':
      return { bg: 'rgba(46,125,50,0.12)', fg: '#2e7d32' };
    case 'cancelled':
      return { bg: 'rgba(180,35,35,0.10)', fg: '#a23' };
    default:
      return { bg: 'rgba(168,151,35,0.14)', fg: 'var(--gold)' };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/order-status.test.ts`
Expected: PASS (all assertions green).

- [ ] **Step 5: Commit**

```bash
git add lib/order-status.ts lib/__tests__/order-status.test.ts
git commit -m "feat(admin): shared order-status module (labels, pills, status sets)"
```

---

## Task 2: Add `ready` to the type + count it in KPIs

**Files:**
- Modify: `lib/types.ts:8-13`
- Modify: `lib/admin-overview.ts:44-45`
- Test: `lib/__tests__/admin-overview.test.ts:42-65`

- [ ] **Step 1: Update the failing test first**

In `lib/__tests__/admin-overview.test.ts`, replace the `computeOverviewKpis` fixture and the two affected assertions. Change the `orders` array (currently lines ~43-48) to include a `ready` order:

```ts
  const orders = [
    { status: 'preparing', total_dh: 100 },
    { status: 'ready', total_dh: 75 },
    { status: 'en_route', total_dh: 50 },
    { status: 'delivered', total_dh: 200 },
    { status: 'cancelled', total_dh: 999 },
  ];
```

Then update the two assertions that depend on the fixture:

```ts
  it('counts today orders and in-progress orders', () => {
    const k = computeOverviewKpis({ orders, drivers, ratings });
    expect(k.ordersToday).toBe(5);
    expect(k.inProgress).toBe(3); // preparing + ready + en_route
  });

  it('sums revenue of non-cancelled orders only', () => {
    const k = computeOverviewKpis({ orders, drivers, ratings });
    expect(k.revenueToday).toBe(425); // 100 + 75 + 50 + 200
  });
```

(Leave the `driversOnline`, `ratingAvg`, and "no ratings" tests unchanged.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/admin-overview.test.ts`
Expected: FAIL — `inProgress` is `2` (the `ready` order is not yet counted) and `ordersToday`/`revenueToday` mismatch.

- [ ] **Step 3: Add `ready` to the OrderStatus union**

In `lib/types.ts`, replace the union (lines 8-13):

```ts
export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'en_route'
  | 'delivered'
  | 'cancelled';
```

- [ ] **Step 4: Count `ready` as in-progress via the shared set**

In `lib/admin-overview.ts`, add the import at the top of the file (after the existing top comment, before the helpers — there are currently no imports, so add one):

```ts
import { isInProgressOrderStatus } from '@/lib/order-status';
```

Then in `computeOverviewKpis` replace the `inProgress` line (currently line 45):

```ts
  const inProgress = orders.filter((o) => isInProgressOrderStatus(o.status)).length;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/admin-overview.test.ts lib/__tests__/order-status.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts lib/admin-overview.ts lib/__tests__/admin-overview.test.ts
git commit -m "feat: add 'ready' order status; count it as in-progress"
```

---

## Task 3: Migration 0015 — `ready` status, staff RPCs, driver/​mover re-threading

**Files:**
- Create: `supabase/migrations/0015_admin_orders_kitchen.sql`

> This task only authors the SQL. The **user runs it manually** in the Supabase SQL editor. There is no automated test; Step 2 is a static review and Step 3 lists the verification queries the user runs after applying.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0015_admin_orders_kitchen.sql`:

```sql
-- La Villa — Admin Phase 3: Commandes + Cuisine.
-- Introduces the 'ready' order status (kitchen gate) and the staff write RPCs the
-- admin Commandes & Cuisine screens use, then re-threads the driver pool, the
-- driver RPCs and the auto-mover onto the new five-step lifecycle:
--   pending → preparing → ready → en_route → delivered   (+ cancelled)
--     • preparing : in the kitchen
--     • ready     : cooked, waiting for a driver — ENTERS the driver pool here
--     • en_route  : a driver has picked it up and is delivering
-- Idempotent; safe to re-run. Run manually in the Supabase SQL editor (after 0014).

-- ── 1. Widen the status CHECK constraint to include 'ready' ───────────────────
-- The constraint is the inline column check from 0001, auto-named orders_status_check.
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('pending','preparing','ready','en_route','delivered','cancelled'));

-- ── 2. Kitchen: mark a preparing order ready (staff only) ─────────────────────
create or replace function public.admin_mark_order_ready(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_mode text; v_uid uuid; v_code text;
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;

  update orders o
    set status = 'ready'
    where o.id = p_order and o.status = 'preparing'
    returning o.mode, o.user_id, o.code into v_mode, v_uid, v_code;
  if not found then
    raise exception 'not_preparing';  -- already past the kitchen, or unknown
  end if;

  insert into notifications (user_id, kind, title, body, order_id)
  values (v_uid, 'order', 'Commande prête',
    case when v_mode = 'retrait'
         then 'Votre commande ' || v_code || ' est prête à récupérer en boutique.'
         else 'Votre commande ' || v_code || ' est prête, un livreur va la récupérer.' end,
    p_order);
end;
$$;

-- ── 3. Commandes: set an order's status (staff only, validated) ───────────────
-- General-purpose setter for the Commandes screen (mainly correct / cancel).
-- Notifies the customer on cancellation. Does NOT touch tracking; delivery
-- progression stays the driver's job via driver_update_status (0008).
create or replace function public.admin_set_order_status(p_order uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_code text;
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  if p_status not in ('preparing','ready','en_route','delivered','cancelled') then
    raise exception 'invalid status %', p_status;
  end if;

  update orders o set status = p_status
    where o.id = p_order
    returning o.user_id, o.code into v_uid, v_code;
  if not found then raise exception 'unknown order'; end if;

  if p_status = 'cancelled' then
    insert into notifications (user_id, kind, title, body, order_id)
    values (v_uid, 'order', 'Commande annulée',
      'Votre commande ' || v_code || ' a été annulée. Contactez-nous pour toute question.',
      p_order);
  end if;
end;
$$;

-- ── 4. Commandes: assign / reassign a driver (staff only) ─────────────────────
-- Points the tracking row at a chosen driver and flips manual=true so the
-- auto-mover lets go. Upserts the tracking row if it does not exist yet.
create or replace function public.admin_assign_driver(p_order uuid, p_driver uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  if not exists (select 1 from orders where id = p_order) then
    raise exception 'unknown order';
  end if;
  if not exists (select 1 from drivers where id = p_driver) then
    raise exception 'unknown driver';
  end if;

  insert into order_tracking (order_id, stage, progress, driver_id, manual, updated_at)
  values (p_order, 0, 0, p_driver, true, now())
  on conflict (order_id)
  do update set driver_id = excluded.driver_id, manual = true, updated_at = now();
end;
$$;

revoke all on function public.admin_mark_order_ready(uuid) from public;
revoke all on function public.admin_set_order_status(uuid, text) from public;
revoke all on function public.admin_assign_driver(uuid, uuid) from public;
grant execute on function public.admin_mark_order_ready(uuid) to authenticated, service_role;
grant execute on function public.admin_set_order_status(uuid, text) to authenticated, service_role;
grant execute on function public.admin_assign_driver(uuid, uuid) to authenticated, service_role;

-- ── 5. Driver pool now starts at 'ready' (kitchen gate) ───────────────────────
-- Re-defines the 0008 driver-read policies so a driver only sees cooked orders.
drop policy if exists orders_driver_read on orders;
create policy orders_driver_read on orders for select
  using (
    lv_is_driver()
    and status in ('ready','en_route')
    and exists (
      select 1 from order_tracking t
      where t.order_id = orders.id
        and (coalesce(t.manual, false) = false or t.driver_id = lv_current_driver())
    )
  );

drop policy if exists order_tracking_driver_read on order_tracking;
create policy order_tracking_driver_read on order_tracking for select
  using (
    lv_is_driver()
    and (coalesce(manual, false) = false or driver_id = lv_current_driver())
    and exists (
      select 1 from orders o
      where o.id = order_tracking.order_id and o.status in ('ready','en_route')
    )
  );

-- A driver may only accept a cooked, unclaimed order (status = 'ready').
create or replace function public.driver_accept_order(p_order uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_driver uuid;
begin
  v_driver := lv_current_driver();
  if v_driver is null then raise exception 'forbidden'; end if;

  update order_tracking t
    set driver_id = v_driver, manual = true, updated_at = now()
    where t.order_id = p_order
      and coalesce(t.manual, false) = false
      and exists (select 1 from orders o
                  where o.id = t.order_id and o.status = 'ready');
  if not found then
    raise exception 'unavailable';  -- not ready, already claimed, or unknown
  end if;

  return p_order;
end;
$$;

-- A claimed order is past the kitchen, so a not-yet-en-route stage maps to
-- 'ready' (never back to 'preparing').
create or replace function public.driver_update_status(p_order uuid, p_stage int)
returns void language plpgsql security definer set search_path = public as $$
declare v_driver uuid; v_prog numeric;
begin
  v_driver := lv_current_driver();
  if v_driver is null then raise exception 'forbidden'; end if;
  if p_stage not in (2,3,4) then raise exception 'invalid stage %', p_stage; end if;

  if not exists (select 1 from order_tracking t
                 where t.order_id = p_order and t.driver_id = v_driver) then
    raise exception 'forbidden';
  end if;

  v_prog := case p_stage when 2 then 0.35 when 3 then 0.50 when 4 then 1.0 end;

  update order_tracking t
    set stage = p_stage,
        progress = greatest(t.progress, v_prog),
        eta_at = now() + (greatest(0, 1.0 - greatest(t.progress, v_prog)) * interval '28 minutes'),
        updated_at = now()
    where t.order_id = p_order and t.driver_id = v_driver;

  update orders o
    set status = case when p_stage >= 4 then 'delivered'
                      when p_stage >= 3 then 'en_route'
                      else 'ready' end
    where o.id = p_order;

  insert into notifications (user_id, kind, title, body, order_id)
  select o.user_id, 'order',
    case p_stage when 2 then 'Commande récupérée'
                 when 3 then 'Livreur en route'
                 else 'Commande livrée' end,
    case p_stage when 2 then 'Votre livreur a récupéré votre commande.'
                 when 3 then 'Votre livreur est en route vers vous.'
                 else 'Votre commande a été livrée. Bon appétit !' end,
    o.id
  from orders o where o.id = p_order;
end;
$$;

-- ── 6. Auto-mover: simulate the full lifecycle incl. the 'ready' band ─────────
-- Demo orders (manual=false) still self-drive end-to-end; the new 0.2 threshold
-- lets them pass through 'ready' (so they briefly appear in the kitchen / pool).
-- Real, driver-claimed orders (manual=true) remain untouched.
create or replace function public.advance_deliveries()
returns void language plpgsql security definer set search_path = public as $$
declare step numeric := 0.06;
begin
  update order_tracking t
    set progress = least(1.0, t.progress + step),
        stage = lv_stage_for(least(1.0, t.progress + step)),
        eta_at = now() + (greatest(0, (1.0 - least(1.0, t.progress + step))) * interval '28 minutes'),
        updated_at = now()
    from orders o
    where o.id = t.order_id
      and o.status in ('preparing','ready','en_route')
      and coalesce(t.manual, false) = false;

  update orders o
    set status = case
      when t.progress >= 1.0 then 'delivered'
      when t.progress >= 0.5 then 'en_route'
      when t.progress >= 0.2 then 'ready'
      else 'preparing' end
    from order_tracking t
    where t.order_id = o.id
      and o.status in ('preparing','ready','en_route')
      and coalesce(t.manual, false) = false;
end;
$$;
```

- [ ] **Step 2: Static review (no DB call)**

Re-read the file and confirm:
- The `CHECK` list is a strict superset of the old one (no existing row can violate it).
- Every new function is `security definer set search_path = public` and guards with `lv_is_staff()` (admin RPCs) or `lv_current_driver()` (driver RPCs).
- All three new functions have matching `revoke all ... from public` + `grant execute ... to authenticated, service_role`.
- `driver_update_status` else-branch is `'ready'` (not `'preparing'`), and the mover's status `case` has the `>= 0.2 then 'ready'` band above the `else 'preparing'`.

- [ ] **Step 3: Hand off to the user with verification queries**

Tell the user: *"Migration 0015 is ready. Please run `supabase/migrations/0015_admin_orders_kitchen.sql` in the Supabase SQL editor, then run these checks."*

```sql
-- (a) constraint now allows 'ready'
select pg_get_constraintdef(oid) from pg_constraint where conname = 'orders_status_check';
--   → ...status = ANY (ARRAY['pending','preparing','ready','en_route','delivered','cancelled'])

-- (b) the three staff RPCs exist
select proname from pg_proc
where proname in ('admin_mark_order_ready','admin_set_order_status','admin_assign_driver')
order by proname;   -- → 3 rows

-- (c) smoke test (replace <ORDER_UUID> with a real 'preparing' order id)
-- select admin_mark_order_ready('<ORDER_UUID>');  -- as the staff user
-- select status from orders where id = '<ORDER_UUID>';  -- → 'ready'
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0015_admin_orders_kitchen.sql
git commit -m "feat(db): migration 0015 — ready status, staff order RPCs, driver pool gate"
```

---

## Task 4: Thread `ready` through customer, driver and overview surfaces

**Files:**
- Modify: `lib/queries.ts:166` (getDriverBoard)
- Modify: `components/driver/DriverRequestsScreen.tsx:54`
- Modify: `components/driver/DriverDashboard.tsx:84`
- Modify: `components/screens/OrdersScreen.tsx:7,23,39,69,76`
- Modify: `components/admin/overview/InProgressTable.tsx:4-19,85-89`
- Modify: `components/admin/overview/OverviewScreen.tsx:83-84`

> This task is wiring (no new unit tests); verification is `tsc --noEmit` + the existing suite + `npm run build`.

- [ ] **Step 1: Driver pool — server query**

In `lib/queries.ts`, add to the import block at the top (the file already imports from `@/lib/admin-overview`):

```ts
import { DRIVER_POOL_STATUSES } from '@/lib/order-status';
```

Then in `getDriverBoard` replace the status filter (line 166):

```ts
    .in('status', DRIVER_POOL_STATUSES)
```

- [ ] **Step 2: Driver pool — client refetches**

In `components/driver/DriverRequestsScreen.tsx`, add the import (with the other `@/lib` imports near the top):

```ts
import { DRIVER_POOL_STATUSES } from '@/lib/order-status';
```

Replace the refetch filter (line 54):

```ts
      .in('status', DRIVER_POOL_STATUSES)
```

Do the identical change in `components/driver/DriverDashboard.tsx`: add the same import and replace its `.in('status', ['preparing', 'en_route'])` (line 84) with `.in('status', DRIVER_POOL_STATUSES)`.

- [ ] **Step 3: Customer orders list — active set + badge label**

In `components/screens/OrdersScreen.tsx`:

Replace the type-only import line (line 7) so `OrderStatus` is no longer imported here (the local `ACTIVE` array is being removed):

```ts
import type { Product } from '@/lib/types';
```

Add a value import (with the other `@/lib` imports, e.g. after the `formatDH` import on line 9):

```ts
import { isActiveOrderStatus, orderStatusLabel } from '@/lib/order-status';
```

Delete the local `ACTIVE` constant (line 23):

```ts
// (removed: const ACTIVE: OrderStatus[] = ['pending', 'preparing', 'en_route'];)
```

Replace the list filter (line 38-40):

```ts
  const list = orders.filter(({ order }) =>
    tab === 'en_cours' ? isActiveOrderStatus(order.status) : !isActiveOrderStatus(order.status),
  );
```

Replace the per-row `active` computation (line 69):

```ts
          const active = isActiveOrderStatus(o.status);
```

Replace the badge content (line 76) so it shows the real status label instead of a hardcoded "En route":

```ts
                  <Badge gold={active}>{active ? '● ' + orderStatusLabel(o.status) : orderStatusLabel(o.status)}</Badge>
```

- [ ] **Step 4: Overview in-progress table — shared label + pill, include `ready`**

Replace `components/admin/overview/InProgressTable.tsx` lines 4-19 (imports + the local `STATUS_LABEL`) with:

```ts
import { formatDH } from '@/lib/format';
import { orderStatusLabel, orderStatusPill } from '@/lib/order-status';
import type { Order } from '@/lib/types';

export interface InProgressRow {
  order: Order;
  driverName: string | null;
}

export interface InProgressTableProps {
  rows: InProgressRow[];
}
```

Then replace the status `<span>` (lines 78-90) so colours and label come from the shared helper:

```ts
                <td style={{ padding: '14px 22px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--ui-font)',
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: orderStatusPill(order.status).bg,
                      color: orderStatusPill(order.status).fg,
                    }}
                  >
                    {orderStatusLabel(order.status)}
                  </span>
                </td>
```

- [ ] **Step 5: Overview screen — in-progress filter includes `ready`**

In `components/admin/overview/OverviewScreen.tsx`, add to the `@/lib` imports (e.g. after the `@/lib/admin-overview` import block):

```ts
import { isInProgressOrderStatus } from '@/lib/order-status';
```

Replace the `inProgressRows` filter (lines 83-84):

```ts
    return data.orders
      .filter((o: Order) => isInProgressOrderStatus(o.status))
      .map((order) => ({ order, driverName: driverNameById(driverIdByOrder(order.id)) }));
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests pass (the `OrderStatus` import removal in OrdersScreen must not leave an unused import — confirm lint-clean).

Run: `NODE_OPTIONS="--max-old-space-size=4096" npm run build`
Expected: compiles successfully.

- [ ] **Step 7: Commit**

```bash
git add lib/queries.ts components/driver/DriverRequestsScreen.tsx components/driver/DriverDashboard.tsx components/screens/OrdersScreen.tsx components/admin/overview/InProgressTable.tsx components/admin/overview/OverviewScreen.tsx
git commit -m "feat: thread 'ready' status through driver pool, orders list and overview"
```

---

## Task 5: Admin data builders + server fetchers

**Files:**
- Create: `lib/admin-orders.ts`
- Test: `lib/__tests__/admin-orders.test.ts`
- Modify: `lib/queries.ts` (append `getAdminOrdersData`, `getKitchenOrdersData`)

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/admin-orders.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildAdminOrderRows, filterAdminOrders } from '@/lib/admin-orders';
import type { Order, OrderItem, OrderTracking } from '@/lib/types';

function order(p: Partial<Order> & { id: string }): Order {
  return {
    id: p.id,
    code: p.code ?? 'LV-0001',
    user_id: p.user_id ?? 'u1',
    status: p.status ?? 'preparing',
    mode: p.mode ?? 'livraison',
    address: p.address ?? 'Fès',
    zone_id: null,
    subtotal_dh: 0,
    delivery_fee_dh: 0,
    discount_dh: 0,
    total_dh: p.total_dh ?? 100,
    points_earned: 0,
    points_redeemed: 0,
    placed_at: p.placed_at ?? '2026-06-07T10:00:00Z',
    eta_at: null,
  };
}

describe('buildAdminOrderRows', () => {
  const orders = [order({ id: 'o1', code: 'LV-0001', user_id: 'u1', status: 'ready' }), order({ id: 'o2', code: 'LV-0002', user_id: 'u2' })];
  const items: OrderItem[] = [
    { id: 'i1', order_id: 'o1', product_id: 'p1', name_snapshot: 'Tarte', price_snapshot: 40, qty: 2, customization: {} },
    { id: 'i2', order_id: 'o2', product_id: 'p2', name_snapshot: 'Café', price_snapshot: 15, qty: 1, customization: {} },
  ];
  const tracking: OrderTracking[] = [
    { order_id: 'o1', stage: 1, progress: 0.3, eta_at: null, driver_id: 'd1', lat: null, lng: null, manual: true, updated_at: '2026-06-07T10:01:00Z' },
  ];
  const drivers = [{ id: 'd1', name: 'Karim' }];
  const profiles = [{ id: 'u1', full_name: 'Salma' }, { id: 'u2', full_name: 'Omar' }];

  it('groups items, resolves customer + driver names, matches tracking', () => {
    const rows = buildAdminOrderRows(orders, items, tracking, drivers, profiles);
    expect(rows).toHaveLength(2);
    expect(rows[0].order.id).toBe('o1');
    expect(rows[0].items.map((i) => i.name_snapshot)).toEqual(['Tarte']);
    expect(rows[0].customerName).toBe('Salma');
    expect(rows[0].driverName).toBe('Karim');
    expect(rows[0].tracking?.driver_id).toBe('d1');
  });

  it('leaves driverName/tracking null when no tracking row exists', () => {
    const rows = buildAdminOrderRows(orders, items, tracking, drivers, profiles);
    expect(rows[1].tracking).toBeNull();
    expect(rows[1].driverName).toBeNull();
    expect(rows[1].customerName).toBe('Omar');
  });
});

describe('filterAdminOrders', () => {
  const orders = [order({ id: 'o1', code: 'LV-1001', status: 'preparing' }), order({ id: 'o2', code: 'LV-2002', status: 'delivered' })];
  const rows = buildAdminOrderRows(orders, [], [], [], []);

  it('returns everything for status "all" and an empty query', () => {
    expect(filterAdminOrders(rows, { status: 'all', query: '' })).toHaveLength(2);
  });

  it('filters by status', () => {
    const r = filterAdminOrders(rows, { status: 'delivered', query: '' });
    expect(r.map((x) => x.order.id)).toEqual(['o2']);
  });

  it('matches the code case-insensitively and trims the query', () => {
    const r = filterAdminOrders(rows, { status: 'all', query: '  lv-10  ' });
    expect(r.map((x) => x.order.id)).toEqual(['o1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/admin-orders.test.ts`
Expected: FAIL — `Cannot find module '@/lib/admin-orders'`.

- [ ] **Step 3: Implement the builders**

Create `lib/admin-orders.ts`:

```ts
// Pure builders/filters for the admin Commandes screen. Shared by the server
// first-paint query and the client realtime refetch so both produce identical
// rows from the same raw Supabase shapes. No React, no I/O.
import type { Order, OrderItem, OrderStatus, OrderTracking } from '@/lib/types';

export interface AdminOrderRow {
  order: Order;
  items: OrderItem[];
  tracking: OrderTracking | null;
  customerName: string | null;
  driverName: string | null;
}

interface NamedDriver {
  id: string;
  name: string;
}
interface NamedProfile {
  id: string;
  full_name: string | null;
}

/** Join raw rows into per-order detail, preserving the `orders` order. */
export function buildAdminOrderRows(
  orders: Order[],
  items: OrderItem[],
  tracking: OrderTracking[],
  drivers: NamedDriver[],
  profiles: NamedProfile[],
): AdminOrderRow[] {
  const itemsByOrder = new Map<string, OrderItem[]>();
  for (const it of items) {
    const list = itemsByOrder.get(it.order_id);
    if (list) list.push(it);
    else itemsByOrder.set(it.order_id, [it]);
  }
  const trackingByOrder = new Map<string, OrderTracking>();
  for (const t of tracking) trackingByOrder.set(t.order_id, t);
  const driverName = new Map(drivers.map((d) => [d.id, d.name]));
  const customerName = new Map(profiles.map((p) => [p.id, p.full_name]));

  return orders.map((order) => {
    const t = trackingByOrder.get(order.id) ?? null;
    return {
      order,
      items: itemsByOrder.get(order.id) ?? [],
      tracking: t,
      customerName: customerName.get(order.user_id) ?? null,
      driverName: t?.driver_id ? driverName.get(t.driver_id) ?? null : null,
    };
  });
}

export interface AdminOrdersFilter {
  status: OrderStatus | 'all';
  query: string;
}

/** Client-side filter by status and order-code substring (case-insensitive). */
export function filterAdminOrders(rows: AdminOrderRow[], filter: AdminOrdersFilter): AdminOrderRow[] {
  const q = filter.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (filter.status !== 'all' && r.order.status !== filter.status) return false;
    if (q && !r.order.code.toLowerCase().includes(q)) return false;
    return true;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/admin-orders.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the server fetchers**

In `lib/queries.ts`, add to the top import from `@/lib/admin-orders`:

```ts
import { buildAdminOrderRows, type AdminOrderRow } from '@/lib/admin-orders';
```

Append to the end of `lib/queries.ts`:

```ts
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

export interface KitchenTicket {
  order: Order;
  items: OrderItem[];
}

/**
 * Orders currently in the kitchen (`preparing`), oldest first (FIFO), each with
 * its line items to prepare. Powers the Cuisine board; the client refetches the
 * same shapes on realtime changes.
 */
export async function getKitchenOrdersData(): Promise<KitchenTicket[]> {
  const supabase = await createServerSupabase();
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'preparing')
    .order('placed_at', { ascending: true });
  const list = (orders ?? []) as Order[];
  const ids = list.map((o) => o.id);
  const { data: items } = ids.length
    ? await supabase.from('order_items').select('*').in('order_id', ids)
    : { data: [] as OrderItem[] };

  const byOrder = new Map<string, OrderItem[]>();
  for (const it of (items ?? []) as OrderItem[]) {
    const cur = byOrder.get(it.order_id);
    if (cur) cur.push(it);
    else byOrder.set(it.order_id, [it]);
  }
  return list.map((order) => ({ order, items: byOrder.get(order.id) ?? [] }));
}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/admin-orders.ts lib/__tests__/admin-orders.test.ts lib/queries.ts
git commit -m "feat(admin): order/kitchen data builders + server fetchers"
```

---

## Task 6: Commandes screen (`/admin/orders`)

**Files:**
- Create: `components/admin/orders/OrderDetailPanel.tsx`
- Create: `components/admin/orders/OrdersAdminScreen.tsx`
- Create: `app/admin/orders/page.tsx`

> No new unit tests (presentational + realtime wiring); verification is `tsc` + `build` + the manual browser check in Step 5.

- [ ] **Step 1: Detail panel (presentational + action callbacks)**

Create `components/admin/orders/OrderDetailPanel.tsx`:

```tsx
// components/admin/orders/OrderDetailPanel.tsx
// Right-hand detail for the selected order: customer, items, totals, plus staff
// actions (mark ready, assign driver, cancel). Pure presentational — every write
// is delegated to a callback so the container owns the RPC + refetch.
'use client';
import { formatDH } from '@/lib/format';
import { orderStatusLabel, orderStatusPill } from '@/lib/order-status';
import type { AdminOrderRow } from '@/lib/admin-orders';
import type { Driver } from '@/lib/types';

export interface OrderDetailPanelProps {
  row: AdminOrderRow | null;
  drivers: Driver[];
  busy: boolean;
  onMarkReady: (orderId: string) => void;
  onAssignDriver: (orderId: string, driverId: string) => void;
  onCancel: (orderId: string) => void;
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid var(--line)',
  borderRadius: 18,
  boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)',
  overflow: 'hidden',
  alignSelf: 'start',
};

export function OrderDetailPanel({ row, drivers, busy, onMarkReady, onAssignDriver, onCancel }: OrderDetailPanelProps) {
  if (!row) {
    return (
      <div style={{ ...cardStyle, padding: '40px 22px', textAlign: 'center' }}>
        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>
          Sélectionnez une commande pour voir le détail.
        </span>
      </div>
    );
  }

  const { order, items, customerName, driverName } = row;
  const pill = orderStatusPill(order.status);
  const canCancel = order.status !== 'delivered' && order.status !== 'cancelled';

  return (
    <div style={cardStyle}>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 18, color: 'var(--ink)', margin: 0 }}>{order.code}</h2>
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>
            {customerName ?? 'Client'} · {order.mode === 'livraison' ? 'Livraison' : 'Retrait'}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: pill.bg, color: pill.fg }}>
          {orderStatusLabel(order.status)}
        </span>
      </div>

      <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it) => (
          <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--ink)' }}>
            <span>{it.qty} × {it.name_snapshot}</span>
            <span style={{ color: 'var(--muted)' }}>{formatDH(it.price_snapshot * it.qty)}</span>
          </div>
        ))}
        {items.length === 0 && (
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)' }}>Aucun article.</span>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 4, fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>
          <span>Total</span>
          <span>{formatDH(order.total_dh)}</span>
        </div>
        {order.address && (
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>{order.address}</div>
        )}
      </div>

      <div style={{ padding: '0 22px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {order.status === 'preparing' && (
          <button
            onClick={() => onMarkReady(order.id)}
            disabled={busy}
            style={{ width: '100%', border: 'none', borderRadius: 12, padding: '12px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: '#fff', background: 'var(--brand)', opacity: busy ? 0.6 : 1 }}
          >
            Marquer prête
          </button>
        )}

        <label style={{ fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
          Livreur {driverName ? `· ${driverName}` : '· non assigné'}
        </label>
        <select
          value={row.tracking?.driver_id ?? ''}
          disabled={busy}
          onChange={(e) => e.target.value && onAssignDriver(order.id, e.target.value)}
          style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 12, padding: '11px 12px', fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--ink)', background: '#fff' }}
        >
          <option value="">Assigner un livreur…</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        {canCancel && (
          <button
            onClick={() => onCancel(order.id)}
            disabled={busy}
            style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 12, padding: '11px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13.5, color: '#a23', background: '#fff', opacity: busy ? 0.6 : 1 }}
          >
            Annuler la commande
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Realtime container**

Create `components/admin/orders/OrdersAdminScreen.tsx`:

```tsx
// components/admin/orders/OrdersAdminScreen.tsx
// Live container for the admin Commandes screen. Renders the server snapshot,
// subscribes to postgres_changes on orders / order_items / order_tracking, and
// refetches the same raw shapes — rebuilt via lib/admin-orders.ts so server and
// client agree. Staff writes go through the 0015 RPCs, then a refetch.
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDH } from '@/lib/format';
import { orderStatusLabel, orderStatusPill, ACTIVE_ORDER_STATUSES } from '@/lib/order-status';
import { buildAdminOrderRows, filterAdminOrders, type AdminOrderRow } from '@/lib/admin-orders';
import type { AdminOrdersData } from '@/lib/queries';
import type { Driver, Order, OrderItem, OrderStatus, OrderTracking } from '@/lib/types';
import { OrderDetailPanel } from './OrderDetailPanel';

const STATUS_TABS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'preparing', label: 'En préparation' },
  { value: 'ready', label: 'Prêtes' },
  { value: 'en_route', label: 'En route' },
  { value: 'delivered', label: 'Livrées' },
  { value: 'cancelled', label: 'Annulées' },
];

export function OrdersAdminScreen({ initial }: { initial: AdminOrdersData }) {
  const [rows, setRows] = useState<AdminOrderRow[]>(initial.rows);
  const [drivers, setDrivers] = useState<Driver[]>(initial.drivers);
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(initial.rows[0]?.order.id ?? null);
  const [busy, setBusy] = useState(false);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .order('placed_at', { ascending: false })
      .limit(200);
    const list = (orders ?? []) as Order[];
    const ids = list.map((o) => o.id);
    const [itemsRes, trackingRes, driversRes, profilesRes] = await Promise.all([
      ids.length ? supabase.from('order_items').select('*').in('order_id', ids) : Promise.resolve({ data: [] as OrderItem[] }),
      ids.length ? supabase.from('order_tracking').select('*').in('order_id', ids) : Promise.resolve({ data: [] as OrderTracking[] }),
      supabase.from('drivers').select('*').order('name'),
      supabase.from('profiles').select('id, full_name'),
    ]);
    setDrivers((driversRes.data ?? []) as Driver[]);
    setRows(
      buildAdminOrderRows(
        list,
        (itemsRes.data ?? []) as OrderItem[],
        (trackingRes.data ?? []) as OrderTracking[],
        (driversRes.data ?? []) as Driver[],
        (profilesRes.data ?? []) as { id: string; full_name: string | null }[],
      ),
    );
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_tracking' }, refetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const visible = useMemo(() => filterAdminOrders(rows, { status, query }), [rows, status, query]);
  const selected = useMemo(() => rows.find((r) => r.order.id === selectedId) ?? null, [rows, selectedId]);

  const runRpc = useCallback(
    async (fn: string, params: Record<string, unknown>) => {
      setBusy(true);
      const supabase = createClient();
      await supabase.rpc(fn, params);
      setBusy(false);
      refetch();
    },
    [refetch],
  );

  const onMarkReady = (orderId: string) => runRpc('admin_mark_order_ready', { p_order: orderId });
  const onAssignDriver = (orderId: string, driverId: string) => runRpc('admin_assign_driver', { p_order: orderId, p_driver: driverId });
  const onCancel = (orderId: string) => runRpc('admin_set_order_status', { p_order: orderId, p_status: 'cancelled' });

  const activeCount = rows.filter((r) => (ACTIVE_ORDER_STATUSES as string[]).includes(r.order.status)).length;

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>Commandes</h1>
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
          {activeCount} commande{activeCount > 1 ? 's' : ''} active{activeCount > 1 ? 's' : ''}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatus(t.value)}
              style={{
                border: '1px solid var(--line)',
                borderRadius: 999,
                padding: '7px 14px',
                cursor: 'pointer',
                fontFamily: 'var(--ui-font)',
                fontSize: 13,
                fontWeight: 600,
                background: status === t.value ? 'var(--brand)' : '#fff',
                color: status === t.value ? '#fff' : 'var(--muted)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un code…"
          style={{ marginLeft: 'auto', border: '1px solid var(--line)', borderRadius: 12, padding: '9px 14px', fontFamily: 'var(--ui-font)', fontSize: 14, minWidth: 220 }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 22, alignItems: 'start' }}>
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
          {visible.length === 0 ? (
            <div style={{ padding: '28px 22px', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', textAlign: 'center' }}>
              Aucune commande.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Commande', 'Client', 'Total', 'Statut'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 18px', fontFamily: 'var(--ui-font)', fontSize: 11.5, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--muted)', background: 'var(--soft)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const pill = orderStatusPill(r.order.status);
                  const isSel = r.order.id === selectedId;
                  return (
                    <tr
                      key={r.order.id}
                      onClick={() => setSelectedId(r.order.id)}
                      style={{ borderTop: '1px solid var(--line)', cursor: 'pointer', background: isSel ? 'var(--soft)' : '#fff' }}
                    >
                      <td style={{ padding: '13px 18px', fontFamily: 'var(--ui-font)', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{r.order.code}</td>
                      <td style={{ padding: '13px 18px', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>{r.customerName ?? '—'}</td>
                      <td style={{ padding: '13px 18px', fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--ink)' }}>{formatDH(r.order.total_dh)}</td>
                      <td style={{ padding: '13px 18px' }}>
                        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: pill.bg, color: pill.fg }}>
                          {orderStatusLabel(r.order.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <OrderDetailPanel
          row={selected}
          drivers={drivers}
          busy={busy}
          onMarkReady={onMarkReady}
          onAssignDriver={onAssignDriver}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Server page**

Create `app/admin/orders/page.tsx`:

```tsx
import { getAdminOrdersData } from '@/lib/queries';
import { OrdersAdminScreen } from '@/components/admin/orders/OrdersAdminScreen';

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage() {
  const initial = await getAdminOrdersData();
  return <OrdersAdminScreen initial={initial} />;
}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit && NODE_OPTIONS="--max-old-space-size=4096" npm run build`
Expected: compiles; `/admin/orders` appears in the route list.

- [ ] **Step 5: Manual browser check (after 0015 applied)**

Sign in as `admin@lavilla.ma`, open `/admin/orders`. Confirm: the status tabs filter the list; the code search filters; clicking a row shows its detail; "Marquer prête" on a `preparing` order flips it to `Prête` live; assigning a driver shows the name; "Annuler la commande" sets `Annulée`.

- [ ] **Step 6: Commit**

```bash
git add components/admin/orders/OrderDetailPanel.tsx components/admin/orders/OrdersAdminScreen.tsx app/admin/orders/page.tsx
git commit -m "feat(admin): Commandes screen with live status + driver assignment"
```

---

## Task 7: Cuisine screen (`/admin/kitchen`)

**Files:**
- Create: `components/admin/kitchen/KitchenTicketCard.tsx`
- Create: `components/admin/kitchen/KitchenScreen.tsx`
- Create: `app/admin/kitchen/page.tsx`

- [ ] **Step 1: Ticket card (presentational)**

Create `components/admin/kitchen/KitchenTicketCard.tsx`:

```tsx
// components/admin/kitchen/KitchenTicketCard.tsx
// One kitchen ticket: order code, time waiting, mode, the items to prepare, and a
// "Marquer prête" action. Pure presentational — the action is a callback.
'use client';
import type { KitchenTicket } from '@/lib/queries';

function waitedLabel(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Depuis ${mins} min`;
  const h = Math.floor(mins / 60);
  return `Depuis ${h} h`;
}

export interface KitchenTicketCardProps {
  ticket: KitchenTicket;
  busy: boolean;
  onMarkReady: (orderId: string) => void;
}

export function KitchenTicketCard({ ticket, busy, onMarkReady }: KitchenTicketCardProps) {
  const { order, items } = ticket;
  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{order.code}</span>
        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: 'rgba(168,151,35,0.14)', color: 'var(--gold)' }}>
          {order.mode === 'livraison' ? 'Livraison' : 'Retrait'}
        </span>
      </div>
      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)' }}>{waitedLabel(order.placed_at)}</span>
        {items.map((it) => (
          <div key={it.id} style={{ fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>
            {it.qty} × {it.name_snapshot}
          </div>
        ))}
        {items.length === 0 && (
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)' }}>Aucun article.</span>
        )}
      </div>
      <div style={{ padding: '0 18px 16px' }}>
        <button
          onClick={() => onMarkReady(order.id)}
          disabled={busy}
          style={{ width: '100%', border: 'none', borderRadius: 12, padding: '12px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: '#fff', background: 'var(--brand)', opacity: busy ? 0.6 : 1 }}
        >
          Marquer prête
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Realtime container**

Create `components/admin/kitchen/KitchenScreen.tsx`:

```tsx
// components/admin/kitchen/KitchenScreen.tsx
// Live container for the Cuisine board. Renders the server snapshot of preparing
// orders, subscribes to postgres_changes on orders / order_items, and refetches
// the FIFO ticket list on any change. "Marquer prête" calls admin_mark_order_ready
// (0015); the order then leaves the board (it becomes 'ready') and enters the
// driver pool.
'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { KitchenTicket } from '@/lib/queries';
import type { Order, OrderItem } from '@/lib/types';
import { KitchenTicketCard } from './KitchenTicketCard';

export function KitchenScreen({ initial }: { initial: KitchenTicket[] }) {
  const [tickets, setTickets] = useState<KitchenTicket[]>(initial);
  const [busy, setBusy] = useState(false);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'preparing')
      .order('placed_at', { ascending: true });
    const list = (orders ?? []) as Order[];
    const ids = list.map((o) => o.id);
    const { data: items } = ids.length
      ? await supabase.from('order_items').select('*').in('order_id', ids)
      : { data: [] as OrderItem[] };
    const byOrder = new Map<string, OrderItem[]>();
    for (const it of (items ?? []) as OrderItem[]) {
      const cur = byOrder.get(it.order_id);
      if (cur) cur.push(it);
      else byOrder.set(it.order_id, [it]);
    }
    setTickets(list.map((order) => ({ order, items: byOrder.get(order.id) ?? [] })));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-kitchen')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, refetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const markReady = useCallback(
    async (orderId: string) => {
      setBusy(true);
      const supabase = createClient();
      await supabase.rpc('admin_mark_order_ready', { p_order: orderId });
      setBusy(false);
      refetch();
    },
    [refetch],
  );

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>Cuisine</h1>
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
          {tickets.length} commande{tickets.length > 1 ? 's' : ''} en préparation
        </p>
      </div>

      {tickets.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: '40px 22px', textAlign: 'center', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>
          Aucune commande en préparation.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18, alignItems: 'start' }}>
          {tickets.map((t) => (
            <KitchenTicketCard key={t.order.id} ticket={t} busy={busy} onMarkReady={markReady} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Server page**

Create `app/admin/kitchen/page.tsx`:

```tsx
import { getKitchenOrdersData } from '@/lib/queries';
import { KitchenScreen } from '@/components/admin/kitchen/KitchenScreen';

export const dynamic = 'force-dynamic';

export default async function AdminKitchenPage() {
  const initial = await getKitchenOrdersData();
  return <KitchenScreen initial={initial} />;
}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit && NODE_OPTIONS="--max-old-space-size=4096" npm run build`
Expected: compiles; `/admin/kitchen` appears in the route list.

- [ ] **Step 5: Manual cross-app sync check (after 0015 applied)**

With three windows (customer, driver, admin): place an order → it shows on the **Cuisine** board as `preparing`. Click **Marquer prête** → it leaves the kitchen, the customer order stays under "En cours", and it appears in the **driver pool** (`/driver/requests`). The driver accepts → it leaves the pool and the order goes `en_route`. Confirm the **Vue d'ensemble** "Commandes en cours" table reflects each transition live.

- [ ] **Step 6: Commit**

```bash
git add components/admin/kitchen/KitchenTicketCard.tsx components/admin/kitchen/KitchenScreen.tsx app/admin/kitchen/page.tsx
git commit -m "feat(admin): Cuisine board with mark-ready kitchen gate"
```

---

## Final review (after all tasks)

- [ ] Run the full suite + build once more: `npx vitest run && npx tsc --noEmit && NODE_OPTIONS="--max-old-space-size=4096" npm run build`.
- [ ] Confirm the cross-app flow end to end (Task 7 Step 5) with migration 0015 applied.
- [ ] Use `superpowers:finishing-a-development-branch` to wrap up.

---

## Self-review notes

- **Spec coverage:** Commandes (`/admin/orders`: list, status filter, code search, detail, manual status change, driver assignment) → Tasks 5–6. Cuisine (`/admin/kitchen`: preparing orders + items, mark ready) → Tasks 5, 7. The spec's "advances to `en_route` pool" is refined per the user's decision to a real `ready` gate (the pool now begins at `ready`) → Tasks 1–4.
- **Sync integrity:** the new `ready` status is added to the DB `CHECK`, the `OrderStatus` type, the driver RLS/pool/RPC, the auto-mover, the customer orders list, and the admin overview/orders/kitchen — every read/write site found in the status map is covered.
- **Type consistency:** `AdminOrderRow` is defined once in `lib/admin-orders.ts` and reused by the server fetcher and the client container. `KitchenTicket` / `AdminOrdersData` are defined in `lib/queries.ts` and imported by the components. RPC names (`admin_mark_order_ready`, `admin_set_order_status`, `admin_assign_driver`) match exactly between the migration and the `.rpc(...)` calls.
- **No placeholders:** every step ships complete code or an exact edit.
