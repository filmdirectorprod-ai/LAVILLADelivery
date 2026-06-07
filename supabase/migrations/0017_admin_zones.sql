-- La Villa — Admin Phase 4: Zones de livraison write path.
-- delivery_zones is public-read (0002) so the admin Zones screen lists it with the
-- ordinary client, but there is no staff write policy. These two staff-gated RPCs
-- are the only write path: an upsert (insert when p_id is null, otherwise update)
-- and a delete. Both validate the fee/ETA bounds so the catalogue stays coherent.
-- Idempotent; safe to re-run. Run manually in the Supabase SQL editor (after 0016).

create or replace function public.admin_upsert_zone(
  p_id      uuid,
  p_name    text,
  p_fee_dh  numeric,
  p_eta_min int,
  p_eta_max int
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  if coalesce(btrim(p_name), '') = '' then raise exception 'name required'; end if;
  if p_fee_dh is null or p_fee_dh < 0 then raise exception 'invalid fee %', p_fee_dh; end if;
  if p_eta_min is null or p_eta_max is null or p_eta_min < 0 or p_eta_max < p_eta_min then
    raise exception 'invalid eta range';
  end if;

  if p_id is null then
    insert into delivery_zones (name, fee_dh, eta_min, eta_max)
    values (btrim(p_name), p_fee_dh, p_eta_min, p_eta_max)
    returning id into v_id;
  else
    update delivery_zones
      set name = btrim(p_name), fee_dh = p_fee_dh, eta_min = p_eta_min, eta_max = p_eta_max
      where id = p_id
      returning id into v_id;
    if v_id is null then raise exception 'unknown zone'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.admin_delete_zone(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  delete from delivery_zones where id = p_id;
  if not found then raise exception 'unknown zone'; end if;
end;
$$;

revoke all on function public.admin_upsert_zone(uuid, text, numeric, int, int) from public;
revoke all on function public.admin_delete_zone(uuid) from public;
grant execute on function public.admin_upsert_zone(uuid, text, numeric, int, int) to authenticated, service_role;
grant execute on function public.admin_delete_zone(uuid) to authenticated, service_role;
