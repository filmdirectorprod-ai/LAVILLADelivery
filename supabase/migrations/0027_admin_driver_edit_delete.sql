-- La Villa — staff-only edit + delete for drivers (admin Livreurs screen).
-- Delete detaches deliveries (order_tracking.driver_id is NO ACTION), then removes
-- the driver (cascades shifts + support, nulls incidents) and the linked login.
-- Idempotent; run after 0026.
create or replace function public.admin_update_driver(p_id uuid, p_name text, p_phone text, p_vehicle text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  if coalesce(btrim(p_name),'') = '' then raise exception 'name_required'; end if;
  update drivers
    set name = btrim(p_name),
        phone = nullif(btrim(p_phone), ''),
        vehicle = nullif(btrim(p_vehicle), '')
    where id = p_id;
  if not found then raise exception 'not_found'; end if;
end;
$$;

create or replace function public.admin_delete_driver(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  select user_id into v_user from drivers where id = p_id;
  if not found then raise exception 'not_found'; end if;
  update order_tracking set driver_id = null where driver_id = p_id;
  delete from drivers where id = p_id;
  if v_user is not null then delete from auth.users where id = v_user; end if;
end;
$$;

revoke all on function public.admin_update_driver(uuid, text, text, text) from public;
revoke all on function public.admin_delete_driver(uuid) from public;
grant execute on function public.admin_update_driver(uuid, text, text, text) to authenticated, service_role;
grant execute on function public.admin_delete_driver(uuid) to authenticated, service_role;
