-- La Villa — transactional, server-authoritative order placement.
-- Recomputes all money from the products table (never trusts client prices),
-- applies promo + loyalty-palier redemption, awards points, recomputes tier,
-- creates the tracking row, assigns a driver, and clears the cart.
--
-- Pricing model (mirrors the prototype + lib/pricing.ts computeOrder):
--   subtotal   = Σ product.price_dh * qty * size_mult
--   delivery   = mode='retrait' ? 0 : (subtotal >= 200 ? 0 : zone_fee)   [default zone fee 18]
--   discount   = promo ? round(subtotal * 0.15) : 0
--   baseTotal  = subtotal + delivery - discount
--   ptsDiscount= redeem palier {pts,dh}, applied if balance >= pts: min(dh, baseTotal)
--   total      = baseTotal - ptsDiscount
--   earned     = floor(total)
--
-- p_items: jsonb array of { "product_id": uuid, "qty": int,
--                           "size_mult": numeric(optional), "customization": jsonb(optional) }

create or replace function public.place_order(
  p_user uuid,
  p_items jsonb,
  p_mode text,
  p_address text,
  p_zone uuid,
  p_promo boolean,
  p_redeem_pts int,
  p_redeem_dh numeric
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal numeric(10,2) := 0;
  v_delivery numeric(10,2) := 0;
  v_discount numeric(10,2) := 0;
  v_base numeric(10,2) := 0;
  v_pts_discount numeric(10,2) := 0;
  v_total numeric(10,2) := 0;
  v_zone_fee numeric(10,2) := 18;
  v_balance int := 0;
  v_redeem_pts int := 0;
  v_earned int := 0;
  v_lifetime int := 0;
  v_tier text := 'Gourmand';
  v_code text;
  v_driver uuid;
  v_order uuid;
  v_eta timestamptz := now() + interval '28 minutes';
  it jsonb;
  v_prod products%rowtype;
  v_qty int;
  v_mult numeric;
begin
  -- Bind to the authenticated caller. This RPC is SECURITY DEFINER and granted
  -- to `authenticated`, so it is reachable directly from the browser client —
  -- never trust the client-supplied p_user, or one user could place orders and
  -- spend another user's loyalty points. auth.uid() comes from the request JWT.
  if auth.uid() is null or p_user is distinct from auth.uid() then
    raise exception 'forbidden';
  end if;

  if p_mode not in ('livraison','retrait') then
    raise exception 'invalid mode %', p_mode;
  end if;

  -- 1) Subtotal from authoritative product prices.
  for it in select * from jsonb_array_elements(p_items) loop
    select * into v_prod from products where id = (it->>'product_id')::uuid and active;
    if not found then
      raise exception 'unknown product %', it->>'product_id';
    end if;
    v_qty := greatest(1, coalesce((it->>'qty')::int, 1));
    v_mult := coalesce((it->>'size_mult')::numeric, 1);
    if v_mult not in (0.25, 1, 1.6) then v_mult := 1; end if;
    v_subtotal := v_subtotal + round(v_prod.price_dh * v_mult, 2) * v_qty;
  end loop;

  if v_subtotal <= 0 then
    raise exception 'empty order';
  end if;

  -- 2) Delivery fee (threshold uses subtotal, pre-discount).
  if p_zone is not null then
    select fee_dh into v_zone_fee from delivery_zones where id = p_zone;
    v_zone_fee := coalesce(v_zone_fee, 18);
  end if;
  if p_mode = 'retrait' or v_subtotal >= 200 then
    v_delivery := 0;
  else
    v_delivery := v_zone_fee;
  end if;

  -- 3) Promo (15% off subtotal, rounded).
  if p_promo then
    v_discount := round(v_subtotal * 0.15, 0);
  end if;

  v_base := v_subtotal + v_delivery - v_discount;

  -- 4) Loyalty palier redemption (discrete pts->dh, validated + balance-checked).
  select loyalty_points into v_balance from profiles where id = p_user for update;
  v_balance := coalesce(v_balance, 0);
  if p_redeem_pts is not null and p_redeem_pts > 0 then
    -- validate the (pts, dh) pair against the known paliers.
    if (p_redeem_pts, p_redeem_dh) in ((250, 25), (500, 60), (1000, 130))
       and v_balance >= p_redeem_pts then
      v_pts_discount := least(p_redeem_dh, v_base);
      v_redeem_pts := p_redeem_pts;
    end if;
  end if;

  v_total := v_base - v_pts_discount;
  v_earned := floor(v_total);

  -- 5) Unique order code (CMD-XXXX) with collision retry.
  loop
    v_code := 'CMD-' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
    exit when not exists (select 1 from orders where code = v_code);
  end loop;

  -- 6) Assign a driver (first available; ok if null).
  select id into v_driver from drivers order by random() limit 1;

  -- 7) Insert order + items.
  insert into orders (code, user_id, status, mode, address, zone_id,
                      subtotal_dh, delivery_fee_dh, discount_dh, total_dh,
                      points_earned, points_redeemed, eta_at)
  values (v_code, p_user, 'preparing', p_mode, p_address, p_zone,
          v_subtotal, v_delivery, v_discount, v_total,
          v_earned, v_redeem_pts, v_eta)
  returning id into v_order;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into v_prod from products where id = (it->>'product_id')::uuid;
    v_qty := greatest(1, coalesce((it->>'qty')::int, 1));
    v_mult := coalesce((it->>'size_mult')::numeric, 1);
    if v_mult not in (0.25, 1, 1.6) then v_mult := 1; end if;
    insert into order_items (order_id, product_id, name_snapshot, price_snapshot, qty, customization)
    values (v_order, v_prod.id, v_prod.name, round(v_prod.price_dh * v_mult, 2), v_qty,
            coalesce(it->'customization', '{}'::jsonb));
  end loop;

  -- 8) Tracking row.
  insert into order_tracking (order_id, stage, progress, eta_at, driver_id)
  values (v_order, 0, 0, v_eta, v_driver);

  -- 9) Loyalty: ledger + balance + tier.
  if v_redeem_pts > 0 then
    insert into loyalty_ledger (user_id, delta_pts, reason, order_id)
    values (p_user, -v_redeem_pts, 'Réduction ' || to_char(v_pts_discount, 'FM999990D00') || ' DH utilisée', v_order);
  end if;
  insert into loyalty_ledger (user_id, delta_pts, reason, order_id)
  values (p_user, v_earned, 'Commande ' || v_code, v_order);

  v_lifetime := coalesce((select sum(delta_pts) from loyalty_ledger
                          where user_id = p_user and delta_pts > 0), 0);
  v_tier := case
    when v_lifetime >= 1500 then 'Cercle Villa'
    when v_lifetime >= 1000 then 'Gourmet'
    when v_lifetime >= 500  then 'Connaisseur'
    else 'Gourmand' end;

  update profiles
    set loyalty_points = loyalty_points - v_redeem_pts + v_earned,
        loyalty_tier = v_tier
    where id = p_user;

  -- 10) Clear the user's cart.
  delete from cart_items
    where cart_id in (select id from carts where user_id = p_user);

  -- 11) Notify.
  insert into notifications (user_id, kind, title, body, order_id)
  values (p_user, 'order', 'Commande confirmée',
          'Votre commande ' || v_code || ' est en préparation.', v_order);

  return v_order;
end;
$$;

-- Allow signed-in users to call it for themselves only.
revoke all on function public.place_order(uuid, jsonb, text, text, uuid, boolean, int, numeric) from public;
grant execute on function public.place_order(uuid, jsonb, text, text, uuid, boolean, int, numeric) to authenticated, service_role;
