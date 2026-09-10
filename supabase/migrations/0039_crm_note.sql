-- 0039_crm_note.sql  (#5 CRM client)
-- A free-text note per customer, editable by staff from the CRM screen.

alter table public.profiles add column if not exists crm_note text;

create or replace function public.admin_set_customer_note(p_user uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  update profiles set crm_note = nullif(trim(coalesce(p_note, '')), '') where id = p_user;
  if not found then raise exception 'customer not found'; end if;
end; $$;
revoke all on function public.admin_set_customer_note(uuid, text) from public;
grant execute on function public.admin_set_customer_note(uuid, text) to authenticated, service_role;
