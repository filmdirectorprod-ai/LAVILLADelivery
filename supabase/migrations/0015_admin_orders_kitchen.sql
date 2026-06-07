-- La Villa — Admin Phase 3: Commandes + Cuisine.
-- Introduces the 'ready' order status (kitchen gate) and the staff write RPCs the
-- admin Commandes & Cuisine screens use, then re-threads the driver pool, the
-- driver RPCs and the auto-mover onto the new five-step lifecycle:
--   pending → preparing → ready → en_route → delivered   (+ cancelled)
--     • preparing : in the kitchen
--     • ready     : cooked, waiting for a driver — ENTERS the driver pool here
--     • en_route  : a driver has picked it up and is delivering
-- Idempotent; safe to re-run. Run manually in the Supabase SQL editor (after 0014).

-- ── 1. Widen the status CHECK constraint to include 'ready' ───────────────────
-- The constraint is the inline column check from 0001, auto-named orders_status_check.
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('pending','preparing','ready','en_route','delivered','cancelled'));

-- ── 2. Kitchen: mark a preparing order ready (staff only) ─────────────────────
create or replace function public.admin_mark_order_ready(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_mode text; v_uid uuid; v_code text;
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;

  update orders o
    set status = 'ready'
    where o.id = p_order and o.status = 'preparing'
    returning o.mode, o.user_id, o.code into v_mode, v_uid, v_code;
  if not found then
    raise exception 'not_preparing';  -- already past the kitchen, or unknown
  end if;

  insert into notifications (user_id, kind, title, body, order_id)
  values (v_uid, 'order', 'Commande prête',
    case when v_mode = 'retrait'
         then 'Votre commande ' || v_code || ' est prête à récupérer en boutique.'
         else 'Votre commande ' || v_code || ' est prête, un livreur va la récupérer.' end,
    p_order);
end;
$$;

-- ── 3. Commandes: set an order's status (staff only, validated) ───────────────
-- General-purpose setter for the Commandes screen (mainly correct / cancel).
-- Notifies the customer on cancellation. Does NOT touch tracking; delivery
-- progression stays the driver's job via driver_update_status (0008).
create or replace function public.admin_set_order_status(p_order uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_code text;
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  if p_status not in ('preparing','ready','en_route','delivered','cancelled') then
    raise exception 'invalid status %', p_status;
  end if;

  update orders o set status = p_status
    where o.id = p_order
    returning o.user_id, o.code into v_uid, v_code;
  if not found then raise exception 'unknown order'; end if;

  if p_status = 'cancelled' then
    insert into notifications (user_id, kind, title, body, order_id)
    values (v_uid, 'order', 'Commande annulée',
      'Votre commande ' || v_code || ' a été annulée. Contactez-nous pour toute question.',
      p_order);
  end if;
end;
$$;

-- ── 4. Commandes: assign / reassign a driver (staff only) ─────────────────────
-- Points the tracking row at a chosen driver and flips manual=true so the
-- auto-mover lets go. Upserts the tracking row if it does not exist yet.
create or replace function public.admin_assign_driver(p_order uuid, p_driver uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  if not exists (select 1 from orders where id = p_order) then
    raise exception 'unknown order';
  end if;
  if not exists (select 1 from drivers where id = p_driver) then
    raise exception 'unknown driver';
  end if;

  insert into order_tracking (order_id, stage, progress, driver_id, manual, updated_at)
  values (p_order, 0, 0, p_driver, true, now())
  on conflict (order_id)
  do update set driver_id = excluded.driver_id, manual = true, updated_at = now();
end;
$$;

revoke all on function public.admin_mark_order_ready(uuid) from public;
revoke all on function public.admin_set_order_status(uuid, text) from public;
revoke all on function public.admin_assign_driver(uuid, uuid) from public;
grant execute on function public.admin_mark_order_ready(uuid) to authenticated, service_role;
grant execute on function public.admin_set_order_status(uuid, text) to authenticated, service_role;
grant execute on function public.admin_assign_driver(uuid, uuid) to authenticated, service_role;

-- ── 5. Driver pool now starts at 'ready' (kitchen gate) ───────────────────────
-- Re-defines the 0008 driver-read policies so a driver only sees cooked orders.
drop policy if exists orders_driver_read on orders;
create policy orders_driver_read on orders for select
  using (
    lv_is_driver()
    and status in ('ready','en_route')
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
      where o.id = order_tracking.order_id and o.status in ('ready','en_route')
    )
  );

-- A driver may only accept a cooked, unclaimed order (status = 'ready').
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
                  where o.id = t.order_id and o.status = 'ready');
  if not found then
    raise exception 'unavailable';  -- not ready, already claimed, or unknown
  end if;

  return p_order;
end;
$$;

-- A claimed order is past the kitchen, so a not-yet-en-route stage maps to
-- 'ready' (never back to 'preparing').
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
                      else 'ready' end
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

-- ── 6. Auto-mover: simulate the full lifecycle incl. the 'ready' band ─────────
-- Demo orders (manual=false) still self-drive end-to-end; the new 0.2 threshold
-- lets them pass through 'ready' (so they briefly appear in the kitchen / pool).
-- Real, driver-claimed orders (manual=true) remain untouched.
create or replace function public.advance_deliveries()
returns void language plpgsql security definer set search_path = public as $$
declare step numeric := 0.06;
begin
  update order_tracking t
    set progress = least(1.0, t.progress + step),
        stage = lv_stage_for(least(1.0, t.progress + step)),
        eta_at = now() + (greatest(0, (1.0 - least(1.0, t.progress + step))) * interval '28 minutes'),
        updated_at = now()
    from orders o
    where o.id = t.order_id
      and o.status in ('preparing','ready','en_route')
      and coalesce(t.manual, false) = false;

  update orders o
    set status = case
      when t.progress >= 1.0 then 'delivered'
      when t.progress >= 0.5 then 'en_route'
      when t.progress >= 0.2 then 'ready'
      else 'preparing' end
    from order_tracking t
    where t.order_id = o.id
      and o.status in ('preparing','ready','en_route')
      and coalesce(t.manual, false) = false;
end;
$$;
