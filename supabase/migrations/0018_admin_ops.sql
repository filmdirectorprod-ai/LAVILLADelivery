-- La Villa — Admin Phase 5: operational tables (Incidents, Support, Planning).
-- Three brand-new staff-owned tables behind the last three admin sections:
--   • incidents       — issues raised against an order/driver, open → resolved
--   • support_messages — per-driver support threads (driver ⇄ gérant)
--   • driver_shifts    — the weekly delivery roster
-- Writes are staff-only via RLS gated on lv_is_staff(); support_messages also lets
-- a driver read/post in their own thread (lv_current_driver, 0008/0010). All three
-- join the realtime publication so the admin screens live-update.
-- Idempotent; safe to re-run. Run manually in the Supabase SQL editor (after 0017).

-- ── 1. Incidents ──────────────────────────────────────────────────────────────
create table if not exists incidents (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid references orders(id) on delete set null,
  driver_id   uuid references drivers(id) on delete set null,
  kind        text not null,                 -- e.g. 'retard','litige','accident'
  severity    text not null default 'moyenne' check (severity in ('basse','moyenne','haute')),
  status      text not null default 'open'   check (status in ('open','resolved')),
  title       text not null,
  detail      text not null default '',
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
alter table incidents enable row level security;
drop policy if exists incidents_staff_all on incidents;
create policy incidents_staff_all on incidents for all
  using (lv_is_staff()) with check (lv_is_staff());

-- ── 2. Support messages (per-driver thread) ──────────────────────────────────
create table if not exists support_messages (
  id            uuid primary key default gen_random_uuid(),
  driver_id     uuid not null references drivers(id) on delete cascade,
  sender        text not null check (sender in ('driver','staff')),
  body          text not null,
  read_by_staff boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table support_messages enable row level security;
-- Staff: full access across every thread.
drop policy if exists support_staff_all on support_messages;
create policy support_staff_all on support_messages for all
  using (lv_is_staff()) with check (lv_is_staff());
-- Driver: read and post only in their own thread.
drop policy if exists support_driver_read on support_messages;
create policy support_driver_read on support_messages for select
  using (driver_id = lv_current_driver());
drop policy if exists support_driver_insert on support_messages;
create policy support_driver_insert on support_messages for insert
  with check (driver_id = lv_current_driver() and sender = 'driver');

-- ── 3. Driver shifts (weekly planning) ───────────────────────────────────────
create table if not exists driver_shifts (
  id         uuid primary key default gen_random_uuid(),
  driver_id  uuid not null references drivers(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  note       text not null default '',
  created_at timestamptz not null default now()
);
alter table driver_shifts enable row level security;
drop policy if exists shifts_staff_all on driver_shifts;
create policy shifts_staff_all on driver_shifts for all
  using (lv_is_staff()) with check (lv_is_staff());
-- Driver: read their own shifts (so the driver app can show the roster).
drop policy if exists shifts_driver_read on driver_shifts;
create policy shifts_driver_read on driver_shifts for select
  using (driver_id = lv_current_driver());

-- ── 4. Realtime ──────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['incidents','support_messages','driver_shifts'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end$$;
