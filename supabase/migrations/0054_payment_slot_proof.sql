-- 0054_payment_slot_proof.sql
-- Ce que la commande ne disait pas encore, et qui manquait aux deux apps :
--
--  • payment_method : le moyen de paiement choisi au paiement n'était envoyé
--    nulle part. Il est maintenant stocké sur la commande (le gérant le voit,
--    le livreur sait s'il doit encaisser).
--  • slot_at / slot_label : le créneau choisi ("au plus vite", 12:30, 19:00)
--    était ignoré. Il est stocké, et la cuisine peut ne montrer une commande
--    programmée qu'à l'approche du créneau.
--  • delivery_code : un code à 4 chiffres par commande livrée. Le client le
--    voit sur son suivi, le livreur le saisit pour clore la course.
--  • proof_url : photo facultative du dépôt, quand le client ne peut pas
--    donner le code.
--  • dest_lat / dest_lng : les coordonnées de l'adresse choisie, pour que le
--    suivi calcule une distance et une arrivée RÉELLES depuis la position du
--    livreur, au lieu du trajet d'exemple codé en dur.
--  • driver_report_incident : le livreur peut signaler un incident depuis sa
--    course ; il remonte dans la page Incidents de l'admin (table réservée au
--    staff par RLS, d'où la fonction SECURITY DEFINER).
--
-- driver_update_status accepte le code / la preuve et refuse de clore une
-- livraison sans l'un des deux. driver_deliveries renvoie le moyen de paiement
-- pour que l'écran Tournée affiche les espèces à remettre à l'agence.

-- ── Colonnes ────────────────────────────────────────────────────────────────
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists slot_at timestamptz;
alter table public.orders add column if not exists slot_label text;
alter table public.orders add column if not exists delivery_code text;
alter table public.orders add column if not exists proof_url text;
alter table public.orders add column if not exists dest_lat numeric;
alter table public.orders add column if not exists dest_lng numeric;

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method is null or payment_method in ('cod', 'cmi', 'hps', 'cashplus', 'virement'));

-- Les commandes déjà passées l'ont été en espèces à la livraison.
update public.orders set payment_method = 'cod' where payment_method is null;

-- ── place_order : moyen de paiement, créneau, code de livraison, destination ─
-- Reprend 0047 à l'identique (prix, promo, points, fidélité) et n'ajoute que
-- les nouveaux paramètres, tous facultatifs : un ancien client qui n'envoie
-- rien obtient le comportement précédent, en espèces.
-- L'ancienne signature (11 paramètres) doit disparaître : sinon un appel à 8
-- arguments correspond aux deux surcharges et Postgres refuse — « function
-- place_order(...) is not unique ». Même convention qu'en 0031 / 0033 / 0038.
drop function if exists public.place_order(uuid, jsonb, text, text, uuid, boolean, int, numeric, text, text, text);

create or replace function public.place_order(
  p_user uuid, p_items jsonb, p_mode text, p_address text, p_zone uuid, p_promo boolean,
  p_redeem_pts integer, p_redeem_dh numeric, p_phone text DEFAULT NULL::text,
  p_branch_slug text DEFAULT NULL::text, p_promo_code text DEFAULT NULL::text,
  p_payment text DEFAULT 'cod', p_slot_at timestamptz DEFAULT NULL,
  p_slot_label text DEFAULT NULL, p_dest_lat numeric DEFAULT NULL, p_dest_lng numeric DEFAULT NULL)
returns uuid language plpgsql security definer set search_path TO 'public' as $function$
declare
  v_subtotal numeric(10,2) := 0; v_delivery numeric(10,2) := 0; v_discount numeric(10,2) := 0;
  v_base numeric(10,2) := 0; v_pts_discount numeric(10,2) := 0; v_total numeric(10,2) := 0;
  v_zone_fee numeric(10,2) := 18; v_balance int := 0; v_redeem_pts int := 0; v_earned int := 0;
  v_lifetime int := 0; v_tier text := 'Gourmand'; v_code text; v_order uuid;
  v_eta timestamptz := now() + interval '28 minutes'; it jsonb; v_prod products%rowtype; v_qty int; v_mult numeric;
  v_branch uuid; v_avail boolean; v_promo_id uuid; v_disc numeric;
  v_pay text; v_delivery_code text;
