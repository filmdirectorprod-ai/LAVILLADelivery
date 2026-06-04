-- La Villa — simulated delivery "mover".
-- Advances active orders along the route so the client (subscribed to
-- order_tracking via Realtime) sees the marker + timeline move without polling.
--
-- progress is the master clock 0..1 for the whole journey. Stage is derived:
--   [0,0.10)  -> 0  Commande confirmée
--   [0.10,0.35) -> 1  En préparation
--   [0.35,0.50) -> 2  Récupérée par le livreur
--   [0.50,1.00) -> 3  En route
--   >= 1.00    -> 4  Livrée
-- status: 'preparing' while progress < 0.5, 'en_route' in [0.5,1), 'delivered' at 1.

create or replace function public.lv_stage_for(p numeric)
returns int language sql immutable as $$
  select case
    when p >= 1.0  then 4
    when p >= 0.50 then 3
    when p >= 0.35 then 2
    when p >= 0.10 then 1
    else 0 end;
$$;

create or replace function public.advance_deliveries()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  step numeric := 0.06;       -- ~17 ticks end-to-end; at 30s/tick ≈ 8.5 min
begin
  -- advance progress on every active order
  update order_tracking t
    set progress = least(1.0, t.progress + step),
        stage = lv_stage_for(least(1.0, t.progress + step)),
        eta_at = now() + (greatest(0, (1.0 - least(1.0, t.progress + step))) * interval '28 minutes'),
        updated_at = now()
    from orders o
    where o.id = t.order_id
      and o.status in ('preparing','en_route');

  -- sync order.status from the new progress
  update orders o
    set status = case
      when t.progress >= 1.0 then 'delivered'
      when t.progress >= 0.5 then 'en_route'
      else 'preparing' end
    from order_tracking t
    where t.order_id = o.id
      and o.status in ('preparing','en_route');
end;
$$;

-- Schedule the mover. Supabase supports the seconds interval form; if the
-- platform only allows minute granularity, replace with '* * * * *' and raise
-- `step` to ~0.12 so a delivery still completes in a handful of minutes.
create extension if not exists pg_cron;
select cron.schedule('lv_mover', '30 seconds', $$ select public.advance_deliveries(); $$);

-- Enable Realtime broadcasts on the tables the client subscribes to.
alter publication supabase_realtime add table order_tracking;
alter publication supabase_realtime add table notifications;
