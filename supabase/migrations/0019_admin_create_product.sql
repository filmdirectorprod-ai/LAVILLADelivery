-- La Villa — Admin: Produits creation write path.
-- The Produits screen can already edit a product's price/visibility/signature via
-- admin_update_product (0016). This adds the single staff write for CREATING a
-- product. Like 0016 there is no staff INSERT policy on products (writes stay
-- funneled through a validated SECURITY DEFINER path). The RPC validates the input,
-- derives a unique slug from the name, and inserts the row the admin form exposes
-- (name / universe / category / price / photo_label / is_signature / active).
-- A freshly created product with active=true is immediately public-read, so it
-- appears in the customer app at once. Idempotent; safe to re-run. Run manually in
-- the Supabase SQL editor (after 0018).

-- Slugify helper: lowercases, strips accents, turns runs of non-alphanumerics into
-- single hyphens, trims leading/trailing hyphens. Empty input falls back to 'produit'.
create or replace function public.lv_slugify(p_text text)
returns text language sql immutable as $$
  select coalesce(
    nullif(
      trim(both '-' from
        regexp_replace(
          lower(unaccent_safe(p_text)),
          '[^a-z0-9]+', '-', 'g'
        )
      ),
      ''
    ),
    'produit'
  );
$$;

-- unaccent may not be installed; provide a dependency-free fallback that maps the
-- common French accented letters so the slug stays clean without the extension.
create or replace function public.unaccent_safe(p_text text)
returns text language sql immutable as $$
  select translate(
    p_text,
    'àâäáãçéèêëíìîïñóòôöõúùûüýÿœæ',
    'aaaaaceeeeiiiinooooouuuuyyoa'
  );
$$;

create or replace function public.admin_create_product(
  p_name         text,
  p_universe     text,
  p_category     text,
  p_price_dh     numeric,
  p_photo_label  text default null,
  p_is_signature boolean default false,
  p_active       boolean default true
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_slug text;
  v_base text;
  v_id   uuid;
  v_n    int := 0;
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name required';
  end if;
  if p_universe not in ('patisserie','restaurant') then
    raise exception 'invalid universe %', p_universe;
  end if;
  if p_category is null or length(trim(p_category)) = 0 then
    raise exception 'category required';
  end if;
  if p_price_dh is null or p_price_dh < 0 then
    raise exception 'invalid price %', p_price_dh;
  end if;

  v_base := lv_slugify(p_name);
  v_slug := v_base;
  -- ensure slug uniqueness by appending -2, -3, … on collision
  while exists (select 1 from products where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || (v_n + 1);
  end loop;

  insert into products (slug, name, universe, category, price_dh, photo_label, is_signature, active)
  values (v_slug, trim(p_name), p_universe, trim(p_category), p_price_dh,
          nullif(trim(coalesce(p_photo_label, '')), ''), coalesce(p_is_signature, false), coalesce(p_active, true))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.admin_create_product(text, text, text, numeric, text, boolean, boolean) from public;
grant execute on function public.admin_create_product(text, text, text, numeric, text, boolean, boolean) to authenticated, service_role;
