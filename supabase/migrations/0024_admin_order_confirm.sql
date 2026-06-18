-- La Villa — Manager confirmation flow (sub-project B), part 2.
-- Staff-only RPCs the gérant uses on a PENDING order before it enters the kitchen:
--   • admin_update_order_items   — replace items, recompute money (server-authoritative)
--   • admin_update_order_delivery — change address/zone, recompute delivery + total
--   • admin_confirm_order         — pending → preparing, notify the client
--   • admin_cancel_order          — → cancelled (with reason), notify the client
-- Money is always recomputed from the products table; the original promo discount
-- and points redemption are preserved as fixed DH amounts. Editing is only allowed
-- while the order is still `pending`. Idempotent; run after 0023.

-- ── 1. Replace items + recompute (pending only) ───────────────────────────────
create or replace function public.admin_update_order_items(p_order uuid, p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_mode text; v_zone uuid; v_status text;
  v_old_sub numeric(10,2); v_old_del numeric(10,2); v_old_disc numeric(10,2); v_old_total numeric(10,2);
  v_pts_disc numeric(10,2); v_zone_fee numeric(10,2) := 18;
  v_sub numeric(10,2) := 0; v_del numeric(10,2) := 0; v_total numeric(10,2) := 0;
  it jsonb; v_prod products%rowtype; v_qty int;
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;

  select status, mode, zone_id, subtotal_dh, delivery_fee_dh, discount_dh, total_dh
    into v_status, v_mode, v_zone, v_old_sub, v_old_del, v_old_disc, v_old_total
    from orders where id = p_order;
  if not found then raise exception 'not_found'; end if;
  if v_status <> 'pending' then raise exception 'not_pending'; end if;

  -- Original points-redemption discount in DH (preserved across the edit).
  v_pts_disc := greatest(0, v_old_sub + v_old_del - v_old_disc - v_old_total);

  delete from order_items where order_id = p_order;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into v_prod from products where id = (it->>'product_id')::uuid and active;
    if not found then raise exception 'unknown product %', it->>'product_id'; end if;
    v_qty := greatest(1, coalesce((it->>'qty')::int, 1));
    insert into order_items (order_id, product_id, name_snapshot, price_snapshot, qty, customization)
    values (p_order, v_prod.id, v_prod.name, round(v_prod.price_dh, 2), v_qty, '{}'::jsonb);
    v_sub := v_sub + round(v_prod.price_dh, 2) * v_qty;
  end loop;
  if v_sub <= 0 then raise exception 'empty order'; end if;

  if v_zone is not null then
    select fee_dh into v_zone_fee from delivery_zones where id = v_zone;
    v_zone_fee := coalesce(v_zone_fee, 18);
  end if;
  if v_mode = 'retrait' or v_sub >= 200 then v_del := 0; else v_del := v_zone_fee; end if;

  v_total := greatest(0, v_sub + v_del - v_old_disc - v_pts_disc);

  update orders
    set subtotal_dh = v_sub, delivery_fee_dh = v_del, total_dh = v_total,
        points_earned = floor(v_total)
    where id = p_order;
end;
$$;

-- ── 2. Change address / zone + recompute delivery (pending only) ──────────────
create or replace function public.admin_update_order_delivery(p_order uuid, p_address text, p_zone uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_mode text; v_status text;
  v_sub numeric(10,2); v_old_del numeric(10,2); v_old_disc numeric(10,2); v_old_total numeric(10,2);
  v_pts_disc numeric(10,2); v_zone_fee numeric(10,2) := 18; v_del numeric(10,2); v_total numeric(10,2);
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;

  select status, mode, subtotal_dh, delivery_fee_dh, discount_dh, total_dh
    into v_status, v_mode, v_sub, v_old_del, v_old_disc, v_old_total
    from orders where id = p_order;
  if not found then raise exception 'not_found'; end if;
  if v_status <> 'pending' then raise exception 'not_pending'; end if;

  v_pts_disc := greatest(0, v_sub + v_old_del - v_old_disc - v_old_total);

  if p_zone is not null then
    select fee_dh into v_zone_fee from delivery_zones where id = p_zone;
    v_zone_fee := coalesce(v_zone_fee, 18);
  end if;
  if v_mode = 'retrait' or v_sub >= 200 then v_del := 0; else v_del := v_zone_fee; end if;
  v_total := greatest(0, v_sub + v_del - v_old_disc - v_pts_disc);

  update orders
    set address = p_address, zone_id = p_zone,
        delivery_fee_dh = v_del, total_dh = v_total, points_earned = floor(v_total)
    where id = p_order;
end;
$$;

-- ── 3. Confirm: pending → preparing + notify ─────────────────────────────────
create or replace function public.admin_confirm_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_code text;
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  update orders set status = 'preparing'
    where id = p_order and status = 'pending'
    returning user_id, code into v_uid, v_code;
  if not found then raise exception 'not_pending'; end if;

  insert into notifications (user_id, kind, title, body, order_id)
  values (v_uid, 'order', 'Commande confirmée',
          'Votre commande ' || v_code || ' est confirmée et passe en préparation.', p_order);
end;
$$;

-- ── 4. Cancel (any non-terminal status) + notify with reason ─────────────────
create or replace function public.admin_cancel_order(p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_code text;
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  update orders set status = 'cancelled'
    where id = p_order and status not in ('delivered','cancelled')
    returning user_id, code into v_uid, v_code;
  if not found then raise exception 'not_cancellable'; end if;

  insert into notifications (user_id, kind, title, body, order_id)
  values (v_uid, 'order', 'Commande annulée',
          'Votre commande ' || v_code || ' a été annulée' ||
          case when coalesce(btrim(p_reason),'') <> '' then ' : ' || p_reason else '.' end,
          p_order);
end;
$$;

revoke all on function public.admin_update_order_items(uuid, jsonb) from public;
revoke all on function public.admin_update_order_delivery(uuid, text, uuid) from public;
revoke all on function public.admin_confirm_order(uuid) from public;
revoke all on function public.admin_cancel_order(uuid, text) from public;
grant execute on function public.admin_update_order_items(uuid, jsonb) to authenticated, service_role;
grant execute on function public.admin_update_order_delivery(uuid, text, uuid) to authenticated, service_role;
grant execute on function public.admin_confirm_order(uuid) to authenticated, service_role;
grant execute on function public.admin_cancel_order(uuid, text) to authenticated, service_role;
