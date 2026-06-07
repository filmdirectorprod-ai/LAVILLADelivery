# Admin Phase 2 — Vue d'ensemble (live dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the live `/admin` overview dashboard — KPI cards, an hourly order-activity chart, a live driver map, and an in-progress orders table — that stays synchronized in real time with the customer and driver apps.

**Architecture:** Pure, unit-tested helpers (`lib/admin-overview.ts`) compute every derived number from raw rows. A server query (`getAdminOverviewData`) renders the first paint; a `'use client'` container (`OverviewScreen`) re-fetches the same raw rows on every relevant `postgres_changes` event (the exact refetch pattern already used by `DriverRequestsScreen`) and recomputes via the shared helpers. Presentational components are dumb and prop-driven.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (`@supabase/ssr` + Realtime), `@googlemaps/js-api-loader`, Vitest. All UI in French. Design tokens from `app/globals.css` (`--brand #137c8b`, `--brand-d #0f606b`, `--gold #a89723`, `--ink`, `--muted`, `--line`, `--soft`); cards `#fff`, `1px solid var(--line)`, radius 18, shadow `0 6px 18px -14px rgba(0,0,0,0.3)`.

---

## Context the implementer needs

**Prerequisites already shipped (Phase 1):** migration `0014_admin_staff.sql` is applied (staff RLS read policies on `orders`, `order_items`, `order_tracking`, `drivers`, `reviews`, `profiles`; `drivers.is_online`/`drivers.last_seen`; realtime publication for `order_tracking`, `drivers`, `reviews`). `orders` was already in the realtime publication from earlier migrations. The `admin@lavilla.ma` account exists with `profiles.is_staff = true`. The `/admin` route is gated by `app/admin/layout.tsx` → `getMyStaff()` → `AdminGate | AdminChrome`. The overview page is currently a placeholder at `app/admin/page.tsx`.

**No new migration is required for Phase 2.** Everything reads existing tables.

**The realtime + refetch pattern to copy** (from `components/driver/DriverRequestsScreen.tsx`):
```tsx
const refetch = useCallback(async () => {
  const supabase = createClient();
  const { data } = await supabase.from('orders').select('...').in('status', [...]);
  setState(map(data ?? []));
}, []);

useEffect(() => {
  const supabase = createClient();
  const channel = supabase
    .channel('driver-requests')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refetch)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'order_tracking' }, refetch)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [refetch]);
```
- Browser client: `import { createClient } from '@/lib/supabase/client';`
- Server client: `import { createServerSupabase } from '@/lib/supabase/server';` (async).
- `formatDH` from `@/lib/format` → `165` becomes `"165,00 DH"`.
- Maps key: `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (may be undefined → render a graceful fallback panel, never crash).

**Existing types** (`lib/types.ts`): `Order` (`status`, `total_dh`, `placed_at`, `code`, `mode`, `address`, `user_id`), `OrderStatus = 'pending'|'preparing'|'en_route'|'delivered'|'cancelled'`, `Driver` (`id`, `name`, `rating`, `vehicle`), `OrderTracking` (`driver_id`, `lat`, `lng`, `updated_at`), `Review` (`rating`). Phase 2 extends `Driver` with `is_online` / `last_seen`.

**Build / test commands:**
- Tests: `npx vitest run`
- Build (memory-bumped, lint is strict — `@typescript-eslint/no-unused-vars` is an ERROR): `NODE_OPTIONS="--max-old-space-size=4096" npm run build`

**"Incidents ouverts" KPI is intentionally deferred to Phase 5** (the `incidents` table does not exist yet). Phase 2 ships four KPI cards. Do not fake an incidents number.

---

## File structure

| File | Responsibility |
|------|----------------|
| `lib/admin-overview.ts` (create) | Pure helpers: `startOfTodayISO`, `bucketOrdersByHour`, `computeOverviewKpis`, `latestDriverPositions`. No I/O, no React. |
| `lib/__tests__/admin-overview.test.ts` (create) | Unit tests for the helpers. |
| `lib/types.ts` (modify) | Add `is_online?: boolean` and `last_seen?: string | null` to `Driver`. |
| `lib/queries.ts` (modify) | Add `AdminOverviewData` interface + `getAdminOverviewData()` (server, RLS). |
| `components/admin/overview/KpiCard.tsx` (create) | One presentational KPI card. |
| `components/admin/overview/HourlyChart.tsx` (create) | Bar chart of orders/hour with a peak marker (pure CSS bars, no chart lib). |
| `components/admin/overview/InProgressTable.tsx` (create) | Table of in-progress orders. |
| `components/admin/overview/LiveDriverMap.tsx` (create) | Multi-marker Google map of online drivers + no-key fallback. |
| `components/admin/overview/OverviewScreen.tsx` (create) | `'use client'` container: state, realtime subscriptions, refetch, layout. |
| `app/admin/page.tsx` (replace) | Server component: `getAdminOverviewData()` → `<OverviewScreen initial={...} mapsKey={...} />`. |

Vitest already resolves `@/` to the repo root (see existing `lib/__tests__/admin-nav.test.ts`).

---

### Task 1: Pure overview helpers + unit tests

**Files:**
- Create: `lib/admin-overview.ts`
- Test: `lib/__tests__/admin-overview.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/__tests__/admin-overview.test.ts
import { describe, it, expect } from 'vitest';
import {
  startOfTodayISO,
  bucketOrdersByHour,
  computeOverviewKpis,
  latestDriverPositions,
} from '@/lib/admin-overview';

