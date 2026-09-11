// La Villa — backend verification harness.
//
// Boots a real PostgreSQL in userspace (no Docker, no admin) via the
// `embedded-postgres` package, applies EVERY migration, and asserts the
// server-authoritative security + pricing behaviour that `tsc`/`next build`
// cannot reach. Run it before provisioning a real Supabase project, or in CI,
// to catch SQL/RLS/RPC regressions.
//
// Usage (the binary is heavy + dev-only, so it is intentionally NOT a
// package.json dependency — install it on demand):
//
//   npm i embedded-postgres --no-save && npm run verify
//
// Notes:
//   • Applies all 52 migrations. It used to stop at 0006, which left ~90% of the
//     schema untested — nothing of branches, promotions, loyalty or referrals.
//   • Shims what Supabase provides and a bare Postgres does not: the auth schema
//     and auth.uid(), the storage schema, the supabase_realtime publication, and
//     cron.schedule / net.http_post. The two `create extension` lines for
//     pg_cron and pg_net are commented out as the files are read — the shims
//     above already stand in for what those extensions do here.
import EmbeddedPostgres from 'embedded-postgres';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const HERE = import.meta.dirname;
const DIR = join(HERE, '.verify-pgdata');
rmSync(DIR, { recursive: true, force: true });

// pg_cron and pg_net do not exist here; the shim provides the two functions the
// migrations actually call, so only the CREATE EXTENSION lines need removing.
const SUPABASE_ONLY_EXTENSION = /^\s*create extension[^;]*\b(pg_cron|pg_net)\b[^;]*;/gim;
const read = (f) =>
  readFileSync(join(HERE, 'migrations', f), 'utf8').replace(SUPABASE_ONLY_EXTENSION, '-- (extension shimmed)');
