# La Villa Admin — Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the admin (gérant) back-office shell: a staff role, RLS read access across all data, a full-width desktop sidebar layout outside the phone frame, and a gated `/admin` route that only `admin@lavilla.ma` can reach.

**Architecture:** New `app/(admin)` route group with its own server `layout.tsx` that gates on a `profiles.is_staff` flag (checked via the SECURITY DEFINER `lv_is_staff()` helper, mirroring the driver's `lv_is_driver()`). A client `AdminChrome` renders the desktop sidebar + content area; `globals.css` drops the `.lv-frame` phone constraints for admin via `:has()`. Staff RLS `select` policies (added in migration 0014) let the admin read across all customers/drivers using the normal request-scoped client — no service-role in the browser.

**Tech Stack:** Next.js 14 App Router (TS), Supabase `@supabase/ssr` + Postgres RLS, Vitest (unit), React inline-style design system (existing tokens).

---

## Context for the engineer (read first)

- **Migrations are applied MANUALLY by the user** in the Supabase SQL Editor — there is no local `psql`. Migration files must be **idempotent** and numbered. The next number is **0014** (last applied: 0013).
- **Build is strict:** `@typescript-eslint/no-unused-vars` is an **error**. Every import/var must be used or the build fails. Build command: `NODE_OPTIONS="--max-old-space-size=4096" npm run build`.
- **Driver patterns to mirror:** `lib/queries.ts` → `getMyDriver()`; `app/driver/layout.tsx` → `DriverGate` gate; `components/driver/DriverChrome.tsx` → chrome shell; identity helpers `lv_current_driver()`/`lv_is_driver()` in `supabase/migrations/0008_driver_app.sql`.
- **Design tokens** (already in `globals.css`): `--brand #137c8b`, `--brand-d #0f606b`, `--gold #a89723`, `--ink`, `--muted`, `--line #eceeef`, `--soft #f6f7f7`. Font `var(--ui-font)`. Cards: `#fff`, `1px solid var(--line)`, radius 18, shadow `0 6px 18px -14px rgba(0,0,0,0.3)`.
- **The admin account must already exist.** Before the migration's `is_staff` UPDATE can match a row, someone must sign up once with `admin@lavilla.ma` (the `0003` trigger creates its `profiles` row). The migration is a no-op until then; re-running it after sign-up flips the flag.

## File structure (Phase 1)

- Create `supabase/migrations/0014_admin_staff.sql` — staff flag, `lv_is_staff()`, staff `select` RLS, `drivers.is_online/last_seen`, realtime publication for `drivers`/`reviews`/`order_tracking`.
- Create `lib/admin-nav.ts` — sidebar nav model + `isActiveNav()` (pure, unit-tested).
- Create `lib/__tests__/admin-nav.test.ts` — tests for `isActiveNav()`.
- Modify `lib/queries.ts` — add `getMyStaff()`.
- Create `components/admin/AdminGate.tsx` — non-staff dead-end.
- Create `components/admin/AdminChrome.tsx` — desktop sidebar shell (client).
- Modify `app/globals.css` — `.lv-frame:has(.lv-admin-root)` escape.
- Create `app/(admin)/layout.tsx` — staff gate + chrome.
- Create `app/(admin)/page.tsx` — Vue d'ensemble placeholder (real KPIs land in Phase 2).

---

## Task 1: Migration 0014 — staff role, RLS reads, driver online status

**Files:**
- Create: `supabase/migrations/0014_admin_staff.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0014_admin_staff.sql` with exactly:

```sql
-- La Villa — Admin (gérant) foundations.
-- Adds a single staff flag, an identity helper, additive staff SELECT policies
-- across the operational tables (so the gérant can read every customer/driver
-- via the normal RLS client), driver online presence columns, and realtime
-- publication for the tables the admin dashboard subscribes to.
-- Idempotent; safe to re-run.

-- ── Staff flag ───────────────────────────────────────────────────────────────
alter table profiles add column if not exists is_staff boolean not null default false;

-- Promote the dedicated gérant account. No-op until that user has signed up
-- (the 0003 trigger creates its profiles row on first sign-in); re-run after.
update profiles
  set is_staff = true
  where id in (select id from auth.users where lower(email) = 'admin@lavilla.ma');

-- ── Identity helper (used by policies; SECURITY DEFINER avoids RLS recursion) ──
create or replace function public.lv_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and coalesce(is_staff, false) = true
  );
$$;
grant execute on function public.lv_is_staff() to authenticated, service_role;

-- ── Additive staff SELECT policies (read-all for the gérant) ──────────────────
-- RLS policies OR together, so these widen reads for staff only; customer and
-- driver policies from 0002/0008 are untouched. Writes stay locked until each
-- admin section ships its own SECURITY DEFINER RPC in a later phase.
drop policy if exists orders_staff_read on orders;
create policy orders_staff_read on orders for select using (lv_is_staff());

drop policy if exists order_items_staff_read on order_items;
create policy order_items_staff_read on order_items for select using (lv_is_staff());

drop policy if exists order_tracking_staff_read on order_tracking;
create policy order_tracking_staff_read on order_tracking for select using (lv_is_staff());

drop policy if exists drivers_staff_read on drivers;
create policy drivers_staff_read on drivers for select using (lv_is_staff());

drop policy if exists reviews_staff_read on reviews;
create policy reviews_staff_read on reviews for select using (lv_is_staff());

drop policy if exists profiles_staff_read on profiles;
create policy profiles_staff_read on profiles for select using (lv_is_staff());

drop policy if exists chat_messages_staff_read on chat_messages;
create policy chat_messages_staff_read on chat_messages for select using (lv_is_staff());

-- delivery_zones, products, categories are already public-read (0002); no policy
-- needed for the admin to see them.

-- ── Driver online presence (powers "Livreurs en ligne X/Y") ──────────────────
alter table drivers add column if not exists is_online boolean not null default false;
alter table drivers add column if not exists last_seen timestamptz;

-- ── Realtime: tables the admin dashboard subscribes to ───────────────────────
do $$
declare t text;
begin
  foreach t in array array['order_tracking','drivers','reviews'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end$$;
```

- [ ] **Step 2: User applies the migration**

This project has no local DB. Tell the user:
> Open Supabase → SQL Editor, paste the contents of `supabase/migrations/0014_admin_staff.sql`, run it. If `admin@lavilla.ma` hasn't signed up yet, first create that account (sign up in the app once), then re-run the migration so the `is_staff` flag is set.

Wait for the user to confirm ("c'est fait") before Step 3.

- [ ] **Step 3: Smoke-verify the helper exists**

Run (uses anon key — confirms the function is callable / migration parsed):

```bash
node --input-type=module -e '
import { readFileSync } from "fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r = await fetch(`${url}/rest/v1/rpc/lv_is_staff`, { method:"POST", headers:{ apikey:key, Authorization:`Bearer ${key}`, "Content-Type":"application/json" }, body:"{}" });
console.log("lv_is_staff:", r.status, await r.text());
'
```

Expected: `lv_is_staff: 200 false` (anonymous caller is not staff). A `404` means the migration did not apply — recheck Step 2.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0014_admin_staff.sql
git commit -m "feat(admin): migration 0014 — staff flag, read RLS, driver presence"
```

---

## Task 2: `getMyStaff()` query + admin nav model

**Files:**
- Create: `lib/admin-nav.ts`
- Test: `lib/__tests__/admin-nav.test.ts`
- Modify: `lib/queries.ts` (append `getMyStaff`)

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/admin-nav.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ADMIN_NAV, isActiveNav } from '@/lib/admin-nav';

describe('admin nav', () => {
  it('exposes the ten sidebar sections in order', () => {
    expect(ADMIN_NAV.map((n) => n.href)).toEqual([
      '/admin',
      '/admin/orders',
      '/admin/kitchen',
      '/admin/products',
      '/admin/drivers',
      '/admin/reviews',
      '/admin/zones',
      '/admin/support',
      '/admin/incidents',
      '/admin/planning',
    ]);
  });

  it('matches the overview only on an exact path', () => {
    expect(isActiveNav('/admin', '/admin')).toBe(true);
    expect(isActiveNav('/admin/orders', '/admin')).toBe(false);
  });

  it('matches a section on its path or a sub-path', () => {
    expect(isActiveNav('/admin/orders', '/admin/orders')).toBe(true);
    expect(isActiveNav('/admin/orders/abc', '/admin/orders')).toBe(true);
    expect(isActiveNav('/admin/kitchen', '/admin/orders')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/admin-nav.test.ts`
Expected: FAIL — cannot resolve `@/lib/admin-nav`.

- [ ] **Step 3: Implement the nav model**

Create `lib/admin-nav.ts`:

```ts
// Admin sidebar model. `icon` names map to components/ui/Icon. Keep this list as
// the single source of truth for the admin route set (used by AdminChrome and
// the nav tests). Pages are added section-by-section across the build phases.
export interface AdminNavItem {
  href: string;
  label: string;
  icon: string;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', label: "Vue d'ensemble", icon: 'home' },
  { href: '/admin/orders', label: 'Commandes', icon: 'receipt' },
  { href: '/admin/kitchen', label: 'Cuisine', icon: 'store' },
  { href: '/admin/products', label: 'Produits', icon: 'bag' },
  { href: '/admin/drivers', label: 'Livreurs', icon: 'scooter' },
  { href: '/admin/reviews', label: 'Avis clients', icon: 'star' },
  { href: '/admin/zones', label: 'Zones de livraison', icon: 'pin' },
  { href: '/admin/support', label: 'Support livreurs', icon: 'message' },
  { href: '/admin/incidents', label: 'Incidents', icon: 'info' },
  { href: '/admin/planning', label: 'Planning', icon: 'calendar' },
];

/** Whether `href` is the active section for the current `pathname`. The overview
 *  ('/admin') matches only exactly; every other section also matches sub-paths. */
export function isActiveNav(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(href + '/');
}
```

> Note: confirm each `icon` exists in `components/ui/Icon.tsx`. If a name is missing, either add the glyph there in this step or substitute an existing name — do not ship an unknown icon (it renders blank).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/admin-nav.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add `getMyStaff()` to queries**

Append to `lib/queries.ts` (after `getMyDriver`), and add `Profile` to the existing type import if not already present:

```ts
/** The current user's profile IFF they are staff (gérant), else null. Gate for
 *  the /admin section, mirroring getMyDriver() for the driver section. */
export async function getMyStaff(): Promise<Profile | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  return data && (data as Profile & { is_staff?: boolean }).is_staff ? (data as Profile) : null;
}
```

> `Profile` is already imported in `lib/queries.ts`. The `is_staff` column isn't on the `Profile` interface; the inline cast reads it without a type change. (Optional: add `is_staff?: boolean` to `Profile` in `lib/types.ts` — not required for Phase 1.)

- [ ] **Step 6: Typecheck + unit tests green**

Run: `npx tsc --noEmit && npx vitest run lib/__tests__/admin-nav.test.ts`
Expected: no TS errors; tests PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/admin-nav.ts lib/__tests__/admin-nav.test.ts lib/queries.ts
git commit -m "feat(admin): nav model + getMyStaff gate query"
```

---

## Task 3: AdminGate (non-staff dead-end)

**Files:**
- Create: `components/admin/AdminGate.tsx`

- [ ] **Step 1: Implement the gate**

Create `components/admin/AdminGate.tsx` (server-renderable; mirror the tone of `DriverGate`):

```tsx
// Shown when a signed-in non-staff user hits /admin. Friendly dead-end, no nav.
import Link from 'next/link';

export function AdminGate() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--soft)',
      }}
    >
      <div
        style={{
          background: '#fff',
          border: '1px solid var(--line)',
          borderRadius: 18,
          boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)',
          padding: '28px 24px',
          maxWidth: 420,
          textAlign: 'center',
        }}
      >
        <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 18, color: 'var(--ink)' }}>
          Accès réservé
        </div>
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', margin: '8px 0 18px' }}>
          Cet espace est réservé à l’administration de La Villa.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            fontFamily: 'var(--ui-font)',
            fontWeight: 600,
            fontSize: 14,
            color: '#fff',
            background: 'var(--brand)',
            borderRadius: 999,
            padding: '11px 22px',
            textDecoration: 'none',
          }}
        >
          Retour à l’application
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/AdminGate.tsx
git commit -m "feat(admin): AdminGate dead-end for non-staff"
```

---

## Task 4: AdminChrome (desktop sidebar) + frame escape

**Files:**
- Create: `components/admin/AdminChrome.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Escape the phone frame for admin**

