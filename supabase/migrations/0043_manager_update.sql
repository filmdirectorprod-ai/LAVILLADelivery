-- 0043_manager_update.sql  (#2c — edit a branch gérant)
-- Super-admin can rename a gérant and reassign their agency. Deletion (which also
-- removes the auth user) is handled by DELETE /api/admin/managers with the service role.

create or replace function public.admin_update_manager(p_user uuid, p_name text, p_branch uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  if lv_staff_branch() is not null then raise exception 'forbidden'; end if; -- super-admin only
  if p_branch is null then raise exception 'branch required'; end if;
  update profiles
    set full_name = coalesce(nullif(trim(p_name), ''), full_name), branch_id = p_branch
    where id = p_user and is_staff = true and branch_id is not null;
  if not found then raise exception 'manager not found'; end if;
end; $$;

revoke all on function public.admin_update_manager(uuid, text, uuid) from public;
grant execute on function public.admin_update_manager(uuid, text, uuid) to authenticated, service_role;
