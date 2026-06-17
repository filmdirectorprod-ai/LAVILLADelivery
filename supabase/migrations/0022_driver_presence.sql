-- La Villa — Driver presence writer. The admin Livreurs screen already reads &
-- subscribes to drivers.is_online (0014, and `drivers` is already in the realtime
-- publication), but nothing wrote it. This adds the writer the driver app calls on
-- open / heartbeat / close. Idempotent; run in the Supabase SQL editor (after 0021).

-- A driver may only set their OWN presence (matched via auth.uid()).
create or replace function public.driver_set_presence(p_online boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update drivers
    set is_online = coalesce(p_online, false),
        last_seen = now()
    where user_id = auth.uid();
  -- No matching driver row → caller isn't a linked driver; silently no-op.
end;
$$;

revoke all on function public.driver_set_presence(boolean) from public;
grant execute on function public.driver_set_presence(boolean) to authenticated, service_role;

-- Ask PostgREST to refresh its schema cache so the RPC is callable immediately.
notify pgrst, 'reload schema';
