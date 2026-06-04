-- La Villa — transactional, server-authoritative review submission.
-- Validates the order is owned by the caller and delivered, inserts the review
-- (one per order, enforced by the unique constraint), awards a fixed loyalty
-- bonus via the ledger, and recomputes balance + tier.
--
-- Returns the new loyalty balance so the client can reflect it immediately.

create or replace function public.submit_review(
  p_user uuid,
  p_order uuid,
  p_rating int,
  p_tags text[],
  p_comment text,
  p_photo_url text
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_award constant int := 50;
  v_status text;
  v_owner uuid;
  v_code text;
  v_lifetime int := 0;
  v_tier text := 'Gourmand';
  v_balance int := 0;
begin
  -- Bind to the authenticated caller (SECURITY DEFINER + granted to
  -- `authenticated` means this is callable directly from the browser client).
  -- Never trust the client-supplied p_user.
  if auth.uid() is null or p_user is distinct from auth.uid() then
    raise exception 'forbidden';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'invalid rating %', p_rating;
  end if;

  -- 1) Order must belong to the caller.
  select user_id, status, code into v_owner, v_status, v_code
    from orders where id = p_order;
  if not found or v_owner <> p_user then
    raise exception 'order not found';
  end if;
  if v_status <> 'delivered' then
    raise exception 'order not delivered';
  end if;

  -- 2) Insert review (unique(order_id) guards against double submission).
  insert into reviews (order_id, user_id, rating, tags, comment, photo_url, points_awarded)
  values (p_order, p_user, p_rating, coalesce(p_tags, '{}'),
          coalesce(p_comment, ''), p_photo_url, v_award);

  -- 3) Award the bonus through the ledger.
  insert into loyalty_ledger (user_id, delta_pts, reason, order_id)
  values (p_user, v_award, 'Avis commande ' || v_code, p_order);

  -- 4) Recompute lifetime → tier (mirrors place_order).
  v_lifetime := coalesce((select sum(delta_pts) from loyalty_ledger
                          where user_id = p_user and delta_pts > 0), 0);
  v_tier := case
    when v_lifetime >= 1500 then 'Cercle Villa'
    when v_lifetime >= 1000 then 'Gourmet'
    when v_lifetime >= 500  then 'Connaisseur'
    else 'Gourmand' end;

  update profiles
    set loyalty_points = loyalty_points + v_award,
        loyalty_tier = v_tier
    where id = p_user
    returning loyalty_points into v_balance;

  -- 5) Notify.
  insert into notifications (user_id, kind, title, body, order_id)
  values (p_user, 'loyalty', 'Merci pour votre avis !',
          '+' || v_award || ' points ont été ajoutés à votre solde.', p_order);

  return v_balance;
end;
$$;

revoke all on function public.submit_review(uuid, uuid, int, text[], text, text) from public;
grant execute on function public.submit_review(uuid, uuid, int, text[], text, text) to authenticated, service_role;