Append to `app/globals.css`:

```css
/* Admin renders full-width, outside the centered phone frame. The marker class
   lives on AdminChrome's root; :has() lifts the .lv-frame constraints only when
   an admin page is mounted. */
.lv-frame:has(.lv-admin-root) {
  max-width: none;
  height: 100dvh;
  margin: 0;
  border-radius: 0;
  box-shadow: none;
  background: var(--soft);
}
```

- [ ] **Step 2: Implement the chrome**

Create `components/admin/AdminChrome.tsx`:

```tsx
'use client';
// Desktop admin shell: fixed left sidebar (brand-d) with the section nav and the
// manager identity, plus a scrollable content area. Marker class .lv-admin-root
// tells globals.css to drop the phone-frame sizing.
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ADMIN_NAV, isActiveNav } from '@/lib/admin-nav';
import { Icon } from '@/components/ui/Icon';

export function AdminChrome({ children, managerName }: { children: ReactNode; managerName: string }) {
  const pathname = usePathname();
  return (
    <div className="lv-admin-root" style={{ display: 'flex', height: '100dvh', width: '100%' }}>
      <aside
        style={{
          width: 260,
          flexShrink: 0,
          background: 'var(--brand-d)',
          display: 'flex',
          flexDirection: 'column',
          padding: '22px 14px',
          overflow: 'auto',
        }}
      >
        <div style={{ padding: '0 10px 18px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: '#fff' }}>
            La Villa
          </div>
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11, letterSpacing: 1.5, color: 'var(--gold)', fontWeight: 600 }}>
            ADMINISTRATION
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {ADMIN_NAV.map((item) => {
            const active = isActiveNav(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 12px',
                  borderRadius: 12,
                  textDecoration: 'none',
                  fontFamily: 'var(--ui-font)',
                  fontSize: 14.5,
                  fontWeight: 600,
                  color: active ? 'var(--brand-d)' : 'rgba(255,255,255,0.85)',
                  background: active ? '#fff' : 'transparent',
                }}
              >
                <Icon name={item.icon} size={19} color={active ? 'var(--brand)' : 'rgba(255,255,255,0.85)'} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 10px 0', borderTop: '1px solid rgba(255,255,255,0.12)', marginTop: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 999, background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="user" size={18} color="#fff" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13.5, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {managerName}
            </div>
            <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>Gérant</div>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, overflow: 'auto', background: 'var(--soft)' }}>{children}</main>
    </div>
  );
}
```

