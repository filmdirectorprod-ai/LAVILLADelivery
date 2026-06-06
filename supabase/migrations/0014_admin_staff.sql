-- La Villa — Admin (gérant) foundations.
-- Adds a single staff flag, an identity helper, additive staff SELECT policies
-- across the operational tables (so the gérant can read every customer/driver
-- via the normal RLS client), driver online presence columns, and realtime
-- publication for the tables the admin dashboard subscribes to.
-- Idempotent; safe to re-run.

-- ── Staff flag ───────────────────────────────────────────────────────────────
alter table profiles add column if not exists is_staff boolean not null default false;

-- Promote the dedicated gérant account. No-op until that user has signed up
-- (the 0003 trigger creates its profiles row on first sign-in); re-run after.
update profiles
  set is_staff = true
  where id in (select id from auth.users where lower(email) = 'admin@lavilla.ma');

-- ── Identity helper (used by policies; SECURITY DEFINER avoids RLS recursion) ──
create or replace function public.lv_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and coalesce(is_staff, false) = true
  );
$$;
grant execute on function public.lv_is_staff() to authenticated, service_role;

-- ── Additive staff SELECT policies (read-all for the gérant) ──────────────────
-- RLS policies OR together, so these widen reads for staff only; customer and
-- driver policies from 0002/0008 are untouched. Writes stay locked until each
-- admin section ships its own SECURITY DEFINER RPC in a later phase.
drop policy if exists orders_staff_read on orders;
create policy orders_staff_read on orders for select using (lv_is_staff());

drop policy if exists order_items_staff_read on order_items;
create policy order_items_staff_read on order_items for select using (lv_is_staff());

drop policy if exists order_tracking_staff_read on order_tracking;
create policy order_tracking_staff_read on order_tracking for select using (lv_is_staff());

drop policy if exists drivers_staff_read on drivers;
create policy drivers_staff_read on drivers for select using (lv_is_staff());

drop policy if exists reviews_staff_read on reviews;
create policy reviews_staff_read on reviews for select using (lv_is_staff());

drop policy if exists profiles_staff_read on profiles;
create policy profiles_staff_read on profiles for select using (lv_is_staff());

drop policy if exists chat_messages_staff_read on chat_messages;
create policy chat_messages_staff_read on chat_messages for select using (lv_is_staff());

-- delivery_zones, products, categories are already public-read (0002); no policy
-- needed for the admin to see them.

-- ── Driver online presence (powers "Livreurs en ligne X/Y") ──────────────────
alter table drivers add column if not exists is_online boolean not null default false;
alter table drivers add column if not exists last_seen timestamptz;

-- ── Realtime: tables the admin dashboard subscribes to ───────────────────────
do $$
declare t text;
begin
  foreach t in array array['order_tracking','drivers','reviews'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end$$;
