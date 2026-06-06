-- La Villa — driver delivery history + earnings source.
--
-- The driver read policies (0008/0009) only expose orders that are still active
-- (status preparing/en_route), so a driver cannot read their own COMPLETED
-- deliveries through RLS. The History and Earnings screens need exactly that, so
-- we expose it through a SECURITY DEFINER RPC (same pattern as the other driver
-- RPCs) scoped to the current driver via lv_current_driver().
--
-- Earnings model: the driver earns the order's delivery fee (delivery_fee_dh).
-- Pickup ("retrait") orders carry a 0 fee, so they contribute 0 — the client
-- screens sum delivery_fee_dh to derive today / week / total earnings.

create or replace function public.driver_deliveries()
returns table (
  order_id        uuid,
  code            text,
  mode            text,
  address         text,
  total_dh        numeric,
  delivery_fee_dh numeric,
  delivered_at    timestamptz,
  placed_at       timestamptz
)
language sql stable security definer set search_path = public as $$
  select o.id, o.code, o.mode, o.address, o.total_dh, o.delivery_fee_dh,
         t.updated_at as delivered_at, o.placed_at
  from order_tracking t
  join orders o on o.id = t.order_id
  where t.driver_id = lv_current_driver()
    and o.status = 'delivered'
  order by t.updated_at desc;
$$;

revoke all on function public.driver_deliveries() from public;
grant execute on function public.driver_deliveries() to authenticated, service_role;