> Confirm `usePathname` import path and the `Icon` prop names against `components/ui/Icon.tsx` (size/color/name) — they match the driver components which already use `Icon` this way.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/admin/AdminChrome.tsx app/globals.css
git commit -m "feat(admin): desktop sidebar chrome + phone-frame escape"
```

---

## Task 5: `(admin)` route group — gated layout + overview placeholder

**Files:**
- Create: `app/(admin)/layout.tsx`
- Create: `app/(admin)/page.tsx`

- [ ] **Step 1: Gated layout**

Create `app/(admin)/layout.tsx`:

```tsx
// Admin (gérant) section — staff gate. Auth is already enforced by middleware;
// here we additionally require profiles.is_staff (checked via getMyStaff()).
// Non-staff get AdminGate. Lives in its own route group so it never inherits the
// customer TabBar or the driver chrome.
import type { ReactNode } from 'react';
import { getMyStaff } from '@/lib/queries';
import { AdminGate } from '@/components/admin/AdminGate';
import { AdminChrome } from '@/components/admin/AdminChrome';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await getMyStaff();
  if (!staff) return <AdminGate />;
  return <AdminChrome managerName={staff.full_name || 'Gérant'}>{children}</AdminChrome>;
}
```

- [ ] **Step 2: Overview placeholder page**

Create `app/(admin)/page.tsx` (real KPIs/map/tables arrive in Phase 2 — this proves the shell renders):

```tsx
// Vue d'ensemble — placeholder. Phase 2 fills in live KPIs, the hourly activity
// chart, the live driver map, and the in-progress orders table.
export default function AdminOverviewPage() {
  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>
        Vue d&apos;ensemble
      </h1>
      <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
        Tableau de bord en temps réel — à venir (Phase 2).
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Build**

Run: `NODE_OPTIONS="--max-old-space-size=4096" npm run build`
Expected: build SUCCEEDS and the route list includes `/admin`.

- [ ] **Step 4: Manual verification**

Restart: `lsof -ti tcp:3000 | xargs kill 2>/dev/null; nohup npm start > /tmp/lv-server.log 2>&1 &`
Then:
- Signed in as `admin@lavilla.ma` → `/admin` shows the sidebar + "Vue d'ensemble".
- Signed in as a normal customer → `/admin` shows **AdminGate** ("Accès réservé").
- Not signed in → middleware redirects to `/onboarding`.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/layout.tsx" "app/(admin)/page.tsx"
git commit -m "feat(admin): gated (admin) route group + overview shell"
```

---

## Self-Review (done by plan author)

- **Spec coverage (Phase 1 portion):** route group + desktop layout (Task 5), frame escape (Task 4), staff role + `lv_is_staff()` + staff read RLS (Task 1), `getMyStaff()` gate (Task 2), driver online columns (Task 1), realtime publication (Task 1), sidebar with all 10 sections (Task 2 model + Task 4 render). Sections' own pages/tables, write RPCs, and the new tables (`incidents`, `support_messages`, `driver_shifts`) are intentionally deferred to later phase plans.
- **Placeholders:** the only deferred item is the overview *page body* (explicitly Phase 2) and the not-yet-created section routes — both are real handoffs, not gaps. Migration `is_staff` UPDATE is a documented no-op until the account exists.
- **Type/name consistency:** `ADMIN_NAV`/`isActiveNav` used identically in test, model, and chrome; `getMyStaff` returns `Profile | null` and the layout reads `.full_name`; `lv_is_staff()` name matches between SQL and the smoke test.

## Next phases (separate plans, written when reached)

- **Phase 2 — Vue d'ensemble (live):** KPI helpers (TDD: `kpiToday`, `ordersByHour`, `onlineDrivers`, `avgRating`), `getAdminOverview()` query, KPI cards, hourly bar chart, multi-marker live driver map (extend `GoogleDeliveryMap`), in-progress orders table, realtime subscriptions.
- **Phase 3 — Commandes + Cuisine:** list/filter/detail, staff status-change RPC, kitchen board → mark ready.
- **Phase 4 — Produits + Livreurs + Zones + Avis:** catalog edit RPC, driver cards w/ today aggregates, zones CRUD RPC, reviews browser.
- **Phase 5 — Support + Incidents + Planning:** migration(s) for `support_messages`/`incidents`/`driver_shifts` + their RPCs and screens; driver app sets `is_online`/`last_seen`.
