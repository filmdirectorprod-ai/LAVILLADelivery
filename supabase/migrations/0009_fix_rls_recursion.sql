-- La Villa — fix infinite-recursion in the driver RLS policies (regression
-- introduced by 0008).
--
-- ROOT CAUSE: 0008's driver read policies cross-reference each other's tables
-- with inline sub-selects:
--   * orders_driver_read           selects from order_tracking
--   * order_tracking_driver_read   selects from orders
-- Each sub-select is evaluated under the OTHER table's RLS, so Postgres loops:
--   orders → order_tracking → orders → …  and aborts with
--   42P17 "infinite recursion detected in policy for relation orders".
-- The error makes EVERY authenticated read of orders / order_tracking fail —
-- breaking the customer order history and the post-checkout tracking page
-- (getOrderDetail returns null → notFound() → blank page).
--
-- FIX: move every cross-table lookup into SECURITY DEFINER helper functions.
-- A definer function runs as its owner and bypasses RLS on the tables it reads,
-- so the policies no longer re-enter each other. Same visibility rules as 0008,
-- just expressed without the recursion. Idempotent (create or replace / drop).

-- ── Non-recursive visibility helpers (SECURITY DEFINER = no nested RLS) ───────

-- Is the order still in an active (deliverable) state?
create or replace function public.lv_order_active(p_order uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from orders o
    where o.id = p_order and o.status in ('preparing','en_route')
  );
$$;

-- Does this order have a tracking row the current driver may see — i.e. it is
-- unclaimed (available pool) OR already assigned to this driver?
create or replace function public.lv_driver_tracking_visible(p_order uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from order_tracking t
    where t.order_id = p_order
      and (coalesce(t.manual, false) = false or t.driver_id = lv_current_driver())
  );
$$;

-- Has the current driver actually claimed this order? (gates order_items)
create or replace function public.lv_driver_claimed(p_order uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from order_tracking t
    where t.order_id = p_order and t.driver_id = lv_current_driver()
  );
$$;

grant execute on function public.lv_order_active(uuid) to authenticated, service_role;
grant execute on function public.lv_driver_tracking_visible(uuid) to authenticated, service_role;
grant execute on function public.lv_driver_claimed(uuid) to authenticated, service_role;

-- ── Recreate the driver read policies without cross-table sub-selects ─────────
-- (own-table columns like orders.status / order_tracking.manual are safe; only
-- references to the OTHER table go through a definer helper.)

drop policy if exists orders_driver_read on orders;
create policy orders_driver_read on orders for select
  using (
    lv_is_driver()
    and status in ('preparing','en_route')
    and lv_driver_tracking_visible(orders.id)
  );

drop policy if exists order_tracking_driver_read on order_tracking;
create policy order_tracking_driver_read on order_tracking for select
  using (
    lv_is_driver()
    and (coalesce(manual, false) = false or driver_id = lv_current_driver())
    and lv_order_active(order_tracking.order_id)
  );

drop policy if exists order_items_driver_read on order_items;
create policy order_items_driver_read on order_items for select
  using (lv_driver_claimed(order_items.order_id));