const migrations = () =>
  readdirSync(join(HERE, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
const seed = readFileSync(join(HERE, 'seed.sql'), 'utf8');

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log(`  ✓ ${m}`); };
const bad = (m) => { fail++; console.log(`  ✗ ${m}`); };

const SHIM = `
create extension if not exists pgcrypto;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
do $$ begin
  if not exists (select from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

-- ── Stand-ins for the Supabase services a bare Postgres lacks ────────────────
-- Storage : le schéma, les deux tables et le helper que les politiques utilisent.
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean not null default false
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null,
  owner uuid
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;
grant usage on schema storage to anon, authenticated, service_role;

-- Realtime : une vraie publication, pour qu'« alter publication … add table » passe.
do $$ begin
  if not exists (select from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- pg_cron : seul cron.schedule() est appelé (migration 0005).
create schema if not exists cron;
create or replace function cron.schedule(job_name text, schedule text, command text)
  returns bigint language sql as $$ select 1::bigint $$;

-- pg_net : seul net.http_post() est appelé (migration 0030, notifications push).
create schema if not exists net;
create or replace function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000)
  returns bigint language sql as $$ select 1::bigint $$;
grant usage on schema cron, net to service_role;
`;

// Base table grants Supabase provides by default — but NOT a blanket update on
// profiles (that would mask the column-grant restriction under test).
const GRANTS = `
grant select, insert, update, delete on
  orders, order_items, order_tracking, chat_messages, reviews,
  loyalty_ledger, notifications, carts, cart_items,
  products, categories, delivery_zones, drivers, rewards
  to authenticated;
grant select on profiles to authenticated;
`;

async function asUser(client, sub, fn) {
  await client.query('set role authenticated');
  await client.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub]);
  try { return await fn(); }
  finally {
    await client.query('reset role');
    await client.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

async function expectThrow(label, fn, needle) {
  try { await fn(); bad(`${label} — expected an error, got none`); }
  catch (e) {
    const hay = `${e.code ?? ''} ${e.message ?? ''}`;
    if (!needle || hay.includes(needle)) ok(`${label} (${e.code ?? ''} ${(e.message || '').split('\n')[0]})`);
    else bad(`${label} — wrong error: ${hay}`);
  }
}

const pg = new EmbeddedPostgres({ databaseDir: DIR, user: 'postgres', password: 'pw', port: 5599, persistent: false });
await pg.initialise();
await pg.start();
const c = pg.getPgClient();
await c.connect();

try {
  const files = migrations();
  console.log(`\n[apply] shim + ${files.length} migrations + seed`);
  await c.query(SHIM);
  for (const f of files) {
    try { await c.query(read(f)); }
    catch (e) { bad(`${f} failed to apply — ${(e.message || '').split('\n')[0]}`); throw e; }
  }
  ok(`all ${files.length} migrations executed without error`);
  await c.query(seed);
  await c.query(GRANTS);
  ok('seed executed without error');

  const A = (await c.query(`insert into auth.users (raw_user_meta_data) values ('{"full_name":"Alice"}') returning id`)).rows[0].id;
  const B = (await c.query(`insert into auth.users (raw_user_meta_data) values ('{"full_name":"Bob"}') returning id`)).rows[0].id;
  const pA = (await c.query('select full_name, loyalty_points, loyalty_tier from profiles where id=$1', [A])).rows[0];
  // 0047 grants a 10-point welcome bonus on signup — this used to expect 0,
  // because the harness stopped applying migrations at 0006.
  if (pA && pA.full_name === 'Alice' && pA.loyalty_points === 10 && pA.loyalty_tier === 'Gourmand') ok('handle_new_user provisioned the profile + 10-pt welcome bonus (0047)');
  else bad(`profile provisioning wrong: ${JSON.stringify(pA)}`);

  const fraisier = (await c.query(`select id from products where slug='p-fraisier'`)).rows[0];
  const painChoc = (await c.query(`select id from products where slug='p-painchoc'`)).rows[0];
  const tajine = (await c.query(`select id from products where slug='r-tajine'`)).rows[0];

  await expectThrow('place_order rejects a p_user ≠ auth.uid() (IDOR guard)',
    () => asUser(c, A, () => c.query(`select place_order($1, $2::jsonb, 'retrait', null, null, false, 0, 0)`,
      [B, JSON.stringify([{ product_id: tajine.id, qty: 1 }])])), 'forbidden');

  await expectThrow('direct loyalty_points write is denied (column grant)',
    () => asUser(c, A, () => c.query(`update profiles set loyalty_points = 99999 where id = $1`, [A])), '42501');
  await asUser(c, A, () => c.query(`update profiles set full_name = 'Alice V.' where id = $1`, [A]));
  ok('presentation-field update (full_name) is allowed');

  // p-fraisier 165 ×0.25 = 41.25 ; p-painchoc 11 ×1.6 = 17.6 ; +18 delivery = 76.85 ; floor → 76 pts.
  const oid = (await asUser(c, A, () => c.query(
    `select place_order($1, $2::jsonb, 'livraison', 'Fes', null, false, 0, 0) as id`,
    [A, JSON.stringify([
      { product_id: fraisier.id, qty: 1, size_mult: 0.25 },
      { product_id: painChoc.id, qty: 1, size_mult: 1.6 },
    ])]))).rows[0].id;
  const o = (await c.query('select subtotal_dh, delivery_fee_dh, total_dh, points_earned from orders where id=$1', [oid])).rows[0];
  const eq = (a, b) => Number(a) === b;
  if (eq(o.subtotal_dh, 58.85) && eq(o.delivery_fee_dh, 18) && eq(o.total_dh, 76.85) && o.points_earned === 76)
    ok('place_order pricing matches client computeOrder (subtotal 58.85, total 76.85, +76 pts)');
  else bad(`pricing mismatch: ${JSON.stringify(o)}`);

  const bal = (await c.query('select loyalty_points from profiles where id=$1', [A])).rows[0].loyalty_points;
  if (bal === 86) ok('loyalty balance credited via RPC (10 welcome + 76 earned = 86)'); else bad(`balance wrong: ${bal}`);

  await c.query(`update orders set status='delivered' where id=$1`, [oid]);
  const newBal = (await asUser(c, A, () => c.query(`select submit_review($1,$2,5,'{Goût}','Top',null) as b`, [A, oid]))).rows[0].b;
  if (newBal === 136) ok('submit_review awarded +50 (86 → 136)'); else bad(`review balance wrong: ${newBal}`);

  await expectThrow('submit_review rejects a forged p_user',
    () => asUser(c, A, () => c.query(`select submit_review($1,$2,5,'{}','x',null)`, [B, oid])), 'forbidden');
  await expectThrow('second review on the same order is rejected (unique order_id)',
    () => asUser(c, A, () => c.query(`select submit_review($1,$2,4,'{}','again',null)`, [A, oid])), 'duplicate key');

  // ── Admin aggregates (0051) + the business-day boundary (0052) ─────────────
  // None of this surface was covered while the harness stopped at 0006.
  const S = (await c.query(`insert into auth.users (raw_user_meta_data) values ('{"full_name":"Gérante"}') returning id`)).rows[0].id;
  await c.query(`update profiles set is_staff = true where id = $1`, [S]);

  // A customer (Bob) with two delivered orders, so the CRM has something to group.
  for (const qty of [1, 2]) {
    const id = (await asUser(c, B, () => c.query(
      `select place_order($1, $2::jsonb, 'retrait', null, null, false, 0, 0) as id`,
      [B, JSON.stringify([{ product_id: tajine.id, qty }])]))).rows[0].id;
    await c.query(`update orders set status='delivered' where id=$1`, [id]);
  }

  const crm = (await asUser(c, S, () => c.query('select * from admin_customer_rows(50)'))).rows;
  const bobRow = crm.find((r) => r.id === B);
  if (bobRow && bobRow.orders === 2 && Number(bobRow.spend) > 0) ok(`admin_customer_rows aggregates per customer (Bob: ${bobRow.orders} orders, ${bobRow.spend} DH)`);
  else bad(`admin_customer_rows wrong: ${JSON.stringify(bobRow)}`);
  if (crm.every((r) => ['VIP', 'Régulier', 'Nouveau'].includes(r.segment))) ok('admin_customer_rows segments every row');
  else bad(`unexpected segment: ${JSON.stringify(crm.map((r) => r.segment))}`);

  const hist = (await asUser(c, S, () => c.query('select * from admin_customer_orders($1, 10)', [B]))).rows;
  if (hist.length === 2) ok('admin_customer_orders returns that customer’s history only');
  else bad(`admin_customer_orders returned ${hist.length} rows, expected 2`);

  // A non-staff caller must get nothing back — the RPCs are SECURITY DEFINER, so
  // this is the only thing standing between a customer and the whole CRM.
  const leak = (await asUser(c, A, () => c.query('select * from admin_customer_rows(50)'))).rows;
  if (leak.length === 0) ok('admin_customer_rows returns nothing to a non-staff caller');
  else bad(`LEAK: a customer read ${leak.length} CRM rows`);
  const leak2 = (await asUser(c, A, () => c.query('select * from admin_customer_orders($1, 10)', [B]))).rows;
  if (leak2.length === 0) ok('admin_customer_orders returns nothing to a non-staff caller');
  else bad(`LEAK: a customer read ${leak2.length} orders of another customer`);

  // The day boundary: 23:30 UTC is already 00:30 the NEXT day in Fès (UTC+1).
  // Grouping in UTC — what 0051 did, mirroring the old client-side slicing —
  // filed such an order under the previous day. 0052 groups in Africa/Casablanca.
  await c.query(`update orders set placed_at = timestamptz '2026-06-11 23:30:00+00' where user_id = $1`, [B]);
  const snap = (await asUser(c, S, () => c.query(
    `select admin_stats_snapshot(timestamptz '2026-06-01', timestamptz '2026-06-30', timestamptz '2026-05-01') as s`))).rows[0].s;
  const days = (snap.series ?? []).map((d) => d.day);
  if (days.includes('2026-06-12') && !days.includes('2026-06-11'))
    ok('admin_stats_snapshot cuts the day at midnight in Fès, not UTC (0052)');
  else bad(`day bucketing wrong: ${JSON.stringify(days)}`);
  if (snap.kpis && snap.kpis.orders === 2 && Number(snap.kpis.revenue) > 0)
    ok(`admin_stats_snapshot KPIs (${snap.kpis.orders} orders, ${snap.kpis.revenue} DH, avg ${snap.kpis.avgBasket})`);
  else bad(`KPIs wrong: ${JSON.stringify(snap.kpis)}`);
  if (Array.isArray(snap.top) && snap.top.length > 0 && snap.top[0].name)
    ok(`admin_stats_snapshot ranks top products (#1 ${snap.top[0].name} ×${snap.top[0].qty})`);
  else bad(`top products wrong: ${JSON.stringify(snap.top)}`);

  const emptySnap = (await asUser(c, A, () => c.query(
    `select admin_stats_snapshot(timestamptz '2026-06-01', timestamptz '2026-06-30', timestamptz '2026-05-01') as s`))).rows[0].s;
  if (emptySnap.kpis.orders === 0 && Number(emptySnap.kpis.revenue) === 0)
    ok('admin_stats_snapshot reports nothing to a non-staff caller');
  else bad(`LEAK: a customer read stats ${JSON.stringify(emptySnap.kpis)}`);


  // ── 0053 : pages d'administration enrichies ──────────────────────────────
  const snap53 = (await asUser(c, S, () => c.query(
    `select admin_stats_snapshot(timestamptz '2026-06-01', timestamptz '2026-06-30', timestamptz '2026-05-01') as s`))).rows[0].s;
  if (snap53.modes && snap53.modes.retrait && snap53.modes.retrait.orders === 2)
    ok('admin_stats_snapshot splits sales by delivery mode (0053)');
  else bad(`modes wrong: ${JSON.stringify(snap53.modes)}`);
  if (snap53.cancelled && snap53.cancelled.total === 2 && snap53.cancelled.count === 0)
    ok('admin_stats_snapshot counts cancellations against all orders of the window (0053)');
  else bad(`cancelled wrong: ${JSON.stringify(snap53.cancelled)}`);
  // Bob's two orders sit at 23:30 UTC on Thursday 11 June = 00:30 on Friday in Fès.
  const friday0 = (snap53.heatmap || []).find((h) => h.dow === 5 && h.hour === 0);
  if (friday0 && friday0.orders === 2) ok('admin_stats_snapshot buckets the heatmap in Fès time — Friday, 00h (0053)');
  else bad(`heatmap wrong: ${JSON.stringify(snap53.heatmap)}`);
  if (snap53.prevKpis && typeof snap53.prevKpis.orders === 'number' && Array.isArray(snap53.top))
    ok('admin_stats_snapshot returns the previous-window KPIs (0053)');
  else bad(`prevKpis wrong: ${JSON.stringify(snap53.prevKpis)}`);

  const act = (await asUser(c, S, () => c.query('select * from admin_loyalty_activity(50)'))).rows;
  if (act.length > 0 && act.every((r) => typeof r.name === 'string' && typeof r.delta_pts === 'number'))
    ok(`admin_loyalty_activity returns the points ledger to staff (${act.length} rows)`);
  else bad(`loyalty activity wrong: ${JSON.stringify(act.slice(0, 2))}`);
  const actLeak = (await asUser(c, A, () => c.query('select * from admin_loyalty_activity(50)'))).rows;
  if (actLeak.length === 0) ok('admin_loyalty_activity returns nothing to a non-staff caller');
  else bad(`LEAK: a customer read ${actLeak.length} ledger rows of everyone`);

  const flow = (await asUser(c, S, () => c.query('select * from admin_loyalty_flow(30)'))).rows;
  if (flow.length === 30 && flow.some((d) => d.earned > 0))
    ok('admin_loyalty_flow returns one row per day, with the points earned today');
  else bad(`loyalty flow wrong: ${flow.length} rows, earned=${flow.map((d) => d.earned).join(',')}`);
  const flowLeak = (await asUser(c, A, () => c.query('select * from admin_loyalty_flow(30)'))).rows;
  if (flowLeak.length === 0) ok('admin_loyalty_flow returns nothing to a non-staff caller');
  else bad(`LEAK: a customer read ${flowLeak.length} days of the loyalty flow`);

  const reward = (await c.query(`insert into rewards (title, cost_pts) values ('Café offert', 100) returning id`)).rows[0];
  await expectThrow('admin_set_reward_active rejects a non-staff caller',
    () => asUser(c, A, () => c.query('select admin_set_reward_active($1, false)', [reward.id])), 'forbidden');
  const branch = (await c.query('select id from branches limit 1')).rows[0];
  if (branch) {
    const G = (await c.query(`insert into auth.users (raw_user_meta_data) values ('{"full_name":"Gérant agence"}') returning id`)).rows[0].id;
    await c.query('update profiles set is_staff = true, branch_id = $2 where id = $1', [G, branch.id]);
    await expectThrow('admin_set_reward_active rejects a branch gérant — the catalogue is shared',
      () => asUser(c, G, () => c.query('select admin_set_reward_active($1, false)', [reward.id])), 'forbidden branch');
  } else bad('no branch seeded — cannot test the branch gérant restriction');
  await asUser(c, S, () => c.query('select admin_set_reward_active($1, false)', [reward.id]));
  const rewardActive = (await c.query('select active from rewards where id = $1', [reward.id])).rows[0].active;
  if (rewardActive === false) ok('admin_set_reward_active lets the super-admin switch a reward off');
  else bad(`reward still active after the super-admin switched it off`);

  // ── 0054 : paiement, créneau, code de remise, incident livreur ─────────────
  const slotAt = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
  const oid54 = (await asUser(c, A, () => c.query(
    `select place_order($1, $2::jsonb, 'livraison', 'Fes', null, false, 0, 0, '0600000000', null, null,
                        'cod', $3::timestamptz, 'Aujourd''hui 19:00', 34.0389, -4.9986) as id`,
    [A, JSON.stringify([{ product_id: tajine.id, qty: 1 }]), slotAt]))).rows[0].id;
  const o54 = (await c.query('select * from orders where id = $1', [oid54])).rows[0];
  if (o54.payment_method === 'cod' && o54.slot_label === "Aujourd'hui 19:00" && o54.slot_at !== null)
    ok('place_order stores the payment method and the chosen slot (0054)');
  else bad(`payment/slot wrong: ${o54.payment_method} / ${o54.slot_label} / ${o54.slot_at}`);
  if (/^\d{4}$/.test(o54.delivery_code ?? '') && Number(o54.dest_lat) === 34.0389)
    ok('place_order generates a 4-digit delivery code and keeps the destination coordinates');
  else bad(`code/dest wrong: ${o54.delivery_code} / ${o54.dest_lat},${o54.dest_lng}`);
  await expectThrow('place_order refuses a slot in the past',
    () => asUser(c, A, () => c.query(
      `select place_order($1, $2::jsonb, 'livraison', 'Fes', null, false, 0, 0, null, null, null,
                          'cod', now() - interval '2 hours', 'hier', null, null)`,
      [A, JSON.stringify([{ product_id: tajine.id, qty: 1 }])])), 'invalid slot');
  await expectThrow('place_order refuses an unknown payment method',
    () => asUser(c, A, () => c.query(
      `select place_order($1, $2::jsonb, 'livraison', 'Fes', null, false, 0, 0, null, null, null,
                          'bitcoin', null, null, null, null)`,
      [A, JSON.stringify([{ product_id: tajine.id, qty: 1 }])])), 'invalid payment');

  // Un livreur réel prend la course.
  const DU = (await c.query(`insert into auth.users (raw_user_meta_data) values ('{"full_name":"Livreur Karim"}') returning id`)).rows[0].id;
  await c.query(`insert into drivers (name, user_id, vehicle, is_online) values ('Karim', $1, 'Scooter', true)`, [DU]);
  await c.query(`update orders set status = 'ready' where id = $1`, [oid54]);
  await asUser(c, DU, () => c.query('select driver_accept_order($1)', [oid54]));
  await asUser(c, DU, () => c.query('select driver_update_status($1, 2)', [oid54]));
  await asUser(c, DU, () => c.query('select driver_update_status($1, 3)', [oid54]));

  await expectThrow('driver_update_status refuses to close a delivery with a wrong code',
    () => asUser(c, DU, () => c.query('select driver_update_status($1, 4, $2, null)', [oid54, '0000'.replace(o54.delivery_code, '1111')])), 'bad delivery code');
  await asUser(c, DU, () => c.query('select driver_update_status($1, 4, $2, null)', [oid54, o54.delivery_code]));
  const closed = (await c.query('select status from orders where id = $1', [oid54])).rows[0].status;
  if (closed === 'delivered') ok('driver_update_status closes the delivery with the customer code (0054)');
  else bad(`order not delivered after the right code: ${closed}`);

  const deliv = (await asUser(c, DU, () => c.query('select * from driver_deliveries()'))).rows;
  if (deliv.length === 1 && deliv[0].payment_method === 'cod')
    ok('driver_deliveries reports the payment method — the cash to hand back');
  else bad(`driver_deliveries wrong: ${JSON.stringify(deliv.map((d) => d.payment_method))}`);

  const incId = (await asUser(c, DU, () => c.query(
    `select driver_report_incident($1, 'retard', 'haute', 'Client injoignable') as id`, [oid54]))).rows[0].id;
  const inc = (await c.query('select * from incidents where id = $1', [incId])).rows[0];
  if (inc && inc.kind === 'retard' && inc.severity === 'haute' && inc.order_id === oid54)
    ok('driver_report_incident files the incident the gérant sees (0054)');
  else bad(`incident wrong: ${JSON.stringify(inc)}`);
  const DU2 = (await c.query(`insert into auth.users (raw_user_meta_data) values ('{"full_name":"Autre livreur"}') returning id`)).rows[0].id;
  await c.query(`insert into drivers (name, user_id, vehicle) values ('Omar', $1, 'Scooter')`, [DU2]);
  await expectThrow('driver_report_incident rejects a driver who does not have the order',
    () => asUser(c, DU2, () => c.query(`select driver_report_incident($1, 'litige', 'basse', 'x')`, [oid54])), 'forbidden');
  // Plus fort qu'une RLS qui renverrait zéro ligne : la table n'est pas même
  // lisible par un client — le GRANT s'arrête au staff.
  await expectThrow('incidents stay unreadable to a customer (table grant)',
    () => asUser(c, A, () => c.query('select count(*) from incidents')), 'permission denied');

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
} catch (e) {
  console.error('\nFATAL', e);
  fail++;
} finally {
  await c.end();
  await pg.stop();
  rmSync(DIR, { recursive: true, force: true });
  process.exit(fail ? 1 : 0);
}
