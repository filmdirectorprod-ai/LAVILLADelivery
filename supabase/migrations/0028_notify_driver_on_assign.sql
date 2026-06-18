-- La Villa — notify a driver when the gérant assigns them an order, so the driver
-- app's notification bell rings (with sound). Extends admin_assign_driver (0015)
-- with a notification insert for the driver's linked login account. Idempotent.
create or replace function public.admin_assign_driver(p_order uuid, p_driver uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_code text;
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  if not exists (select 1 from orders where id = p_order) then raise exception 'unknown order'; end if;
  if not exists (select 1 from drivers where id = p_driver) then raise exception 'unknown driver'; end if;

  insert into order_tracking (order_id, stage, progress, driver_id, manual, updated_at)
  values (p_order, 0, 0, p_driver, true, now())
  on conflict (order_id)
  do update set driver_id = excluded.driver_id, manual = true, updated_at = now();

  select user_id into v_user from drivers where id = p_driver;
  select code into v_code from orders where id = p_order;
  if v_user is not null then
    insert into notifications (user_id, kind, title, body, order_id)
    values (v_user, 'order', 'Nouvelle course',
      'La commande ' || coalesce(v_code,'') || ' vous a été assignée.', p_order);
  end if;
end;
$$;
revoke all on function public.admin_assign_driver(uuid, uuid) from public;
grant execute on function public.admin_assign_driver(uuid, uuid) to authenticated, service_role;
