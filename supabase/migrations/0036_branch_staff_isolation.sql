-- 0036_branch_staff_isolation.sql  (Multi-agences — Phase 2c-i)
-- Per-branch gérant isolation, applied ONLY to the staff read path. The customer
-- ("own orders") and driver ("pool") policies are untouched, so the client and
-- driver apps are unaffected.
--   profiles.branch_id : a staff member's agency. NULL ⇒ super-admin (sees all).
--   lv_staff_branch()  : the caller's agency (NULL for super-admin / non-staff).
-- A staff member sees a row when: lv_is_staff() AND (row's branch = their branch
-- OR they are super-admin).

alter table public.profiles add column if not exists branch_id uuid references public.branches(id);

create or replace function public.lv_staff_branch()
returns uuid language sql stable security definer set search_path = public as $$
  select branch_id from profiles where id = auth.uid() and is_staff = true;
$$;
revoke all on function public.lv_staff_branch() from public;
grant execute on function public.lv_staff_branch() to authenticated, service_role;

-- Orders
drop policy if exists orders_staff_read on public.orders;
create policy orders_staff_read on public.orders for select using (
  lv_is_staff() and (branch_id = lv_staff_branch() or lv_staff_branch() is null)
);

-- Drivers
drop policy if exists drivers_staff_read on public.drivers;
create policy drivers_staff_read on public.drivers for select using (
  lv_is_staff() and (branch_id = lv_staff_branch() or lv_staff_branch() is null)
);

-- Order items (scoped through the parent order's branch)
drop policy if exists order_items_staff_read on public.order_items;
create policy order_items_staff_read on public.order_items for select using (
  lv_is_staff() and exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (o.branch_id = lv_staff_branch() or lv_staff_branch() is null)
  )
);

-- Order tracking (scoped through the parent order's branch)
drop policy if exists order_tracking_staff_read on public.order_tracking;
create policy order_tracking_staff_read on public.order_tracking for select using (
  lv_is_staff() and exists (
    select 1 from public.orders o
    where o.id = order_tracking.order_id
      and (o.branch_id = lv_staff_branch() or lv_staff_branch() is null)
  )
);
