-- 0050_driver_branch_scope.sql
-- Multi-agences: enforce, at the RLS layer, that a driver only ever sees orders
-- from their OWN agency. The app already filters the driver board by branch
-- (lib/queries.ts getDriverBoard), but lv_driver_tracking_visible — which gates the
-- drivers' SELECT policy on orders/order_tracking — did not check the branch, so a
-- driver could read another agency's unclaimed ready/en_route orders via a direct
-- query. We add a branch gate while preserving the original claim logic:
--   * o.branch_id is null          → unzoned / retrait order, no agency owns it.
--   * already claimed by me         → keep seeing my own in-progress delivery.
--   * o.branch_id = my driver branch→ same-agency orders only.

create or replace function public.lv_driver_tracking_visible(p_order uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from order_tracking t
    join orders o on o.id = t.order_id
    where t.order_id = p_order
      and (coalesce(t.manual, false) = false or t.driver_id = lv_current_driver())
      and (
        o.branch_id is null
        or t.driver_id = lv_current_driver()
        or o.branch_id = (select d.branch_id from drivers d where d.id = lv_current_driver())
      )
  );
$$;