begin
  if auth.uid() is null or p_user is distinct from auth.uid() then raise exception 'forbidden'; end if;
  if p_mode not in ('livraison','retrait') then raise exception 'invalid mode %', p_mode; end if;

  v_pay := coalesce(nullif(trim(coalesce(p_payment, '')), ''), 'cod');
  if v_pay not in ('cod','cmi','hps','cashplus','virement') then raise exception 'invalid payment %', v_pay; end if;
  -- Un créneau ne peut pas être dans le passé ni au-delà de 7 jours.
  if p_slot_at is not null and (p_slot_at < now() - interval '5 minutes' or p_slot_at > now() + interval '7 days') then
    raise exception 'invalid slot';
  end if;

  if p_mode = 'retrait' then
    select id into v_branch from branches where slug = coalesce(p_branch_slug, 'riad');
  else
    select branch_id into v_branch from delivery_zones where id = p_zone;
  end if;
  if v_branch is null then select id into v_branch from branches where slug = 'riad'; end if;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into v_prod from products where id = (it->>'product_id')::uuid and active;
    if not found then raise exception 'unknown product %', it->>'product_id'; end if;
    select coalesce((select pb.in_stock from product_branch pb
                     where pb.product_id = v_prod.id and pb.branch_id = v_branch), v_prod.in_stock)
      into v_avail;
    if not v_avail then raise exception 'product % out of stock at branch', v_prod.name; end if;
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

  if p_promo_code is not null and length(trim(p_promo_code)) > 0 then
    select pr.discount_dh, pr.promotion_id into v_disc, v_promo_id
      from validate_promo(p_promo_code, v_subtotal, v_branch) pr where pr.valid;
    if v_promo_id is null then raise exception 'invalid promo code'; end if;
    v_discount := v_disc;
  elsif p_promo then
    v_discount := round(v_subtotal * 0.15, 0);
  end if;
  v_base := v_subtotal + v_delivery - v_discount;

  select loyalty_points into v_balance from profiles where id = p_user for update;
  v_balance := coalesce(v_balance, 0);
  if p_redeem_pts is not null and p_redeem_pts > 0 then
    if (p_redeem_pts, p_redeem_dh) in ((100, 10), (250, 25), (500, 60), (1000, 130)) and v_balance >= p_redeem_pts then
      v_pts_discount := least(p_redeem_dh, v_base); v_redeem_pts := p_redeem_pts;
    end if;
  end if;
  v_total := v_base - v_pts_discount; v_earned := greatest(10, floor(v_total));

  loop
    v_code := 'CMD-' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
    exit when not exists (select 1 from orders where code = v_code);
  end loop;
  -- Code de remise : 4 chiffres, montrés au client et demandés au livreur.
  v_delivery_code := lpad((floor(random() * 10000))::int::text, 4, '0');

  -- Créneau : l'arrivée annoncée suit le créneau choisi quand il y en a un.
  if p_slot_at is not null then v_eta := p_slot_at; end if;

  insert into orders (code, user_id, status, mode, address, phone, zone_id, branch_id,
                      subtotal_dh, delivery_fee_dh, discount_dh, total_dh,
                      points_earned, points_redeemed, eta_at,
                      payment_method, slot_at, slot_label, delivery_code, dest_lat, dest_lng)
  values (v_code, p_user, 'pending', p_mode, p_address, nullif(trim(coalesce(p_phone,'')), ''), p_zone, v_branch,
          v_subtotal, v_delivery, v_discount, v_total, v_earned, v_redeem_pts, v_eta,
          v_pay, p_slot_at, nullif(trim(coalesce(p_slot_label,'')), ''), v_delivery_code, p_dest_lat, p_dest_lng)
  returning id into v_order;

  if v_promo_id is not null then
    insert into promo_redemptions (promotion_id, user_id, order_id, discount_dh)
    values (v_promo_id, p_user, v_order, v_discount);
  end if;

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
end; $function$;

revoke all on function public.place_order(uuid, jsonb, text, text, uuid, boolean, integer, numeric, text, text, text, text, timestamptz, text, numeric, numeric) from public;
grant execute on function public.place_order(uuid, jsonb, text, text, uuid, boolean, integer, numeric, text, text, text, text, timestamptz, text, numeric, numeric) to authenticated, service_role;

-- ── driver_update_status : code de remise ou photo pour clore une livraison ──
-- Idem : la version à 2 paramètres rendrait ambigu driver_update_status(o, 4).
drop function if exists public.driver_update_status(uuid, int);

create or replace function public.driver_update_status(
  p_order uuid, p_stage int, p_code text DEFAULT NULL, p_proof text DEFAULT NULL)
