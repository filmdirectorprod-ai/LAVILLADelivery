-- 0034_branch_assignment.sql  (Multi-agences — Phase 2a-ii)
-- Staff-only RPCs to assign a driver and a delivery zone to a branch. Same guard
-- pattern as the other admin RPCs (lv_is_staff()).

create or replace function public.admin_set_driver_branch(p_driver uuid, p_branch uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  update drivers set branch_id = p_branch where id = p_driver;
  if not found then raise exception 'driver not found'; end if;
end; $$;

create or replace function public.admin_set_zone_branch(p_zone uuid, p_branch uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  update delivery_zones set branch_id = p_branch where id = p_zone;
  if not found then raise exception 'zone not found'; end if;
end; $$;

revoke all on function public.admin_set_driver_branch(uuid, uuid) from public;
revoke all on function public.admin_set_zone_branch(uuid, uuid) from public;
grant execute on function public.admin_set_driver_branch(uuid, uuid) to authenticated, service_role;
grant execute on function public.admin_set_zone_branch(uuid, uuid) to authenticated, service_role;
