-- 0048_referral.sql
-- Referral programme: every customer has a shareable referral code/link. When a
-- referred customer's FIRST order is DELIVERED, the referrer earns +5 points.
--   profiles.referral_code     — unique shareable code (in /parrain/<code>).
--   profiles.referred_by       — who referred this customer.
--   profiles.referral_rewarded — guard so the +5 is granted once per referee.

alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists referred_by uuid references auth.users(id);
alter table public.profiles add column if not exists referral_rewarded boolean not null default false;

create or replace function public.lv_gen_referral_code()
returns text language plpgsql set search_path = public as $$
declare c text;
begin
  loop
    c := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from profiles where referral_code = c);
  end loop;
  return c;
end;
$$;

-- Backfill existing customers, then enforce uniqueness.
update public.profiles set referral_code = public.lv_gen_referral_code() where referral_code is null;
create unique index if not exists profiles_referral_code_uniq on public.profiles (referral_code);

-- New customers get a code (+ keep the 10-pt welcome bonus from 0047).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, loyalty_points, loyalty_tier, referral_code)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), 10, 'Gourmand', lv_gen_referral_code())
  on conflict (id) do nothing;
  if found then
    insert into loyalty_ledger (user_id, delta_pts, reason)
    values (new.id, 10, 'Bonus de bienvenue');
  end if;
  return new;
end;
$$;

-- A new customer links themselves to a referrer (before any order). Returns a
-- status: 'ok' | 'already' | 'invalid' | 'self'.
create or replace function public.apply_referral_code(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare v_self uuid := auth.uid(); v_ref uuid;
begin
  if v_self is null then raise exception 'forbidden'; end if;
  if exists (select 1 from profiles where id = v_self and referred_by is not null) then return 'already'; end if;
  select id into v_ref from profiles where referral_code = upper(trim(p_code));
  if v_ref is null then return 'invalid'; end if;
  if v_ref = v_self then return 'self'; end if;
  update profiles set referred_by = v_ref where id = v_self and referred_by is null;
  return 'ok';
end;
$$;
revoke all on function public.apply_referral_code(text) from public;
grant execute on function public.apply_referral_code(text) to authenticated, service_role;

-- When a referred customer's FIRST order is delivered, reward the referrer +5.
create or replace function public.lv_reward_referral_on_delivery()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ref uuid; v_rewarded boolean; v_count int; v_lifetime int;
begin
  if NEW.status = 'delivered' and OLD.status is distinct from 'delivered' then
    select referred_by, referral_rewarded into v_ref, v_rewarded from profiles where id = NEW.user_id;
    if v_ref is not null and not coalesce(v_rewarded, false) then
      select count(*) into v_count from orders where user_id = NEW.user_id and status = 'delivered';
      if v_count = 1 then
        insert into loyalty_ledger (user_id, delta_pts, reason) values (v_ref, 5, 'Parrainage — filleul');
        update profiles set loyalty_points = loyalty_points + 5 where id = v_ref;
        select coalesce(sum(delta_pts), 0) into v_lifetime from loyalty_ledger where user_id = v_ref and delta_pts > 0;
        update profiles set loyalty_tier = case
            when v_lifetime >= 1500 then 'Cercle Villa' when v_lifetime >= 1000 then 'Gourmet'
            when v_lifetime >= 500 then 'Connaisseur' else 'Gourmand' end
          where id = v_ref;
        update profiles set referral_rewarded = true where id = NEW.user_id;
        insert into notifications (user_id, kind, title, body)
        values (v_ref, 'loyalty', 'Parrainage récompensé', 'Votre filleul a passé sa première commande — +5 points !');
      end if;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_reward_referral on public.orders;
create trigger trg_reward_referral after update on public.orders
  for each row execute function public.lv_reward_referral_on_delivery();

-- Realtime usage on the admin Promotions screen.
alter publication supabase_realtime add table public.promo_redemptions;
