-- 0033_branches_foundation.sql  (Multi-agences — Phase 2a-i)
-- Real branches + the branch dimension on zones / drivers / orders, plus order
-- attribution in place_order. Additive and backward-compatible: every existing row
-- is backfilled to the default branch (riad), so the single-branch app keeps working.

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  address text,
  phone text,
  plus_code text,
  lat numeric,
  lng numeric,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed the two La Villa agencies (slugs match lib/branches.ts).
insert into public.branches (slug, name, address, phone, lat, lng, plus_code) values
  ('riad',  'La Villa Riad — Ville Nouvelle', '117 Av. Mohammed Bahnini, Fès', '05 35 60 44 66', 34.0261, -5.014,  null),
  ('badie', 'La Villa Badie — Saïss',          'XXQP+WJ8, Fès (Saïss)',         '05 35 69 15 61', 33.9898, -5.0134, 'XXQP+WJ8')
on conflict (slug) do nothing;

-- Branch dimension (nullable FK; existing rows backfilled below).
alter table public.delivery_zones add column if not exists branch_id uuid references public.branches(id);
alter table public.drivers        add column if not exists branch_id uuid references public.branches(id);
alter table public.orders         add column if not exists branch_id uuid references public.branches(id);

-- Backfill everything to the default branch so nothing is orphaned.
update public.delivery_zones set branch_id = (select id from public.branches where slug='riad') where branch_id is null;
update public.drivers        set branch_id = (select id from public.branches where slug='riad') where branch_id is null;
update public.orders         set branch_id = (select id from public.branches where slug='riad') where branch_id is null;

-- branches is public-readable (the customer/driver/admin apps all show shop info);
-- writes stay staff-only via existing admin RPC patterns (added in later phases).
alter table public.branches enable row level security;
drop policy if exists branches_read on public.branches;
create policy branches_read on public.branches for select using (true);

-- place_order now attributes the order to a branch: retrait → chosen branch,
-- livraison → the zone's branch (fallback: default branch).
drop function if exists public.place_order(uuid, jsonb, text, text, uuid, boolean, int, numeric, text);

create or replace function public.place_order(
  p_user uuid, p_items jsonb, p_mode text, p_address text, p_zone uuid,
  p_promo boolean, p_redeem_pts int, p_redeem_dh numeric, p_phone text default null,
  p_branch_slug text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_subtotal numeric(10,2) := 0; v_delivery numeric(10,2) := 0; v_discount numeric(10,2) := 0;
  v_base numeric(10,2) := 0; v_pts_discount numeric(10,2) := 0; v_total numeric(10,2) := 0;
  v_zone_fee numeric(10,2) := 18; v_balance int := 0; v_redeem_pts int := 0; v_earned int := 0;
  v_lifetime int := 0; v_tier text := 'Gourmand'; v_code text; v_order uuid;
  v_eta timestamptz := now() + interval '28 minutes'; it jsonb; v_prod products%rowtype; v_qty int; v_mult numeric;
  v_branch uuid;
begin
  if auth.uid() is null or p_user is distinct from auth.uid() then raise exception 'forbidden'; end if;
  if p_mode not in ('livraison','retrait') then raise exception 'invalid mode %', p_mode; end if;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into v_prod from products where id = (it->>'product_id')::uuid and active;
    if not found then raise exception 'unknown product %', it->>'product_id'; end if;
    v_qty := greatest(1, coalesce((it->>'qty')::int, 1));
    v_mult := coalesce((it->>'size_mult')::numeric, 1);
    if v_mult not in (0.25, 1, 1.6) then v_mult := 1; end if;
    v_subtotal := v_subtotal + round(v_prod.price_dh * v_mult, 2) * v_qty;
  end loop;
  if v_subtotal <= 0 then raise exception 'empty order'; end if;

  if p_zone is not null then
    select fee_dh into v_zone_fee from delivery_zones where id = p_zone;
    v_zone_fee := coalesce(v_zone_fee, 18);
  end if;
  if p_mode = 'retrait' or v_subtotal >= 200 then v_delivery := 0; else v_delivery := v_zone_fee; end if;

  if p_promo then v_discount := round(v_subtotal * 0.15, 0); end if;
  v_base := v_subtotal + v_delivery - v_discount;

  select loyalty_points into v_balance from profiles where id = p_user for update;
  v_balance := coalesce(v_balance, 0);
  if p_redeem_pts is not null and p_redeem_pts > 0 then
    if (p_redeem_pts, p_redeem_dh) in ((250, 25), (500, 60), (1000, 130)) and v_balance >= p_redeem_pts then
      v_pts_discount := least(p_redeem_dh, v_base); v_redeem_pts := p_redeem_pts;
    end if;
  end if;
  v_total := v_base - v_pts_discount; v_earned := floor(v_total);

  loop
    v_code := 'CMD-' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
    exit when not exists (select 1 from orders where code = v_code);
  end loop;

  -- Resolve the fulfilling branch.
  if p_mode = 'retrait' then
    select id into v_branch from branches where slug = coalesce(p_branch_slug, 'riad');
  else
    select branch_id into v_branch from delivery_zones where id = p_zone;
  end if;
  if v_branch is null then select id into v_branch from branches where slug = 'riad'; end if;

  insert into orders (code, user_id, status, mode, address, phone, zone_id, branch_id,
                      subtotal_dh, delivery_fee_dh, discount_dh, total_dh,
                      points_earned, points_redeemed, eta_at)
  values (v_code, p_user, 'pending', p_mode, p_address, nullif(trim(coalesce(p_phone,'')), ''), p_zone, v_branch,
          v_subtotal, v_delivery, v_discount, v_total, v_earned, v_redeem_pts, v_eta)
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

  insert into order_tracking (order_id, stage, progress, eta_at, driver_id)
  values (v_order, 0, 0, v_eta, null);

  if v_redeem_pts > 0 then
    insert into loyalty_ledger (user_id, delta_pts, reason, order_id)
    values (p_user, -v_redeem_pts, 'Réduction ' || to_char(v_pts_discount, 'FM999990D00') || ' DH utilisée', v_order);
  end if;
  insert into loyalty_ledger (user_id, delta_pts, reason, order_id)
  values (p_user, v_earned, 'Commande ' || v_code, v_order);

  v_lifetime := coalesce((select sum(delta_pts) from loyalty_ledger where user_id = p_user and delta_pts > 0), 0);
  v_tier := case when v_lifetime >= 1500 then 'Cercle Villa' when v_lifetime >= 1000 then 'Gourmet'
                 when v_lifetime >= 500 then 'Connaisseur' else 'Gourmand' end;

  update profiles
    set loyalty_points = loyalty_points - v_redeem_pts + v_earned, loyalty_tier = v_tier,
        phone = coalesce(nullif(trim(phone), ''), nullif(trim(coalesce(p_phone,'')), ''))
    where id = p_user;

  delete from cart_items where cart_id in (select id from carts where user_id = p_user);

  insert into notifications (user_id, kind, title, body, order_id)
  values (p_user, 'order', 'Commande reçue',
          'Votre commande ' || v_code || ' a bien été reçue. En attente de confirmation.', v_order);

  return v_order;
end; $$;

revoke all on function public.place_order(uuid, jsonb, text, text, uuid, boolean, int, numeric, text, text) from public;
grant execute on function public.place_order(uuid, jsonb, text, text, uuid, boolean, int, numeric, text, text) to authenticated, service_role;
