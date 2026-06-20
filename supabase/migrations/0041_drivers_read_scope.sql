-- 0041_drivers_read_scope.sql  (Multi-agences — fix 2c driver isolation)
-- The blanket `drivers_read = true` policy made every driver readable by everyone,
-- which OR-ed away the branch-scoped staff policy (a branch gérant saw all drivers).
-- Replace it with tight policies so the staff policy actually governs admin reads:
--   • a driver reads their own row;
--   • a customer reads the driver assigned to one of their orders (via a SECURITY
--     DEFINER helper, so there is no RLS recursion on orders/order_tracking).
-- The existing drivers_staff_read (branch-scoped) handles admin/gérant reads.

create or replace function public.lv_owns_driver_order(p_driver uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from order_tracking t join orders o on o.id = t.order_id
    where t.driver_id = p_driver and o.user_id = auth.uid()
  );
$$;
revoke all on function public.lv_owns_driver_order(uuid) from public;
grant execute on function public.lv_owns_driver_order(uuid) to authenticated, service_role;

drop policy if exists drivers_read on public.drivers;

drop policy if exists drivers_self_read on public.drivers;
create policy drivers_self_read on public.drivers for select using (user_id = auth.uid());

drop policy if exists drivers_customer_read on public.drivers;
create policy drivers_customer_read on public.drivers for select using (lv_owns_driver_order(id));
