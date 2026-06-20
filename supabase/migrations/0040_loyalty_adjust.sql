-- 0040_loyalty_adjust.sql  (#6 Fidélité avancée)
-- Staff can manually grant or deduct loyalty points (bonus, goodwill, correction).
-- Writes a ledger entry, updates the balance (floored at 0) and recomputes the tier
-- from lifetime earned points — the same thresholds place_order uses.

create or replace function public.admin_adjust_points(p_user uuid, p_delta int, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  if coalesce(p_delta, 0) = 0 then return; end if;

  insert into loyalty_ledger (user_id, delta_pts, reason)
  values (p_user, p_delta, coalesce(nullif(trim(p_reason), ''), 'Ajustement gérant'));

  update profiles set loyalty_points = greatest(0, coalesce(loyalty_points, 0) + p_delta)
    where id = p_user;
  if not found then raise exception 'customer not found'; end if;

  update profiles p set loyalty_tier = case
      when lt.lifetime >= 1500 then 'Cercle Villa'
      when lt.lifetime >= 1000 then 'Gourmet'
      when lt.lifetime >= 500  then 'Connaisseur'
      else 'Gourmand' end
  from (select coalesce(sum(delta_pts), 0) as lifetime
        from loyalty_ledger where user_id = p_user and delta_pts > 0) lt
  where p.id = p_user;
end; $$;

revoke all on function public.admin_adjust_points(uuid, int, text) from public;
grant execute on function public.admin_adjust_points(uuid, int, text) to authenticated, service_role;