describe('startOfTodayISO', () => {
  it('returns midnight (local) of the given date as an ISO string', () => {
    const ref = new Date(2026, 5, 7, 14, 30, 0); // 7 Jun 2026 14:30 local
    const iso = startOfTodayISO(ref);
    const back = new Date(iso);
    expect(back.getFullYear()).toBe(2026);
    expect(back.getMonth()).toBe(5);
    expect(back.getDate()).toBe(7);
    expect(back.getHours()).toBe(0);
    expect(back.getMinutes()).toBe(0);
  });
});

describe('bucketOrdersByHour', () => {
  it('counts orders into 24 hour buckets by placed_at local hour', () => {
    const orders = [
      { placed_at: new Date(2026, 5, 7, 9, 5).toISOString() },
      { placed_at: new Date(2026, 5, 7, 9, 50).toISOString() },
      { placed_at: new Date(2026, 5, 7, 13, 1).toISOString() },
    ];
    const buckets = bucketOrdersByHour(orders);
    expect(buckets).toHaveLength(24);
    expect(buckets[9]).toBe(2);
    expect(buckets[13]).toBe(1);
    expect(buckets[0]).toBe(0);
  });

  it('returns 24 zeros for no orders', () => {
    expect(bucketOrdersByHour([])).toEqual(new Array(24).fill(0));
  });
});

describe('computeOverviewKpis', () => {
  const orders = [
    { status: 'preparing', total_dh: 100 },
    { status: 'en_route', total_dh: 50 },
    { status: 'delivered', total_dh: 200 },
    { status: 'cancelled', total_dh: 999 },
  ];
  const drivers = [
    { is_online: true },
    { is_online: true },
    { is_online: false },
  ];
  const ratings = [5, 4, 3];

  it('counts today orders and in-progress orders', () => {
    const k = computeOverviewKpis({ orders, drivers, ratings });
    expect(k.ordersToday).toBe(4);
    expect(k.inProgress).toBe(2); // preparing + en_route
  });

  it('sums revenue of non-cancelled orders only', () => {
    const k = computeOverviewKpis({ orders, drivers, ratings });
    expect(k.revenueToday).toBe(350); // 100 + 50 + 200
  });

  it('reports online / total drivers', () => {
    const k = computeOverviewKpis({ orders, drivers, ratings });
    expect(k.driversOnline).toBe(2);
    expect(k.driversTotal).toBe(3);
  });

  it('averages ratings and counts them', () => {
    const k = computeOverviewKpis({ orders, drivers, ratings });
    expect(k.ratingAvg).toBeCloseTo(4, 5);
    expect(k.ratingCount).toBe(3);
  });

  it('returns ratingAvg 0 when there are no ratings', () => {
    const k = computeOverviewKpis({ orders, drivers: [], ratings: [] });
    expect(k.ratingAvg).toBe(0);
    expect(k.ratingCount).toBe(0);
  });
});

