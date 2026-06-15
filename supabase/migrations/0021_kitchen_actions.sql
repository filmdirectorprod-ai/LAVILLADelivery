-- La Villa — Cuisine board: the two staff actions the redesigned kitchen needs.
-- Adds the kitchen "start" gate (pending → preparing) and the kitchen "hand off"
-- gate (ready → en_route) as staff-only RPCs, mirroring the security pattern of
-- admin_mark_order_ready (0015): security definer, lv_is_staff() guard, status-
-- guarded update, raise on no-op, customer notification, revoke/grant.
-- Idempotent; safe to re-run. Run manually in the Supabase SQL editor (after 0020).

-- ── 1. Kitchen: start preparing a pending order (staff only) ──────────────────
-- Moves a freshly-placed order into the kitchen. Notifies the customer that
-- their order is being prepared.
create or replace function public.admin_start_preparation(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_code text;
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;

  update orders o
    set status = 'preparing'
    where o.id = p_order and o.status = 'pending'
    returning o.user_id, o.code into v_uid, v_code;
  if not found then
    raise exception 'not_pending';  -- already started, or unknown
  end if;

  insert into notifications (user_id, kind, title, body, order_id)
  values (v_uid, 'order', 'Commande en préparation',
    'Votre commande ' || v_code || ' est en cours de préparation.',
    p_order);
end;
$$;

-- ── 2. Kitchen: hand a ready order off to the driver pool (staff only) ─────────
-- Flips a cooked order from 'ready' to 'en_route' once a driver physically takes
-- it (the kitchen confirms the handoff). For retrait orders this marks pickup.
-- Notifies the customer. Leaves tracking untouched — the driver app drives GPS.
create or replace function public.admin_handoff_to_driver(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_mode text; v_uid uuid; v_code text;
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;

  update orders o
    set status = 'en_route'
    where o.id = p_order and o.status = 'ready'
    returning o.mode, o.user_id, o.code into v_mode, v_uid, v_code;
  if not found then
    raise exception 'not_ready';  -- not cooked yet, already handed off, or unknown
  end if;

  insert into notifications (user_id, kind, title, body, order_id)
  values (v_uid, 'order',
    case when v_mode = 'retrait' then 'Commande récupérée' else 'Livreur en route' end,
    case when v_mode = 'retrait'
         then 'Votre commande ' || v_code || ' a bien été récupérée. Merci !'
         else 'Votre commande ' || v_code || ' est partie, le livreur est en route.' end,
    p_order);
end;
$$;

revoke all on function public.admin_start_preparation(uuid) from public;
revoke all on function public.admin_handoff_to_driver(uuid) from public;
grant execute on function public.admin_start_preparation(uuid) to authenticated, service_role;
grant execute on function public.admin_handoff_to_driver(uuid) to authenticated, service_role;