returns void language plpgsql security definer set search_path = public as $$
declare v_driver uuid; v_prog numeric; v_order orders%rowtype;
begin
  v_driver := lv_current_driver();
  if v_driver is null then raise exception 'forbidden'; end if;
  if p_stage not in (2,3,4) then raise exception 'invalid stage %', p_stage; end if;

  if not exists (select 1 from order_tracking t
                 where t.order_id = p_order and t.driver_id = v_driver) then
    raise exception 'forbidden';
  end if;

  select * into v_order from orders where id = p_order;

  -- Clore une LIVRAISON demande une preuve : le code du client, ou une photo.
  if p_stage = 4 and v_order.mode = 'livraison' and v_order.delivery_code is not null then
    if coalesce(nullif(trim(coalesce(p_proof, '')), ''), '') = '' then
      if regexp_replace(coalesce(p_code, ''), '\D', '', 'g') is distinct from v_order.delivery_code then
        raise exception 'bad delivery code';
      end if;
    end if;
  end if;

  if p_proof is not null and trim(p_proof) <> '' then
    update orders set proof_url = p_proof where id = p_order;
  end if;

  v_prog := case p_stage when 2 then 0.35 when 3 then 0.50 when 4 then 1.0 end;

  update order_tracking t
    set stage = p_stage,
        progress = greatest(t.progress, v_prog),
        eta_at = now() + (greatest(0, 1.0 - greatest(t.progress, v_prog)) * interval '28 minutes'),
        updated_at = now()
    where t.order_id = p_order and t.driver_id = v_driver;

  update orders o
    set status = case when p_stage >= 4 then 'delivered'
                      when p_stage >= 3 then 'en_route'
                      else 'ready' end
    where o.id = p_order;

  insert into notifications (user_id, kind, title, body, order_id)
  select o.user_id, 'order',
    case p_stage when 2 then 'Commande récupérée'
                 when 3 then 'Livreur en route'
                 else 'Commande livrée' end,
    case p_stage when 2 then 'Votre livreur a récupéré votre commande.'
                 when 3 then 'Votre livreur est en route vers vous.'
                 else 'Votre commande a été livrée. Bon appétit !' end,
    o.id
  from orders o where o.id = p_order;
end;
$$;
revoke all on function public.driver_update_status(uuid, int, text, text) from public;
grant execute on function public.driver_update_status(uuid, int, text, text) to authenticated, service_role;

-- ── Le livreur signale un incident depuis sa course ──────────────────────────
-- `incidents` est réservée au staff (0018) : cette fonction SECURITY DEFINER
-- ouvre exactement une écriture, sur une commande que CE livreur a prise.
create or replace function public.driver_report_incident(
  p_order uuid, p_kind text, p_severity text, p_detail text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_driver uuid; v_id uuid; v_kind text; v_sev text; v_code text;
begin
  v_driver := lv_current_driver();
  if v_driver is null then raise exception 'forbidden'; end if;
  if not exists (select 1 from order_tracking t
                 where t.order_id = p_order and t.driver_id = v_driver) then
    raise exception 'forbidden';
  end if;

  v_kind := lower(coalesce(nullif(trim(coalesce(p_kind, '')), ''), 'autre'));
  if v_kind not in ('retard','litige','accident','autre') then v_kind := 'autre'; end if;
  v_sev := lower(coalesce(nullif(trim(coalesce(p_severity, '')), ''), 'moyenne'));
  if v_sev not in ('basse','moyenne','haute') then v_sev := 'moyenne'; end if;

  select code into v_code from orders where id = p_order;

  insert into incidents (title, kind, severity, detail, driver_id, order_id, created_by)
  values (
    case v_kind when 'retard' then 'Retard signalé par le livreur'
                when 'litige' then 'Litige signalé par le livreur'
                when 'accident' then 'Accident signalé par le livreur'
                else 'Incident signalé par le livreur' end || ' — ' || coalesce(v_code, ''),
    v_kind, v_sev, coalesce(nullif(trim(coalesce(p_detail, '')), ''), ''),
    v_driver, p_order, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.driver_report_incident(uuid, text, text, text) from public;
grant execute on function public.driver_report_incident(uuid, text, text, text) to authenticated, service_role;

-- ── driver_deliveries : ajoute le moyen de paiement (espèces à remettre) ─────
drop function if exists public.driver_deliveries();
create or replace function public.driver_deliveries()
returns table (
  order_id        uuid,
  code            text,
  mode            text,
  address         text,
  total_dh        numeric,
  delivery_fee_dh numeric,
  payment_method  text,
  delivered_at    timestamptz,
  placed_at       timestamptz
)
language sql stable security definer set search_path = public as $$
  select o.id, o.code, o.mode, o.address, o.total_dh, o.delivery_fee_dh,
         coalesce(o.payment_method, 'cod') as payment_method,
         t.updated_at as delivered_at, o.placed_at
  from order_tracking t
  join orders o on o.id = t.order_id
  where t.driver_id = lv_current_driver()
    and o.status = 'delivered'
  order by t.updated_at desc;
$$;
revoke all on function public.driver_deliveries() from public;
grant execute on function public.driver_deliveries() to authenticated, service_role;

-- ── Photos de preuve de livraison ───────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('delivery-proofs', 'delivery-proofs', true)
on conflict (id) do nothing;
drop policy if exists "delivery-proofs public read" on storage.objects;
create policy "delivery-proofs public read" on storage.objects
  for select using (bucket_id = 'delivery-proofs');
drop policy if exists "delivery-proofs driver insert" on storage.objects;
create policy "delivery-proofs driver insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'delivery-proofs' and lv_current_driver() is not null);
