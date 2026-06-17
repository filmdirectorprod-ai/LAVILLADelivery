-- La Villa — Driver presence. The admin Livreurs screen already reads & subscribes
-- to drivers.is_online (0014), but nothing wrote it. This adds the writer:
-- driver_set_presence(), called by the driver app on open / heartbeat / close, and
-- guarantees the drivers table is in the realtime publication so the admin sees
-- presence change live. Idempotent; run in the Supabase SQL editor (after 0021).

-- ── 1. Presence writer (a driver may only set their OWN presence) ─────────────
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

-- ── 2. Make sure presence changes are broadcast over Realtime ─────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'drivers'
  ) then
    alter publication supabase_realtime add table drivers;
  end if;
end $$;
