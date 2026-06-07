-- La Villa — Admin Phase 4: Produits write path.
-- The catalogue (products) is public-read, so the admin Produits screen lists it
-- with the ordinary client. Edits, however, must be staff-only — there is no
-- staff UPDATE policy on products (and we don't want one, to keep writes funneled
-- through a validated path). This RPC is the single staff write: it sets the three
-- fields the screen exposes (active / price_dh / is_signature) in one call.
-- Idempotent; safe to re-run. Run manually in the Supabase SQL editor (after 0015).

create or replace function public.admin_update_product(
  p_product      uuid,
  p_active       boolean,
  p_price_dh     numeric,
  p_is_signature boolean
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  if p_price_dh is null or p_price_dh < 0 then
    raise exception 'invalid price %', p_price_dh;
  end if;

  update products
    set active = p_active,
        price_dh = p_price_dh,
        is_signature = p_is_signature
    where id = p_product;
  if not found then raise exception 'unknown product'; end if;
end;
$$;

revoke all on function public.admin_update_product(uuid, boolean, numeric, boolean) from public;
grant execute on function public.admin_update_product(uuid, boolean, numeric, boolean) to authenticated, service_role;
