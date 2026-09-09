-- 0051_admin_aggregates.sql  (performance)
-- The CRM and Statistiques screens used to pull raw rows and aggregate them in
-- JavaScript: /admin/customers fetched EVERY order and EVERY profile with no
-- limit, /admin/stats fetched 90 days of orders plus all their items. Two
-- problems: the payload grew without bound, and PostgREST caps a response at
-- 1000 rows — past 1000 orders both screens silently showed WRONG figures.
--
-- These functions do the aggregation in Postgres and return a handful of rows.
-- They are SECURITY DEFINER (like the other admin_* RPCs) and therefore repeat
-- the branch scoping that RLS applies elsewhere: staff only, and a gérant with
-- profiles.branch_id set sees only their own agency (NULL ⇒ super-admin, all).

-- ── CRM: one row per customer, aggregated in SQL ─────────────────────────────
create or replace function public.admin_customer_rows(p_limit int default 500)
returns table (
  id uuid,
  name text,
  phone text,
  orders int,
  spend numeric,
  last_order timestamptz,
  points int,
  tier text,
  segment text,
  note text
)
language sql stable security definer set search_path = public as $$
  with scoped as (
    select o.user_id, o.total_dh, o.placed_at
    from orders o
    where lv_is_staff()
      and (o.branch_id = lv_staff_branch() or lv_staff_branch() is null)
      and o.status <> 'cancelled'
  ),
  agg as (
    select user_id,
           count(*)::int              as orders,
           coalesce(sum(total_dh), 0) as spend,
           max(placed_at)             as last_order
    from scoped
    group by user_id
  )
  select a.user_id,
         coalesce(nullif(trim(p.full_name), ''), 'Client') as name,
         p.phone,
         a.orders,
         round(a.spend) as spend,
         a.last_order,
         coalesce(p.loyalty_points, 0)::int as points,
         p.loyalty_tier,
         case
           when a.spend >= 1000 or a.orders >= 10 then 'VIP'
           when a.orders >= 3 then 'Régulier'
           else 'Nouveau'
         end as segment,
         p.crm_note
  from agg a
  left join profiles p on p.id = a.user_id
  order by a.spend desc
  limit greatest(1, least(coalesce(p_limit, 500), 5000));
$$;
revoke all on function public.admin_customer_rows(int) from public;
grant execute on function public.admin_customer_rows(int) to authenticated, service_role;

-- ── CRM detail panel: one customer's recent orders, fetched on selection ─────
-- (the screen used to hold every order of every customer in memory just to
--  render the history of the one that is selected)
create or replace function public.admin_customer_orders(p_user uuid, p_limit int default 50)
returns table (
  id uuid,
  user_id uuid,
  code text,
  status text,
  total_dh numeric,
  placed_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select o.id, o.user_id, o.code, o.status, o.total_dh, o.placed_at
  from orders o
  where lv_is_staff()
    and (o.branch_id = lv_staff_branch() or lv_staff_branch() is null)
    and o.user_id = p_user
  order by o.placed_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 500));
$$;
revoke all on function public.admin_customer_orders(uuid, int) from public;
grant execute on function public.admin_customer_orders(uuid, int) to authenticated, service_role;

-- ── Statistiques: the whole report in one round trip ─────────────────────────
-- Returns the KPIs, the daily revenue series, the top products, the per-agency
-- split and the previous window's revenue (for the trend arrow) — the exact
-- figures lib/admin-stats.ts used to compute on the device, same rounding and
-- same UTC day boundaries.
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
        select to_char(placed_at at time zone 'UTC', 'YYYY-MM-DD') as day,
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

-- Supporting index for the date-window scan. (orders(user_id, placed_at desc)
-- and order_items(order_id) already exist as idx_orders_user / idx_order_items_order
-- from 0001, and orders(branch_id) from 0044.)
create index if not exists idx_orders_placed_at on public.orders (placed_at desc);
