-- La Villa — driver ("livreur") app foundations.
-- Links the seeded `drivers` rows to real auth users, adds live GPS to
-- order_tracking, exposes driver-scoped reads via RLS (so the driver client can
-- subscribe to Realtime), and performs every driver write through
-- SECURITY DEFINER RPCs (claim, advance stage, push GPS) — mirroring the
-- place_order pattern. Finally it hands off claimed orders from the simulated
-- auto-mover to the real driver.
--
-- DRIVER JOURNEY (driver-controlled stages map onto the existing scale):
--   accept  -> tracking.manual = true, driver_id = me            (leaves the pool)
--   stage 2 -> Récupérée   (progress >= 0.35, status 'preparing')
--   stage 3 -> En route    (progress >= 0.50, status 'en_route')
--   stage 4 -> Livrée      (progress  = 1.00, status 'delivered')
-- While manual = false the order stays in the "available" pool and the
-- auto-mover keeps simulating it; once claimed, manual = true and the mover
-- ignores it so it never fights the driver's real position.

-- ── Schema additions ─────────────────────────────────────────────────────────
-- Link a driver row to an auth user (nullable: seeded demo drivers stay
-- user-less and remain valid auto-mover targets).
alter table drivers add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists idx_drivers_user on drivers(user_id) where user_id is not null;

-- Live GPS + "claimed by a real driver" flag on the tracking row.
alter table order_tracking add column if not exists lat numeric(9,6);
alter table order_tracking add column if not exists lng numeric(9,6);
alter table order_tracking add column if not exists manual boolean not null default false;

-- ── Identity helpers (used by policies + RPCs) ───────────────────────────────
-- The driver id for the current auth user, or null if they are not a driver.
create or replace function public.lv_current_driver()
returns uuid language sql stable security definer set search_path = public as $$
  select id from drivers where user_id = auth.uid();
$$;

-- Is the current auth user a registered driver?
create or replace function public.lv_is_driver()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from drivers where user_id = auth.uid());
$$;

grant execute on function public.lv_current_driver() to authenticated, service_role;
grant execute on function public.lv_is_driver() to authenticated, service_role;

-- ── Driver-scoped reads (RLS) ────────────────────────────────────────────────
-- A driver may read every still-active order that is either unclaimed
-- (available pool) or assigned to them. Customers keep their owner-only read
-- from 0002; these policies are additive (RLS policies OR together).
drop policy if exists orders_driver_read on orders;
create policy orders_driver_read on orders for select
  using (
    lv_is_driver()
    and status in ('preparing','en_route')
    and exists (
      select 1 from order_tracking t
      where t.order_id = orders.id
        and (coalesce(t.manual, false) = false or t.driver_id = lv_current_driver())
    )
  );

drop policy if exists order_tracking_driver_read on order_tracking;
create policy order_tracking_driver_read on order_tracking for select
  using (
    lv_is_driver()
    and (coalesce(manual, false) = false or driver_id = lv_current_driver())
    and exists (
      select 1 from orders o
      where o.id = order_tracking.order_id and o.status in ('preparing','en_route')
    )
  );

-- Items are visible only for orders the driver has actually claimed.
drop policy if exists order_items_driver_read on order_items;
create policy order_items_driver_read on order_items for select
  using (
    lv_is_driver()
    and exists (
      select 1 from order_tracking t
      where t.order_id = order_items.order_id and t.driver_id = lv_current_driver()
    )
  );

