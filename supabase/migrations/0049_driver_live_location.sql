-- 0049_driver_live_location.sql
-- Live position for EVERY online driver (not just those on a delivery). The driver
-- app streams its GPS to drivers.lat/lng while online; the admin map shows all
-- online drivers with a fresh position. `drivers` is already published to Realtime,
-- so the map updates live.

alter table public.drivers add column if not exists lat numeric;
alter table public.drivers add column if not exists lng numeric;
alter table public.drivers add column if not exists position_at timestamptz;

create or replace function public.driver_update_location(p_lat numeric, p_lng numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  update drivers set lat = p_lat, lng = p_lng, position_at = now()
    where user_id = auth.uid();
end;
$$;
revoke all on function public.driver_update_location(numeric, numeric) from public;
grant execute on function public.driver_update_location(numeric, numeric) to authenticated, service_role;
