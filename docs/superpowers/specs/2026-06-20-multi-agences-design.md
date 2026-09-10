# Multi-agences (multi-branch) — Design

**Goal:** Turn the two hardcoded La Villa shops into real operating agencies, so each
order, driver, delivery zone, product availability and admin view belongs to a
branch. Customers are served by the branch covering their delivery zone; each agency
has its own gérant who only sees its own activity.

**Context:** Today everything is global. The two shops live as a static list in
`lib/branches.ts` (slugs `riad`, `badie`). Nothing in the database carries a branch.

## Decisions (confirmed with the owner)

1. **Delivery routing — by zone.** Each `delivery_zones` row belongs to one branch.
   A delivery order is attributed to the branch of the customer's zone. Pickup
   (`retrait`) orders are attributed to the branch the customer picked.
2. **Stock — per branch.** A product can be in stock at Riad but out at Badie.
   Availability is tracked per (product, branch). The customer catalogue shows the
   availability of the branch that will serve them.
3. **Admin — one gérant per agency.** A staff account is tied to a branch and only
   sees that branch's orders, kitchen, drivers, stats and stock (RLS-enforced). A
   `branch_id = null` staff is a super-admin who sees everything.

## Phased delivery (each phase ships + is testable on its own)

### Phase 2a — Branch foundation & attribution  *(additive, low risk)*
- **`branches`** table: `id, slug, name, address, phone, plus_code, lat, lng,
  is_active, created_at`. Seeded with `riad` + `badie` (same slugs as
  `lib/branches.ts`, which stays as the display source; the table is the relational
  key). A `lib/branches.ts` helper maps slug → branch id.
- **`delivery_zones.branch_id`**, **`drivers.branch_id`**, **`orders.branch_id`**
  (all FK → branches). Existing rows backfilled to the default branch (`riad`).
- **`place_order`** sets `orders.branch_id`: `retrait` → chosen pickup branch;
  `livraison` → the zone's `branch_id` (fallback default).
- **Driver board** (`getDriverBoard` / RLS) filtered to the driver's branch, so a
  Riad driver never sees Badie orders.
- **Admin branch switcher** (Toutes / Riad / Badie) on Orders, Kitchen, Drivers,
  Overview — a client-side filter for now (hard isolation comes in 2c).
- **Admin assignment UI**: set a driver's branch (driver edit modal) and a zone's
  branch (zones screen).

### Phase 2b — Per-branch stock
- **`product_branch`** table: `(product_id, branch_id, in_stock bool default true,
  primary key (product_id, branch_id))`. Absent row ⇒ available (default true).
- Customer catalogue resolves the viewer's branch (from default address' zone, or a
  branch chooser on Home) and shows that branch's availability.
- Admin Produits: stock toggle per branch (replaces the single global toggle, which
  becomes the catalogue-wide `active`).

### Phase 2c — Per-branch gérant (RLS isolation)
- **`profiles.branch_id`** for staff (null = super-admin).
- **`lv_staff_branch()`** helper; every admin RPC + RLS policy scoped:
  `branch_id = lv_staff_branch() or lv_staff_branch() is null`.
- Provisioning: super-admin creates a gérant account bound to a branch.
- Touches: orders/kitchen/drivers/products/stats RPCs + policies. Tested per-RPC
  via simulated `request.jwt.claims` before/after.

## Data flow (after all phases)

```
customer picks zone ──▶ zone.branch_id ──▶ order.branch_id
                                              │
            driver.branch_id == order.branch_id ──▶ appears on driver board
                                              │
        staff.branch_id == order.branch_id (or super-admin) ──▶ visible in admin
```

## Testing
- Each migration applied via MCP and verified live (column presence, FK, backfill).
- `place_order` branch attribution tested with a simulated order per mode.
- Driver board branch filter: simulate two drivers in two branches, assert each sees
  only its branch's orders.
- 2c RLS: simulate a branch gérant `request.jwt.claims`, assert cross-branch reads
  return nothing.
- Pure helpers (slug→branch map, viewer-branch resolver) unit-tested with vitest.

## Out of scope (YAGNI for now)
- Per-branch pricing, per-branch promos (promos come in sub-project #3, branch-aware
  by inheriting `order.branch_id`), inter-branch transfers, per-branch opening hours.
