-- 0053_admin_pages_depth.sql  (Statistiques, Fidélité : données supplémentaires)
--
-- Nourrit les pages d'administration enrichies.
--
--  • admin_stats_snapshot (redéfinie) : ajoute la période précédente complète
--    (pour l'évolution ▲▼ de chaque indicateur, pas seulement du chiffre
--    d'affaires), la répartition livraison / retrait, les annulations, une grille
--    jour × heure et porte le top produits à 10. Les clés existantes ne changent
--    pas : un écran qui ne lit que les anciennes continue de fonctionner.
--  • admin_loyalty_activity / admin_loyalty_flow : loyalty_ledger n'est lisible
--    que par son propriétaire (RLS). Ces fonctions ouvrent au staff une lecture
--    du fil des mouvements et de leur total quotidien.
--  • admin_set_reward_active : aucune écriture n'existait sur le catalogue des
--    récompenses. Il est commun aux deux agences, donc réservé au super-admin.
--
-- Toutes sont SECURITY DEFINER et vérifient lv_is_staff() elles-mêmes ; les
-- statistiques gardent le cloisonnement par agence de 0051/0052. Les journées et
-- les heures sont découpées à l'heure de Fès, comme 0052.

create or replace function public.admin_stats_snapshot(
  p_from timestamptz,
  p_to timestamptz,
  p_prev_from timestamptz
)
returns jsonb
language sql stable security definer set search_path = public as $$
  with scoped as (
    select o.id, o.status, o.total_dh, o.placed_at, o.branch_id, o.mode
    from orders o
    where lv_is_staff()
      and (o.branch_id = lv_staff_branch() or lv_staff_branch() is null)
      and o.placed_at >= p_prev_from
      and o.placed_at < p_to
  ),
  cur as (select * from scoped where placed_at >= p_from),
  sales as (select * from cur where status <> 'cancelled'),
  prev_all as (select * from scoped where placed_at < p_from),
  prev as (select * from prev_all where status <> 'cancelled')
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
    'prevKpis', (
      select jsonb_build_object(
        'revenue', coalesce(round(sum(total_dh)), 0),
        'orders', count(*),
        'avgBasket', case when count(*) = 0 then 0 else round(sum(total_dh) / count(*)) end,
        'delivered', (select count(*) from prev_all where status = 'delivered')
      ) from prev
    ),
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
        limit 10
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
    ), '{}'::jsonb),
    'modes', coalesce((
      select jsonb_object_agg(mode, jsonb_build_object('orders', orders, 'revenue', revenue))
      from (
        select mode, count(*)::int as orders, round(sum(total_dh)) as revenue
        from sales group by mode
      ) m
    ), '{}'::jsonb),
    'cancelled', (
      select jsonb_build_object(
        'count', count(*) filter (where status = 'cancelled'),
        'total', count(*)
      ) from cur
    ),
    'heatmap', coalesce((
      select jsonb_agg(jsonb_build_object('dow', dow, 'hour', hour, 'orders', orders))
      from (
        select extract(isodow from placed_at at time zone 'Africa/Casablanca')::int as dow,
               extract(hour from placed_at at time zone 'Africa/Casablanca')::int as hour,
               count(*)::int as orders
        from sales group by 1, 2
      ) h
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.admin_stats_snapshot(timestamptz, timestamptz, timestamptz) from public;
grant execute on function public.admin_stats_snapshot(timestamptz, timestamptz, timestamptz) to authenticated, service_role;

-- ── Fidélité : fil des mouvements ───────────────────────────────────────────
create or replace function public.admin_loyalty_activity(p_limit int default 30)
returns table (id uuid, user_id uuid, name text, delta_pts int, reason text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.id,
         l.user_id,
         coalesce(nullif(trim(p.full_name), ''), 'Client') as name,
         l.delta_pts,
         l.reason,
         l.created_at
  from loyalty_ledger l
  left join profiles p on p.id = l.user_id
  where lv_is_staff()
  order by l.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 200));
$$;
revoke all on function public.admin_loyalty_activity(int) from public;
grant execute on function public.admin_loyalty_activity(int) to authenticated, service_role;

-- ── Fidélité : points gagnés / utilisés par jour ────────────────────────────
-- Un jour sans mouvement renvoie 0 plutôt que de disparaître : le graphique
-- garde une colonne par jour.
create or replace function public.admin_loyalty_flow(p_days int default 30)
returns table (day text, earned int, spent int)
language sql stable security definer set search_path = public as $$
  with bounds as (
    select (now() at time zone 'Africa/Casablanca')::date as today,
           greatest(1, least(coalesce(p_days, 30), 180)) as n
  ),
  days as (
    select to_char(g, 'YYYY-MM-DD') as day
    from bounds b,
         generate_series((b.today - (b.n - 1))::timestamp, b.today::timestamp, interval '1 day') g
  ),
  agg as (
    select to_char(l.created_at at time zone 'Africa/Casablanca', 'YYYY-MM-DD') as day,
           coalesce(sum(l.delta_pts) filter (where l.delta_pts > 0), 0)::int as earned,
           coalesce(-(sum(l.delta_pts) filter (where l.delta_pts < 0)), 0)::int as spent
    from loyalty_ledger l, bounds b
    where lv_is_staff()
      and l.created_at >= ((b.today - (b.n - 1))::timestamp at time zone 'Africa/Casablanca')
    group by 1
  )
  select d.day, coalesce(a.earned, 0), coalesce(a.spent, 0)
  from days d
  left join agg a on a.day = d.day
  where lv_is_staff()
  order by d.day;
$$;
revoke all on function public.admin_loyalty_flow(int) from public;
grant execute on function public.admin_loyalty_flow(int) to authenticated, service_role;

-- ── Récompenses : activer / désactiver ──────────────────────────────────────
create or replace function public.admin_set_reward_active(p_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  -- Le catalogue est commun aux deux agences : seul le super-admin le modifie.
  if lv_staff_branch() is not null then raise exception 'forbidden branch'; end if;
  update rewards set active = coalesce(p_active, false) where id = p_id;
  if not found then raise exception 'reward not found'; end if;
end; $$;
revoke all on function public.admin_set_reward_active(uuid, boolean) from public;
grant execute on function public.admin_set_reward_active(uuid, boolean) to authenticated, service_role;
