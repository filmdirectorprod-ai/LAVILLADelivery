-- 0007_profile_addresses.sql
-- Profile section: saved delivery addresses, per-user app settings, and an
-- avatars storage bucket. Idempotent — safe to re-run in the SQL Editor.

-- ── Saved addresses ──────────────────────────────────────────────────────────
create table if not exists addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  label      text not null default 'Domicile',
  recipient  text,
  phone      text,
  line1      text not null,
  city       text not null default 'Fès',
  zone_id    uuid references delivery_zones(id),
  details    text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists addresses_user_idx on addresses(user_id);

alter table addresses enable row level security;

-- Owner-only access (select / insert / update / delete).
drop policy if exists addresses_owner_all on addresses;
create policy addresses_owner_all on addresses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on addresses to authenticated;

-- Keep at most one default address per user: when a row is marked default,
-- clear the flag on the user's other rows.
create or replace function ensure_single_default_address()
returns trigger language plpgsql as $$
begin
  if new.is_default then
    update addresses set is_default = false
    where user_id = new.user_id and id <> new.id and is_default;
  end if;
  return new;
end;
$$;

drop trigger if exists addresses_single_default on addresses;
create trigger addresses_single_default
  before insert or update of is_default on addresses
  for each row when (new.is_default)
  execute function ensure_single_default_address();

-- ── Per-user app settings (notification prefs, locale) ───────────────────────
alter table profiles add column if not exists settings jsonb not null default '{}'::jsonb;

-- Re-grant the owner-updatable column set to include `settings`
-- (mirrors 0002_rls.sql, which restricts profile updates to safe columns).
revoke update on profiles from authenticated;
grant update (full_name, phone, avatar_url, settings) on profiles to authenticated;

-- ── Avatars storage bucket ───────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Public read; each user may write only inside their own `{uid}/…` folder.
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars owner insert" on storage.objects;
create policy "avatars owner insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars owner update" on storage.objects;
create policy "avatars owner update" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars owner delete" on storage.objects;
create policy "avatars owner delete" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
