-- La Villa — server-only key/value store. Holds secrets the deployed app reads
-- server-side (e.g. the Google Places key used by /api/places), so they never
-- reach the client and aren't subject to browser key restrictions. RLS on with no
-- policies → only the service role can read it. Values are inserted out-of-band
-- (not in this migration). Idempotent; run after 0025.
create table if not exists app_config (
  name text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table app_config enable row level security;
revoke all on table app_config from anon, authenticated;
