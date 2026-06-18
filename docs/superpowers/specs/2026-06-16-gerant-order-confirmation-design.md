# Sub-project B — Manager (G.C) Order Confirmation Flow — Design

**Goal:** Insert a manager confirmation step into the order lifecycle. A client's
order waits in `pending` until the gérant (existing admin/staff account) reviews
it — optionally editing items, address, zone and delivery fee — then **Confirms**
it into the kitchen (`preparing`) or **Cancels** it. Confirmed orders flow on to
the kitchen → ready → driver, unchanged.

**Status:** Design approved (user said "go"). This is sub-project B of two; the
"smart address + auto-zone" work is sub-project A, to be done after.

---

## Current behaviour (baseline)

- `place_order` (migration 0004) inserts orders **directly as `preparing`**, picks
  a **random driver**, and creates the tracking row with that driver. There is no
  confirmation step today (`pending` exists in the schema but is unused —
  `lib/order-status.ts` even comments "never-used `pending`").
- Admin **Commandes** screen (`OrdersAdminScreen`) is a table with tabs
  `Toutes / En cours / À assigner / Terminées` (`lib/admin-orders.ts` `OrderTab`).
- Admin **Cuisine** board (`lib/kitchen.ts` + `KitchenScreen`) shows 3 columns:
  `En attente (pending) / En préparation (preparing) / Prêt (ready)`, with a
  "Démarrer la préparation" action (`admin_start_preparation`, migration 0021).
- Pricing rules live in `lib/pricing.ts` (`computeOrder`) for the client and are
  duplicated inside `place_order` server-side.

## New lifecycle

```
pending (à confirmer)  →  preparing (cuisine)  →  ready  →  en_route  →  delivered
        │                                                                   
        └──────────────────────────────────────────►  cancelled (motif)
```

`pending` now means **"awaiting gérant confirmation"**. Orders are not cooked and
no driver is assigned until confirmed.

---

## Components & changes

### 1. Lifecycle change — `place_order`
- Insert status **`pending`** (was `preparing`).
- **No auto-driver**: `v_driver := null`; tracking row created with `driver_id = null`.
- All money/loyalty math unchanged.

### 2. Pricing helper (DRY) — `lv_price_order(...)`
A SQL function returning `(subtotal, delivery, discount, total, earned)` from
`(items jsonb, zone uuid, mode text, promo bool, redeem_pts int, redeem_dh numeric,
user uuid)`, mirroring `lib/pricing.ts`. Used by **both** `place_order` and the
edit RPCs so recomputation never diverges.

### 3. Item edit / delivery edit / confirm / cancel RPCs (staff-gated)
All guard `lv_is_staff()` and only mutate while the order is `pending` (except
cancel, which works on any non-terminal status). On no-op → raise.
- `admin_update_order_items(p_order uuid, p_items jsonb)` — replace `order_items`
  (snapshotting `name`/`price` from `products`), recompute money via
  `lv_price_order`, update the order row.
- `admin_update_order_delivery(p_order uuid, p_address text, p_zone uuid)` — set
  address/zone, recompute delivery + total via `lv_price_order`.
- `admin_confirm_order(p_order uuid)` — `pending → preparing`; notify the client
  ("Commande confirmée"). (Distinct notification from `admin_start_preparation`.)
- `admin_cancel_order(p_order uuid, p_reason text)` — `→ cancelled`; notify the
  client with the reason. (Generalises `admin_set_order_status('cancelled')`.)

### 4. Kitchen reconciliation
- `lib/kitchen.ts` `buildKitchenBoard` no longer emits a `pending` column — only
  `preparing` + `ready`. Station load + late logic now consider preparing/ready.
- `KitchenScreen` renders **2 columns** (En préparation · Prêt). The
  "Démarrer la préparation" action and the pending column are removed (confirmation
  now lives in Commandes). `admin_start_preparation` becomes unused (kept in DB,
  harmless) — its UI is gone.
- Update `lib/kitchen.ts` tests accordingly.

### 5. Admin Commandes — "À confirmer" tab + edit panel
- `lib/admin-orders.ts`: add an `OrderTab` value `toconfirm` matching `pending`;
  include it in `countOrdersByTab` and `filterAdminOrdersByTab`. Add tests.
- `OrdersAdminScreen`: render the new tab (with count badge); a row in this tab
  opens `OrderConfirmPanel`.
- **`OrderConfirmPanel.tsx`** (new client component): modal showing the order.
  - Items list with qty steppers + remove; an "Ajouter un article" product picker
    (searchable list from `products`). Live total preview via `lib/order-confirm.ts`.
  - Delivery section: address text, zone select, fee preview.
  - Actions: **Confirmer** → (persist any edits via the edit RPCs, then
    `admin_confirm_order`) → close + refetch; **Annuler** → reason prompt →
    `admin_cancel_order`.
  - Edits autosave on Confirm: panel computes the diff and calls
    `admin_update_order_items` / `admin_update_order_delivery` as needed before
    `admin_confirm_order`.

### 6. Customer-facing
- `lib/order-status.ts`: `pending` label already "En attente"; ensure the tracking
  screen shows a clear "En attente de confirmation" state for `pending` and does
  not imply cooking. Live update on confirm already works (realtime + notifications).

### 7. Pure logic + tests — `lib/order-confirm.ts`
- `recomputeTotals(items, opts)` mirroring `computeOrder` (reuse `lib/pricing.ts`).
- `applyItemEdit` helpers (set qty, remove, add) producing the new item list.
- Validation (qty ≥ 1, at least one item to confirm). Vitest covered.

---

## Data flow

1. Client checkout → `place_order` → order `pending`, no driver, client sees
   "En attente de confirmation".
2. Gérant opens Commandes → "À confirmer" → `OrderConfirmPanel`.
3. Gérant edits (optional) → edits persisted via `admin_update_order_*` (recompute
   server-side) → **Confirmer** → `admin_confirm_order` → `preparing`.
4. Order now appears in the Cuisine board (preparing) → ready → driver pool →
   driver takes it (existing flow, unchanged).
5. Or **Annuler** → `cancelled` + client notified.

## Error handling
- RPCs raise `forbidden` (non-staff), `not_pending` (editing/confirming a non-pending
  order), `not_found` (unknown order). The panel surfaces these as toasts.
- Money is always recomputed server-side from `products` — client totals never trusted.
- Editing is blocked once an order leaves `pending` (panel disables actions if the
  realtime refetch shows the status changed).

## Migrations (idempotent, applied by the user in Supabase SQL editor)
- `0023_order_pending_and_pricing.sql` — `lv_price_order` + `place_order` (→ pending,
  no driver).
- `0024_admin_order_confirm.sql` — `admin_update_order_items`,
  `admin_update_order_delivery`, `admin_confirm_order`, `admin_cancel_order`.

## Testing
- `lib/order-confirm.ts` and updated `lib/kitchen.ts` / `lib/admin-orders.ts` unit
  tested (vitest). Build + tsc + eslint green. Live end-to-end smoke test against the
  DB (create pending order → edit → confirm → appears in kitchen → cleanup), as done
  for previous features.

## Out of scope (sub-project A, later)
Google Places autocomplete, lat/lng on addresses, zone polygons / auto-zone detection.
The delivery edit here uses the existing manual zone select.
