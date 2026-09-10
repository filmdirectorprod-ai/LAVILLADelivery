-- 0037_promotions.sql  (#3 Promotions — step 1: model + validation + admin CRUD)
-- Code-based promotions replacing the blanket 15% toggle. A promo can be scoped to
-- one branch (branch_id null = all agencies), windowed, floored by a minimum order,
-- and capped globally and per-user. validate_promo is the single source of truth for
-- whether a code applies and how much it discounts.

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  type text not null check (type in ('percent','fixed')),
  value numeric(10,2) not null check (value >= 0),
  min_order_dh numeric(10,2) not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses int,
  max_uses_per_user int,
  branch_id uuid references public.branches(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists promotions_code_uniq on public.promotions (upper(code));

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  user_id uuid not null,
  order_id uuid references public.orders(id) on delete set null,
  discount_dh numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists promo_redemptions_promo on public.promo_redemptions (promotion_id);
create index if not exists promo_redemptions_user on public.promo_redemptions (promotion_id, user_id);

alter table public.promotions enable row level security;
alter table public.promo_redemptions enable row level security;
-- No public read of the promo catalogue / redemptions; access is via RPCs only.
drop policy if exists promotions_staff_read on public.promotions;
create policy promotions_staff_read on public.promotions for select using (
  lv_is_staff() and (branch_id = lv_staff_branch() or lv_staff_branch() is null)
);
drop policy if exists promo_redemptions_staff_read on public.promo_redemptions;
create policy promo_redemptions_staff_read on public.promo_redemptions for select using (lv_is_staff());

-- Validate a code for a given subtotal + branch. Returns a single row.
create or replace function public.validate_promo(p_code text, p_subtotal numeric, p_branch uuid)
returns table(valid boolean, discount_dh numeric, message text, promotion_id uuid)
language plpgsql security definer set search_path = public as $$
declare v_p promotions%rowtype; v_n int; v_disc numeric;
begin
  select * into v_p from promotions where upper(code) = upper(trim(p_code)) and active;
  if not found then return query select false, 0::numeric, 'Code invalide', null::uuid; return; end if;
  if v_p.starts_at is not null and now() < v_p.starts_at then
    return query select false, 0::numeric, 'Promo pas encore active', null::uuid; return; end if;
  if v_p.ends_at is not null and now() > v_p.ends_at then
    return query select false, 0::numeric, 'Promo expirée', null::uuid; return; end if;
  if v_p.branch_id is not null and p_branch is not null and v_p.branch_id <> p_branch then
    return query select false, 0::numeric, 'Code non valable pour cette agence', null::uuid; return; end if;
  if p_subtotal < coalesce(v_p.min_order_dh, 0) then
    return query select false, 0::numeric,
      'Minimum ' || to_char(v_p.min_order_dh, 'FM999990') || ' DH non atteint', null::uuid; return; end if;
  if v_p.max_uses is not null then
    select count(*) into v_n from promo_redemptions where promotion_id = v_p.id;
    if v_n >= v_p.max_uses then return query select false, 0::numeric, 'Promo épuisée', null::uuid; return; end if;
  end if;
  if v_p.max_uses_per_user is not null and auth.uid() is not null then
    select count(*) into v_n from promo_redemptions where promotion_id = v_p.id and user_id = auth.uid();
    if v_n >= v_p.max_uses_per_user then
      return query select false, 0::numeric, 'Code déjà utilisé', null::uuid; return; end if;
  end if;
  if v_p.type = 'percent' then v_disc := round(p_subtotal * v_p.value / 100.0, 0);
  else v_disc := least(v_p.value, p_subtotal); end if;
  return query select true, v_disc, 'OK', v_p.id;
end; $$;
revoke all on function public.validate_promo(text, numeric, uuid) from public;
grant execute on function public.validate_promo(text, numeric, uuid) to authenticated, service_role;

-- Admin CRUD (super-admin or the promo's branch gérant).
create or replace function public.admin_upsert_promo(
  p_id uuid, p_code text, p_type text, p_value numeric, p_min numeric,
  p_starts timestamptz, p_ends timestamptz, p_max_uses int, p_max_per_user int,
  p_branch uuid, p_active boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  -- a branch gérant can only manage their own branch's promos
  if lv_staff_branch() is not null and (p_branch is distinct from lv_staff_branch()) then
    raise exception 'forbidden branch';
  end if;
  if p_type not in ('percent','fixed') then raise exception 'invalid type'; end if;
  if p_id is null then
    insert into promotions (code, type, value, min_order_dh, starts_at, ends_at, max_uses, max_uses_per_user, branch_id, active)
    values (trim(p_code), p_type, p_value, coalesce(p_min,0), p_starts, p_ends, p_max_uses, p_max_per_user, p_branch, coalesce(p_active,true))
    returning id into v_id;
  else
    update promotions set code=trim(p_code), type=p_type, value=p_value, min_order_dh=coalesce(p_min,0),
      starts_at=p_starts, ends_at=p_ends, max_uses=p_max_uses, max_uses_per_user=p_max_per_user,
      branch_id=p_branch, active=coalesce(p_active,true)
    where id=p_id returning id into v_id;
    if v_id is null then raise exception 'promo not found'; end if;
  end if;
  return v_id;
end; $$;

create or replace function public.admin_delete_promo(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  delete from promotions where id = p_id
    and (lv_staff_branch() is null or branch_id = lv_staff_branch());
  if not found then raise exception 'promo not found or forbidden'; end if;
end; $$;

revoke all on function public.admin_upsert_promo(uuid, text, text, numeric, numeric, timestamptz, timestamptz, int, int, uuid, boolean) from public;
revoke all on function public.admin_delete_promo(uuid) from public;
grant execute on function public.admin_upsert_promo(uuid, text, text, numeric, numeric, timestamptz, timestamptz, int, int, uuid, boolean) to authenticated, service_role;
grant execute on function public.admin_delete_promo(uuid) to authenticated, service_role;
