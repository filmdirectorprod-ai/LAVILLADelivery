-- 0052_stats_business_timezone.sql  (reporting correctness)
-- Cut the revenue days in the agency's own timezone instead of UTC.
--
-- The daily series grouped by `at time zone 'UTC'` — faithfully reproducing the
-- ISO-string slicing the old client-side aggregation did. But Fès runs at UTC+1,
-- so an order placed at 00 h 30 was counted on the PREVIOUS day's bar, and the
-- gap moves during the year: Morocco drops to UTC+0 for Ramadan. Grouping by the
-- IANA zone follows those switches on its own.
--
-- The range bounds match: lib/timezone.ts starts "Aujourd'hui" at midnight in
-- the same zone, on the device and on the server alike.
--
-- EXPECTED: figures shift slightly against 0051 — orders in the first hour after
-- midnight move to the day the shop considers theirs. That is the point.

create or replace function public.admin_stats_snapshot(
  p_from timestamptz,
  p_to timestamptz,
  p_prev_from timestamptz
)
returns jsonb
language sql stable security definer set search_path = public as $$
  with scoped as (
    select o.id, o.status, o.total_dh, o.placed_at, o.branch_id
    from orders o
    where lv_is_staff()
      and (o.branch_id = lv_staff_branch() or lv_staff_branch() is null)
      and o.placed_at >= p_prev_from
      and o.placed_at < p_to
  ),
  cur as (select * from scoped where placed_at >= p_from),
  sales as (select * from cur where status <> 'cancelled'),
  prev as (
    select * from scoped
    where placed_at >= p_prev_from and placed_at < p_from and status <> 'cancelled'
  )
  select jsonb_build_object(
    'kpis', (
      select jsonb_build_object(
        'revenue', coalesce(round(sum(total_dh)), 0),
        'orders', count(*),
        'avgBasket', case when count(*) = 0 then 0 else round(sum(total_dh) / count(*)) end,
        'delivered', (select count(*) from cur where status = 'delivered')
      ) from sales
    ),
    'prevRevenue', (select coalesce(round(sum(total_dh)), 0) from prev),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'revenue', revenue) order by day)
      from (
        select to_char(placed_at at time zone 'Africa/Casablanca', 'YYYY-MM-DD') as day,
               round(sum(total_dh)) as revenue
        from sales group by 1
      ) d
    ), '[]'::jsonb),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'revenue', revenue) order by revenue desc)
      from (
        select oi.name_snapshot as name,
               sum(oi.qty)::int as qty,
               round(sum(oi.qty * oi.price_snapshot)) as revenue
        from order_items oi
        join sales s on s.id = oi.order_id
        group by 1
        order by revenue desc
        limit 8
      ) t
    ), '[]'::jsonb),
    'byBranch', coalesce((
      select jsonb_object_agg(key, jsonb_build_object('revenue', revenue, 'orders', orders))
      from (
        select coalesce(branch_id::text, 'none') as key,
               round(sum(total_dh)) as revenue,
               count(*)::int as orders
        from sales group by 1
      ) b
    ), '{}'::jsonb)
  );
$$;
revoke all on function public.admin_stats_snapshot(timestamptz, timestamptz, timestamptz) from public;
grant execute on function public.admin_stats_snapshot(timestamptz, timestamptz, timestamptz) to authenticated, service_role;
