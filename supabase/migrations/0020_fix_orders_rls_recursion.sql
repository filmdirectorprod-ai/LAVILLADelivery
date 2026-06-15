-- La Villa — fix infinite-recursion in the driver RLS policies (regression
-- re-introduced by 0015).
--
-- ROOT CAUSE: 0009 had already removed this recursion by moving every
-- cross-table lookup into SECURITY DEFINER helpers. But 0015 ("Commandes +
-- Cuisine") redefined orders_driver_read / order_tracking_driver_read with the
-- inline cross-table sub-selects again, to re-gate the driver pool onto the new
-- 'ready' status:
--   * orders_driver_read           EXISTS (select … from order_tracking …)
--   * order_tracking_driver_read   EXISTS (select … from orders …)
-- Each sub-select runs under the OTHER table's RLS, so Postgres loops:
--   orders → order_tracking → orders → …  and aborts at PLAN time with
--   42P17 "infinite recursion detected in policy for relation orders".
-- The error makes EVERY authenticated read of orders / order_tracking fail —
-- so getOrderDetail() returns null → notFound() → a blank tracking page right
-- after checkout (and the customer order history breaks too). Only orders whose
-- tracking page Next had already cached pre-regression kept rendering.
--
-- FIX: restore the 0009 approach — recreate the two driver read policies with
-- the cross-table check inside a SECURITY DEFINER helper (which bypasses the
-- other table's RLS, so the policies stop re-entering each other), while
-- keeping 0015's kitchen-gate semantics (driver pool = 'ready' / 'en_route').
-- Own-table columns (orders.status, order_tracking.manual/driver_id) stay
-- inline; only references to the OTHER table go through a definer helper.
-- Idempotent; safe to re-run. Run manually in the Supabase SQL editor (after 0019).

-- ── Non-recursive visibility helpers (SECURITY DEFINER = no nested RLS) ───────

-- Is the order cooked, i.e. in the driver-deliverable window? (kitchen gate)
-- Updated from 0009's lv_order_active to the 0015 five-step lifecycle: the pool
-- starts at 'ready' (cooked, awaiting a driver) and runs through 'en_route'.
create or replace function public.lv_order_active(p_order uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from orders o
    where o.id = p_order and o.status in ('ready','en_route')
  );
$$;

-- Does this order have a tracking row the current driver may see — i.e. it is
-- unclaimed (available pool) OR already assigned to this driver? (unchanged
-- from 0009, restated here so this migration is self-contained.)
create or replace function public.lv_driver_tracking_visible(p_order uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from order_tracking t
    where t.order_id = p_order
      and (coalesce(t.manual, false) = false or t.driver_id = lv_current_driver())
  );
$$;

grant execute on function public.lv_order_active(uuid) to authenticated, service_role;
grant execute on function public.lv_driver_tracking_visible(uuid) to authenticated, service_role;

-- ── Recreate the driver read policies without cross-table sub-selects ─────────

drop policy if exists orders_driver_read on orders;
create policy orders_driver_read on orders for select
  using (
    lv_is_driver()
    and status in ('ready','en_route')
    and lv_driver_tracking_visible(orders.id)
  );

drop policy if exists order_tracking_driver_read on order_tracking;
create policy order_tracking_driver_read on order_tracking for select
  using (
    lv_is_driver()
    and (coalesce(manual, false) = false or driver_id = lv_current_driver())
    and lv_order_active(order_tracking.order_id)
  );