describe('latestDriverPositions', () => {
  it('returns one newest position per online driver that has coords', () => {
    const drivers = [
      { id: 'd1', name: 'Karim', is_online: true },
      { id: 'd2', name: 'Yassine', is_online: false }, // offline → excluded
      { id: 'd3', name: 'Omar', is_online: true }, // no tracking → excluded
    ];
    const tracking = [
      { driver_id: 'd1', lat: 34.01, lng: -5.0, updated_at: '2026-06-07T10:00:00Z' },
      { driver_id: 'd1', lat: 34.04, lng: -4.99, updated_at: '2026-06-07T10:05:00Z' }, // newer
      { driver_id: 'd2', lat: 34.02, lng: -4.98, updated_at: '2026-06-07T10:01:00Z' },
    ];
    const pts = latestDriverPositions(drivers, tracking);
    expect(pts).toHaveLength(1);
    expect(pts[0]).toEqual({ id: 'd1', name: 'Karim', lat: 34.04, lng: -4.99 });
  });

  it('ignores tracking rows with null coords', () => {
    const drivers = [{ id: 'd1', name: 'Karim', is_online: true }];
    const tracking = [{ driver_id: 'd1', lat: null, lng: null, updated_at: '2026-06-07T10:00:00Z' }];
    expect(latestDriverPositions(drivers, tracking)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/__tests__/admin-overview.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/admin-overview"` / functions not defined.

- [ ] **Step 3: Write the implementation**

```ts
// lib/admin-overview.ts
// Pure, side-effect-free helpers for the admin Vue d'ensemble. Every derived
// number on the dashboard is computed here from raw rows, so the same logic
// serves the server first-paint and the client realtime refetch, and stays unit
// testable. No React, no I/O.

/** Midnight (local time) of `ref` (default: now) as an ISO string — the lower
 *  bound for "today's" orders. Local time matches the single venue's day. */
export function startOfTodayISO(ref: Date = new Date()): string {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
  return d.toISOString();
}

/** Count orders into 24 buckets keyed by the local hour of `placed_at`. */
export function bucketOrdersByHour(orders: { placed_at: string }[]): number[] {
  const buckets = new Array(24).fill(0);
  for (const o of orders) {
    const h = new Date(o.placed_at).getHours();
    if (h >= 0 && h < 24) buckets[h] += 1;
  }
  return buckets;
}

export interface OverviewKpiInput {
  orders: { status: string; total_dh: number }[];
  drivers: { is_online?: boolean }[];
  ratings: number[];
}

export interface OverviewKpis {
  ordersToday: number;
  inProgress: number;
  revenueToday: number;
  driversOnline: number;
  driversTotal: number;
  ratingAvg: number;
  ratingCount: number;
}

/** Headline numbers for the KPI cards, derived from today's raw rows. Revenue
 *  excludes cancelled orders; in-progress = preparing + en_route. */
export function computeOverviewKpis({ orders, drivers, ratings }: OverviewKpiInput): OverviewKpis {
  const inProgress = orders.filter((o) => o.status === 'preparing' || o.status === 'en_route').length;
  const revenueToday = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (o.total_dh ?? 0), 0);
  const driversOnline = drivers.filter((d) => d.is_online).length;
  const ratingCount = ratings.length;
  const ratingAvg = ratingCount === 0 ? 0 : ratings.reduce((a, b) => a + b, 0) / ratingCount;
  return {
    ordersToday: orders.length,
    inProgress,
    revenueToday,
    driversOnline,
    driversTotal: drivers.length,
    ratingAvg,
    ratingCount,
  };
}

export interface DriverPosition {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface PositionDriver {
  id: string;
  name: string;
  is_online?: boolean;
}
interface PositionTracking {
  driver_id: string | null;
  lat: number | null;
  lng: number | null;
  updated_at: string;
}

/** Newest known GPS position for each ONLINE driver that has streamed coords.
 *  Offline drivers and drivers without coords are omitted. */
export function latestDriverPositions(
  drivers: PositionDriver[],
  tracking: PositionTracking[],
): DriverPosition[] {
  const newest = new Map<string, PositionTracking>();
  for (const t of tracking) {
    if (!t.driver_id || t.lat == null || t.lng == null) continue;
    const prev = newest.get(t.driver_id);
    if (!prev || Date.parse(t.updated_at) > Date.parse(prev.updated_at)) {
      newest.set(t.driver_id, t);
    }
  }
  const out: DriverPosition[] = [];
  for (const d of drivers) {
    if (!d.is_online) continue;
    const t = newest.get(d.id);
    if (!t || t.lat == null || t.lng == null) continue;
    out.push({ id: d.id, name: d.name, lat: t.lat, lng: t.lng });
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/admin-overview.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add lib/admin-overview.ts lib/__tests__/admin-overview.test.ts
git commit -m "feat(admin): pure overview helpers (kpis, hourly buckets, driver positions)"
```

---

### Task 2: Driver type extension + server data query

**Files:**
- Modify: `lib/types.ts` (the `Driver` interface, lines 59-68)
- Modify: `lib/queries.ts` (append a new query + interface; imports at top)

- [ ] **Step 1: Add the online columns to the `Driver` type**

In `lib/types.ts`, replace the `Driver` interface with:

```ts
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
```

- [ ] **Step 2: Add the server query to `lib/queries.ts`**

At the top of `lib/queries.ts`, add `startOfTodayISO` to the imports (after the existing `import { createServerSupabase } ...` line):

```ts
import { startOfTodayISO } from '@/lib/admin-overview';
```

Append at the end of `lib/queries.ts`:

```ts
export interface AdminOverviewData {
  /** Today's orders (placed_at >= local midnight), newest first. */
  orders: Order[];
  /** All drivers (for online/total counts, names, ratings). */
  drivers: Driver[];
  /** Every review's rating (for the average + count KPI). */
  ratings: number[];
  /** Driver GPS rows with coords, for the live map. */
  tracking: Pick<OrderTracking, 'driver_id' | 'lat' | 'lng' | 'updated_at'>[];
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
      .select('driver_id, lat, lng, updated_at')
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
```

- [ ] **Step 3: Type-check the changes compile**

Run: `npx tsc --noEmit`
Expected: PASS — no type errors (the `OrderTracking` `Pick` matches the selected columns; `Order`/`Driver`/`OrderTracking` are already imported at the top of `queries.ts`).

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/queries.ts
git commit -m "feat(admin): getAdminOverviewData query + driver presence type"
```

---

### Task 3: Presentational KPI card, hourly chart, in-progress table

**Files:**
- Create: `components/admin/overview/KpiCard.tsx`
- Create: `components/admin/overview/HourlyChart.tsx`
- Create: `components/admin/overview/InProgressTable.tsx`

These are dumb, prop-driven components. No realtime here. (No unit tests — they are pure presentation; they are exercised by the build + the manual check in Task 6.)

- [ ] **Step 1: Create `KpiCard.tsx`**

```tsx
// components/admin/overview/KpiCard.tsx
// One presentational KPI card for the admin overview. Icon + value + label,
// with an optional sub-line and accent colour. Prop-driven only.
import { Icon } from '@/components/ui/Icon';

export interface KpiCardProps {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

export function KpiCard({ icon, label, value, sub, accent }: KpiCardProps) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: 18,
        padding: '18px 20px',
        boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          background: accent ? 'var(--brand)' : 'var(--soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={20} color={accent ? '#fff' : 'var(--brand-d)'} />
      </div>
      <div>
        <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 24, color: 'var(--ink)', lineHeight: 1.1 }}>
          {value}
        </div>
        <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>{label}</div>
        {sub && (
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--brand-d)', fontWeight: 600, marginTop: 4 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `HourlyChart.tsx`**

```tsx
// components/admin/overview/HourlyChart.tsx
// Orders-per-hour bar chart for "today", with the peak hour highlighted in gold.
// Pure CSS bars (no chart library). `buckets` is a length-24 array from
// bucketOrdersByHour.
export interface HourlyChartProps {
  buckets: number[];
}

export function HourlyChart({ buckets }: HourlyChartProps) {
  const max = Math.max(1, ...buckets);
  const peak = buckets.indexOf(Math.max(...buckets));
  const anyOrders = buckets.some((b) => b > 0);
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: 18,
        padding: '20px 22px',
        boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 16, color: 'var(--ink)', margin: 0 }}>
          Activité des commandes — aujourd&apos;hui
        </h2>
        {anyOrders && (
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>
            Pic à {String(peak).padStart(2, '0')}h
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 140 }}>
        {buckets.map((count, h) => (
          <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <div
              title={`${count} commande${count > 1 ? 's' : ''} à ${String(h).padStart(2, '0')}h`}
              style={{
                width: '100%',
                height: `${(count / max) * 110}px`,
                minHeight: count > 0 ? 4 : 0,
                borderRadius: 4,
                background: anyOrders && h === peak ? 'var(--gold)' : 'var(--brand)',
                opacity: count > 0 ? 1 : 0.12,
                transition: 'height 0.3s ease',
              }}
            />
            {h % 3 === 0 && (
              <span style={{ fontFamily: 'var(--ui-font)', fontSize: 10, color: 'var(--muted)' }}>{h}h</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `InProgressTable.tsx`**

```tsx
// components/admin/overview/InProgressTable.tsx
// Table of in-progress orders (preparing / en_route) for the overview. Shows the
// order code, mode, total, status pill and assigned driver. Prop-driven.
import { formatDH } from '@/lib/format';
import type { Order } from '@/lib/types';

export interface InProgressRow {
  order: Order;
  driverName: string | null;
}

export interface InProgressTableProps {
  rows: InProgressRow[];
}

const STATUS_LABEL: Record<string, string> = {
  preparing: 'En préparation',
  en_route: 'En route',
};

export function InProgressTable({ rows }: InProgressTableProps) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: 18,
        boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
        <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 16, color: 'var(--ink)', margin: 0 }}>
          Commandes en cours
        </h2>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: '28px 22px', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', textAlign: 'center' }}>
          Aucune commande en cours pour l&apos;instant.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Commande', 'Mode', 'Total', 'Statut', 'Livreur'].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: '12px 22px',
                    fontFamily: 'var(--ui-font)',
                    fontSize: 11.5,
                    fontWeight: 600,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                    background: 'var(--soft)',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ order, driverName }) => (
              <tr key={order.id} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '14px 22px', fontFamily: 'var(--ui-font)', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                  {order.code}
                </td>
                <td style={{ padding: '14px 22px', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>
                  {order.mode === 'livraison' ? 'Livraison' : 'Retrait'}
                </td>
                <td style={{ padding: '14px 22px', fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--ink)' }}>
                  {formatDH(order.total_dh)}
                </td>
                <td style={{ padding: '14px 22px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--ui-font)',
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: order.status === 'en_route' ? 'rgba(19,124,139,0.12)' : 'rgba(168,151,35,0.14)',
                      color: order.status === 'en_route' ? 'var(--brand-d)' : 'var(--gold)',
                    }}
                  >
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                </td>
                <td style={{ padding: '14px 22px', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: driverName ? 'var(--ink)' : 'var(--muted)' }}>
                  {driverName ?? 'Non assigné'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify the components compile**

Run: `npx tsc --noEmit`
Expected: PASS — no type errors.

- [ ] **Step 5: Commit**

```bash
git add components/admin/overview/KpiCard.tsx components/admin/overview/HourlyChart.tsx components/admin/overview/InProgressTable.tsx
git commit -m "feat(admin): overview presentational components (kpi card, hourly chart, table)"
```

---

### Task 4: Live driver map (multi-marker)

**Files:**
- Create: `components/admin/overview/LiveDriverMap.tsx`

This is a focused multi-marker map — distinct from `GoogleDeliveryMap` (which is single-route/single-driver). It plots one marker per online driver and refits bounds when the set changes. If no API key, it renders a friendly fallback panel listing the online drivers (never crashes).

- [ ] **Step 1: Create `LiveDriverMap.tsx`**

```tsx
// components/admin/overview/LiveDriverMap.tsx
// Live map of online drivers for the admin overview. Unlike GoogleDeliveryMap
// (one driver, one animated route), this plots a marker per driver position and
// refits the viewport when positions change. With no Maps key it degrades to a
// readable list so the dashboard never breaks.
'use client';
import { useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import type { DriverPosition } from '@/lib/admin-overview';

// La Villa — Av. Hassan II, Ville Nouvelle, Fès (delivery origin).
const ORIGIN = { lat: 34.0331, lng: -4.9998 };

export interface LiveDriverMapProps {
  apiKey: string | undefined;
  positions: DriverPosition[];
}

export function LiveDriverMap({ apiKey, positions }: LiveDriverMapProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());

  // One-time map init.
  useEffect(() => {
    if (!apiKey || !divRef.current) return;
    let cancelled = false;
    const loader = new Loader({ apiKey, version: 'weekly' });
    loader
      .load()
      .then(() => {
        if (cancelled || !divRef.current) return;
        const map = new google.maps.Map(divRef.current, {
          center: ORIGIN,
          zoom: 13,
          disableDefaultUI: true,
          clickableIcons: false,
          styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
        });
        mapRef.current = map;
        new google.maps.Marker({
          position: ORIGIN,
          map,
          title: 'La Villa',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: '#A89723',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 3,
          },
        });
      })
      .catch(() => {
        /* load failed — fallback panel covers it */
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  // Sync markers whenever positions change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const live = markersRef.current;
    const seen = new Set<string>();

    for (const p of positions) {
      seen.add(p.id);
      const existing = live.get(p.id);
      if (existing) {
        existing.setPosition({ lat: p.lat, lng: p.lng });
      } else {
        live.set(
          p.id,
          new google.maps.Marker({
            position: { lat: p.lat, lng: p.lng },
            map,
            title: p.name,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: '#137C8B',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 4,
            },
          }),
        );
      }
    }
    // Drop markers for drivers no longer online.
    for (const [id, marker] of live) {
      if (!seen.has(id)) {
        marker.setMap(null);
        live.delete(id);
      }
    }
    // Frame origin + all drivers.
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(ORIGIN);
    for (const p of positions) bounds.extend({ lat: p.lat, lng: p.lng });
    if (positions.length > 0) map.fitBounds(bounds, 60);
  }, [positions]);

  const shellStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid var(--line)',
    borderRadius: 18,
    boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)',
    overflow: 'hidden',
    height: 320,
    position: 'relative',
  };

  if (!apiKey) {
    return (
      <div style={shellStyle}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
          <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 16, color: 'var(--ink)', margin: 0 }}>
            Suivi des livreurs · en direct
          </h2>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto' }}>
          {positions.length === 0 ? (
            <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>
              Aucun livreur en ligne pour l&apos;instant.
            </span>
          ) : (
            positions.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--brand)' }} />
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{p.name}</span>
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)' }}>
                  {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1, padding: '14px 22px', background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0))' }}>
        <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 16, color: 'var(--ink)', margin: 0 }}>
          Suivi des livreurs · en direct
        </h2>
      </div>
      <div ref={divRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS — `google.maps.*` types resolve (the app already depends on `@googlemaps/js-api-loader` and `@types/google.maps`, used by `GoogleDeliveryMap.tsx`).

- [ ] **Step 3: Commit**

```bash
git add components/admin/overview/LiveDriverMap.tsx
git commit -m "feat(admin): live multi-marker driver map with no-key fallback"
```

---

### Task 5: Realtime overview container + page wiring

**Files:**
- Create: `components/admin/overview/OverviewScreen.tsx`
- Replace: `app/admin/page.tsx`

- [ ] **Step 1: Create `OverviewScreen.tsx`**

```tsx
// components/admin/overview/OverviewScreen.tsx
// Live container for the admin Vue d'ensemble. Renders the server snapshot first,
// then subscribes to postgres_changes on orders / order_tracking / drivers /
// reviews and refetches the same raw shapes on any change — the exact refetch
// pattern used by DriverRequestsScreen. All derived numbers come from
// lib/admin-overview.ts so server and client agree.
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDH } from '@/lib/format';
import {
  bucketOrdersByHour,
  computeOverviewKpis,
  latestDriverPositions,
} from '@/lib/admin-overview';
import type { AdminOverviewData } from '@/lib/queries';
import type { Order } from '@/lib/types';
import { KpiCard } from './KpiCard';
import { HourlyChart } from './HourlyChart';
import { InProgressTable, type InProgressRow } from './InProgressTable';
import { LiveDriverMap } from './LiveDriverMap';

export function OverviewScreen({
  initial,
  mapsKey,
}: {
  initial: AdminOverviewData;
  mapsKey: string | undefined;
}) {
  const [data, setData] = useState<AdminOverviewData>(initial);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const since = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const [ordersRes, driversRes, reviewsRes, trackingRes] = await Promise.all([
      supabase.from('orders').select('*').gte('placed_at', since).order('placed_at', { ascending: false }),
      supabase.from('drivers').select('*'),
      supabase.from('reviews').select('rating'),
      supabase
        .from('order_tracking')
        .select('driver_id, lat, lng, updated_at')
        .not('driver_id', 'is', null)
        .not('lat', 'is', null),
    ]);
    setData({
      orders: ordersRes.data ?? [],
      drivers: driversRes.data ?? [],
      ratings: (reviewsRes.data ?? []).map((r) => (r as { rating: number }).rating),
      tracking: trackingRes.data ?? [],
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_tracking' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, refetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const kpis = useMemo(
    () => computeOverviewKpis({ orders: data.orders, drivers: data.drivers, ratings: data.ratings }),
    [data],
  );
  const buckets = useMemo(() => bucketOrdersByHour(data.orders), [data.orders]);
  const positions = useMemo(
    () => latestDriverPositions(data.drivers, data.tracking),
    [data.drivers, data.tracking],
  );

  const inProgressRows: InProgressRow[] = useMemo(() => {
    const driverName = (id: string | null) => data.drivers.find((d) => d.id === id)?.name ?? null;
    // Map order_id -> assigned driver_id from tracking.
    const assigned = new Map<string, string | null>();
    for (const t of data.tracking) assigned.set((t as { order_id?: string }).order_id ?? '', t.driver_id);
    return data.orders
      .filter((o: Order) => o.status === 'preparing' || o.status === 'en_route')
      .map((order) => ({ order, driverName: driverName(assigned.get(order.id) ?? null) }));
  }, [data]);

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>
          Vue d&apos;ensemble
        </h1>
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
          Tableau de bord en temps réel
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <KpiCard
          icon="receipt"
          label="Commandes du jour"
          value={String(kpis.ordersToday)}
          sub={`${kpis.inProgress} en cours`}
          accent
        />
        <KpiCard icon="cash" label="Chiffre d'affaires du jour" value={formatDH(kpis.revenueToday)} />
        <KpiCard
          icon="scooter"
          label="Livreurs en ligne"
          value={`${kpis.driversOnline}/${kpis.driversTotal}`}
        />
        <KpiCard
          icon="star"
          label="Note clients"
          value={kpis.ratingCount === 0 ? '—' : kpis.ratingAvg.toFixed(1)}
          sub={kpis.ratingCount === 0 ? undefined : `${kpis.ratingCount} avis`}
        />
      </div>

      <HourlyChart buckets={buckets} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 22, alignItems: 'start' }}>
        <LiveDriverMap apiKey={mapsKey} positions={positions} />
        <InProgressTable rows={inProgressRows} />
      </div>
    </div>
  );
}
```

Note on `assigned` map: `order_tracking` rows carry `order_id`. The Phase-2 `tracking` select only fetched `driver_id, lat, lng, updated_at` (no `order_id`), so `assigned` would always miss. **Fix this in Step 2** by widening the select to include `order_id`.

- [ ] **Step 2: Widen the tracking select to include `order_id`**

The driver-name column needs to map each in-progress order to its tracking row. Update **both** fetch sites to select `order_id` too, and widen the `AdminOverviewData.tracking` type.

In `lib/queries.ts`, change the tracking select inside `getAdminOverviewData`:

```ts
    supabase
      .from('order_tracking')
      .select('order_id, driver_id, lat, lng, updated_at')
      .not('driver_id', 'is', null)
      .not('lat', 'is', null),
```

and widen the interface field:

```ts
  tracking: Pick<OrderTracking, 'order_id' | 'driver_id' | 'lat' | 'lng' | 'updated_at'>[];
```

In `components/admin/overview/OverviewScreen.tsx`, change the `refetch` tracking select identically:

```ts
      supabase
        .from('order_tracking')
        .select('order_id, driver_id, lat, lng, updated_at')
        .not('driver_id', 'is', null)
        .not('lat', 'is', null),
```

Then simplify the `assigned` construction (now `order_id` is a real, typed field):

```ts
    const assigned = new Map<string, string | null>();
    for (const t of data.tracking) assigned.set(t.order_id, t.driver_id);
```

- [ ] **Step 3: Replace `app/admin/page.tsx`**

```tsx
// Vue d'ensemble — live admin dashboard. Server component fetches the first-paint
// snapshot under staff RLS; OverviewScreen takes over with realtime updates.
import { getAdminOverviewData } from '@/lib/queries';
import { OverviewScreen } from '@/components/admin/overview/OverviewScreen';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const initial = await getAdminOverviewData();
  return <OverviewScreen initial={initial} mapsKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY} />;
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS — `t.order_id` resolves because `AdminOverviewData.tracking` now includes `order_id`, and `OrderTracking` already declares `order_id: string`.

- [ ] **Step 5: Commit**

```bash
git add components/admin/overview/OverviewScreen.tsx app/admin/page.tsx lib/queries.ts
git commit -m "feat(admin): live Vue d'ensemble — realtime KPIs, chart, map, in-progress table"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole unit suite**

Run: `npx vitest run`
Expected: PASS — previous 22 tests + the new `admin-overview` tests (≈30 total), all green.

- [ ] **Step 2: Production build (strict lint)**

Run: `NODE_OPTIONS="--max-old-space-size=4096" npm run build`
Expected: Build succeeds. `/admin` appears in the route list. No `@typescript-eslint/no-unused-vars` errors. (If lint flags an unused import, remove it and rebuild — do not disable the rule.)

- [ ] **Step 3: Manual smoke check (live server)**

Run:
```bash
lsof -ti tcp:3000 | xargs kill 2>/dev/null; sleep 1; nohup npm start > /tmp/lavilla.log 2>&1 &
sleep 4
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/admin
```
Expected: `307` for the unauthenticated probe (redirect — the gate works). Signed in as `admin@lavilla.ma` in a browser, `/admin` renders the four KPI cards, the hourly chart, the live map (or the no-key fallback list), and the in-progress orders table. Placing/advancing an order in the customer or driver app updates the dashboard within ~1–2s without a manual refresh.

- [ ] **Step 4: Final commit (only if Step 2/3 required fixes)**

```bash
git add -A
git commit -m "fix(admin): overview build/lint cleanups"
```

---

## Self-review notes (for the executor)

- **Spec coverage (overview section of `2026-06-06-lavilla-admin-dashboard-design.md`):** KPI cards → Task 5 (Commandes du jour + en cours, CA, Livreurs en ligne, Note clients). **Incidents ouverts KPI is deferred to Phase 5** with the `incidents` table — documented, not forgotten. Hourly activity chart → Tasks 1+3. Live driver map → Tasks 1+4. In-progress orders table → Tasks 3+5. Realtime on orders/order_tracking/drivers/reviews → Task 5.
- **Type consistency:** `DriverPosition` (Task 1) is consumed by `LiveDriverMap` (Task 4) and produced by `latestDriverPositions` (Task 1). `AdminOverviewData` (Task 2, widened in Task 5 Step 2) is consumed by `OverviewScreen` (Task 5). `InProgressRow` is exported from `InProgressTable` (Task 3) and imported in `OverviewScreen` (Task 5). `computeOverviewKpis` field names (`ordersToday`, `inProgress`, `revenueToday`, `driversOnline`, `driversTotal`, `ratingAvg`, `ratingCount`) are used verbatim in Task 5.
- **The `order_id` gotcha** is handled explicitly in Task 5 Step 2 (both selects + the interface widened together) so the driver-name column actually resolves.
```
