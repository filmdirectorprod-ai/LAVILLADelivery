-- La Villa — make the simulated mover let go of real-driver deliveries.
--
-- Background: advance_deliveries() (0005) runs every 30s via pg_cron and pushes
-- progress/stage forward on EVERY active order. That was fine while the app was
-- pure simulation, but it steamrolls orders a real livreur has claimed: when a
-- driver accepts an order, driver_accept_order (0008) sets order_tracking.manual
-- = true and takes over the stage/GPS via driver_update_status /
-- driver_update_position. The mover kept advancing those rows anyway, so the
-- customer's tracking page reflected the simulation instead of the real driver,
-- and the order auto-"delivered" itself out from under the livreur.
--
-- Fix: the mover only touches simulated rows (manual = false / null). Manual
-- rows are owned end-to-end by the real driver. This is the "auto-mover lets go"
-- behaviour the 0008 comments always described but never actually enforced.

create or replace function public.advance_deliveries()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  step numeric := 0.06;       -- ~17 ticks end-to-end; at 30s/tick ≈ 8.5 min
begin
  -- advance progress on every SIMULATED active order (skip real-driver rows)
  update order_tracking t
    set progress = least(1.0, t.progress + step),
        stage = lv_stage_for(least(1.0, t.progress + step)),
        eta_at = now() + (greatest(0, (1.0 - least(1.0, t.progress + step))) * interval '28 minutes'),
        updated_at = now()
    from orders o
    where o.id = t.order_id
      and o.status in ('preparing','en_route')
      and coalesce(t.manual, false) = false;

  -- sync order.status from the new progress (simulated rows only)
  update orders o
    set status = case
      when t.progress >= 1.0 then 'delivered'
      when t.progress >= 0.5 then 'en_route'
      else 'preparing' end
    from order_tracking t
    where t.order_id = o.id
      and o.status in ('preparing','en_route')
      and coalesce(t.manual, false) = false;
end;
$$;
