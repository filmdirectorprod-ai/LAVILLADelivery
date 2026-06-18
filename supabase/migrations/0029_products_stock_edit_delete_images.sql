-- La Villa — admin Produits: stock flag, full edit, delete, and product photos.
-- in_stock is distinct from `active` (listed for sale). Deleting a product keeps
-- order history (snapshots; product_id → null) and drops cart lines. Adds a public
-- product-images storage bucket with staff-only writes. Idempotent; run after 0028.
alter table products add column if not exists in_stock boolean not null default true;

alter table order_items drop constraint if exists order_items_product_id_fkey;
alter table order_items add constraint order_items_product_id_fkey
  foreign key (product_id) references products(id) on delete set null;
alter table cart_items drop constraint if exists cart_items_product_id_fkey;
alter table cart_items add constraint cart_items_product_id_fkey
  foreign key (product_id) references products(id) on delete cascade;

drop function if exists public.admin_update_product(uuid, boolean, numeric, boolean);
create or replace function public.admin_update_product(
  p_product uuid, p_active boolean, p_price_dh numeric, p_is_signature boolean,
  p_in_stock boolean default true
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  if p_price_dh is null or p_price_dh < 0 then raise exception 'invalid price %', p_price_dh; end if;
  update products set active = p_active, price_dh = p_price_dh,
                      is_signature = p_is_signature, in_stock = p_in_stock
    where id = p_product;
  if not found then raise exception 'unknown product'; end if;
end; $$;

create or replace function public.admin_edit_product(
  p_product uuid, p_name text, p_universe text, p_category text, p_price_dh numeric,
  p_description text, p_is_signature boolean, p_active boolean, p_in_stock boolean, p_image_url text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  if coalesce(btrim(p_name),'') = '' then raise exception 'name_required'; end if;
  if p_universe not in ('patisserie','restaurant') then raise exception 'invalid universe'; end if;
  if p_price_dh is null or p_price_dh < 0 then raise exception 'invalid price'; end if;
  update products set
    name = btrim(p_name), universe = p_universe, category = btrim(p_category),
    price_dh = p_price_dh, description = coalesce(p_description, ''),
    is_signature = p_is_signature, active = p_active, in_stock = p_in_stock,
    image_url = nullif(btrim(p_image_url), '')
    where id = p_product;
  if not found then raise exception 'unknown product'; end if;
end; $$;

create or replace function public.admin_set_product_image(p_product uuid, p_image_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  update products set image_url = nullif(btrim(p_image_url), '') where id = p_product;
  if not found then raise exception 'unknown product'; end if;
end; $$;

create or replace function public.admin_delete_product(p_product uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lv_is_staff() then raise exception 'forbidden'; end if;
  delete from products where id = p_product;
  if not found then raise exception 'unknown product'; end if;
end; $$;

revoke all on function public.admin_update_product(uuid, boolean, numeric, boolean, boolean) from public;
revoke all on function public.admin_edit_product(uuid, text, text, text, numeric, text, boolean, boolean, boolean, text) from public;
revoke all on function public.admin_set_product_image(uuid, text) from public;
revoke all on function public.admin_delete_product(uuid) from public;
grant execute on function public.admin_update_product(uuid, boolean, numeric, boolean, boolean) to authenticated, service_role;
grant execute on function public.admin_edit_product(uuid, text, text, text, numeric, text, boolean, boolean, boolean, text) to authenticated, service_role;
grant execute on function public.admin_set_product_image(uuid, text) to authenticated, service_role;
grant execute on function public.admin_delete_product(uuid) to authenticated, service_role;

insert into storage.buckets (id, name, public) values ('product-images','product-images', true)
on conflict (id) do nothing;
drop policy if exists "product-images public read" on storage.objects;
create policy "product-images public read" on storage.objects for select using (bucket_id = 'product-images');
drop policy if exists "product-images staff insert" on storage.objects;
create policy "product-images staff insert" on storage.objects for insert with check (bucket_id = 'product-images' and lv_is_staff());
drop policy if exists "product-images staff update" on storage.objects;
create policy "product-images staff update" on storage.objects for update using (bucket_id = 'product-images' and lv_is_staff());
drop policy if exists "product-images staff delete" on storage.objects;
create policy "product-images staff delete" on storage.objects for delete using (bucket_id = 'product-images' and lv_is_staff());