-- ── Driver writes (SECURITY DEFINER RPCs) ────────────────────────────────────
-- Claim an available order: assign self, flip to manual so the auto-mover lets go.
create or replace function public.driver_accept_order(p_order uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_driver uuid;
begin
  v_driver := lv_current_driver();
  if v_driver is null then raise exception 'forbidden'; end if;

  update order_tracking t
    set driver_id = v_driver, manual = true, updated_at = now()
    where t.order_id = p_order
      and coalesce(t.manual, false) = false
      and exists (select 1 from orders o
                  where o.id = t.order_id and o.status in ('preparing','en_route'));
  if not found then
    raise exception 'unavailable';  -- already claimed, delivered, or unknown
  end if;

  return p_order;
end;
$$;

-- Advance the driver-controlled stage (2 récupérée, 3 en route, 4 livrée) and
-- notify the customer. progress is monotonic so a late GPS tick can't rewind it.
create or replace function public.driver_update_status(p_order uuid, p_stage int)
returns void language plpgsql security definer set search_path = public as $$
declare v_driver uuid; v_prog numeric;
begin
  v_driver := lv_current_driver();
  if v_driver is null then raise exception 'forbidden'; end if;
  if p_stage not in (2,3,4) then raise exception 'invalid stage %', p_stage; end if;

  if not exists (select 1 from order_tracking t
                 where t.order_id = p_order and t.driver_id = v_driver) then
    raise exception 'forbidden';
  end if;

  v_prog := case p_stage when 2 then 0.35 when 3 then 0.50 when 4 then 1.0 end;

  update order_tracking t
    set stage = p_stage,
        progress = greatest(t.progress, v_prog),
        eta_at = now() + (greatest(0, 1.0 - greatest(t.progress, v_prog)) * interval '28 minutes'),
        updated_at = now()
    where t.order_id = p_order and t.driver_id = v_driver;

  update orders o
    set status = case when p_stage >= 4 then 'delivered'
                      when p_stage >= 3 then 'en_route'
                      else 'preparing' end
    where o.id = p_order;

  insert into notifications (user_id, kind, title, body, order_id)
  select o.user_id, 'order',
    case p_stage when 2 then 'Commande récupérée'
                 when 3 then 'Livreur en route'
                 else 'Commande livrée' end,
    case p_stage when 2 then 'Votre livreur a récupéré votre commande.'
                 when 3 then 'Votre livreur est en route vers vous.'
                 else 'Votre commande a été livrée. Bon appétit !' end,
    o.id
  from orders o where o.id = p_order;
end;
$$;

-- Stream the driver's real GPS (and an optional progress estimate) for an
-- assigned order. The customer's TrackingScreen reads lat/lng via Realtime.
create or replace function public.driver_update_position(
  p_order uuid, p_lat numeric, p_lng numeric, p_progress numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_driver uuid;
begin
  v_driver := lv_current_driver();
  if v_driver is null then raise exception 'forbidden'; end if;

  update order_tracking t
    set lat = p_lat,
        lng = p_lng,
        progress = case when p_progress is null then t.progress
                        else greatest(t.progress, least(1.0, p_progress)) end,
        updated_at = now()
    where t.order_id = p_order and t.driver_id = v_driver;
  if not found then raise exception 'forbidden'; end if;
end;
$$;

-- Customer contact + address for a claimed order (driver-only; RLS on profiles
-- would otherwise hide the customer from the driver).
create or replace function public.driver_order_contact(p_order uuid)
returns table(full_name text, phone text, address text)
language plpgsql security definer set search_path = public as $$
declare v_driver uuid;
begin
  v_driver := lv_current_driver();
  if v_driver is null then raise exception 'forbidden'; end if;
  if not exists (select 1 from order_tracking t
                 where t.order_id = p_order and t.driver_id = v_driver) then
    raise exception 'forbidden';
  end if;
  return query
    select p.full_name, p.phone, o.address
    from orders o join profiles p on p.id = o.user_id
    where o.id = p_order;
end;
$$;

revoke all on function public.driver_accept_order(uuid) from public;
revoke all on function public.driver_update_status(uuid, int) from public;
revoke all on function public.driver_update_position(uuid, numeric, numeric, numeric) from public;
revoke all on function public.driver_order_contact(uuid) from public;
grant execute on function public.driver_accept_order(uuid) to authenticated, service_role;
grant execute on function public.driver_update_status(uuid, int) to authenticated, service_role;
grant execute on function public.driver_update_position(uuid, numeric, numeric, numeric) to authenticated, service_role;
grant execute on function public.driver_order_contact(uuid) to authenticated, service_role;

-- ── Hand claimed orders off from the auto-mover ──────────────────────────────
-- Re-defines advance_deliveries (from 0005) to skip orders a real driver has
-- claimed (manual = true), so simulated progress never overrides real GPS.
create or replace function public.advance_deliveries()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  step numeric := 0.06;
begin
  update order_tracking t
    set progress = least(1.0, t.progress + step),
        stage = lv_stage_for(least(1.0, t.progress + step)),
        eta_at = now() + (greatest(0, (1.0 - least(1.0, t.progress + step))) * interval '28 minutes'),
        updated_at = now()
    from orders o
    where o.id = t.order_id
      and o.status in ('preparing','en_route')
      and coalesce(t.manual, false) = false;

  update orders o
    set status = case
      when t.progress >= 1.0 then 'delivered'
      when t.progress >= 0.5 then 'en_route'
      else 'preparing' end
    from order_tracking t
    where t.order_id = o.id
      and o.status in ('preparing','en_route')
      and coalesce(t.manual, false) = false;
end;
$$;

-- ── Realtime: let the driver dashboard see new/updated orders live ────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table orders;
  end if;
end$$;
