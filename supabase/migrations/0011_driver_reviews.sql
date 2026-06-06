-- La Villa — expose a driver's own client reviews for the "Tournée" stats screen.
--
-- reviews are RLS-scoped to their author (the customer), so a driver cannot read
-- the ratings left on the orders they delivered. The driver stats screen wants
-- exactly that — "Mes évaluations clients" — so we surface it through a
-- SECURITY DEFINER RPC scoped to the current driver via lv_current_driver()
-- (same pattern as driver_deliveries, 0010).
--
-- A review is linked to an order (reviews.order_id) and the order has a tracking
-- row (order_tracking.driver_id). We return the reviews on every order this
-- driver delivered, joined to the customer's display name for the card.

create or replace function public.driver_reviews()
returns table (
  review_id     uuid,
  rating        int,
  tags          text[],
  comment       text,
  created_at    timestamptz,
  customer_name text
)
language sql stable security definer set search_path = public as $$
  select r.id, r.rating, r.tags, r.comment, r.created_at,
         coalesce(p.full_name, 'Client')
  from reviews r
  join order_tracking t on t.order_id = r.order_id
  left join profiles p on p.id = r.user_id
  where t.driver_id = lv_current_driver()
  order by r.created_at desc;
$$;

revoke all on function public.driver_reviews() from public;
grant execute on function public.driver_reviews() to authenticated, service_role;
