// La Villa — backend verification harness.
//
// Boots a real PostgreSQL in userspace (no Docker, no admin) via the
// `embedded-postgres` package, applies the migrations, and asserts the
// server-authoritative security + pricing behaviour that `tsc`/`next build`
// cannot reach. Run it before provisioning a real Supabase project, or in CI,
// to catch SQL/RLS/RPC regressions.
//
// Usage (the binary is heavy + dev-only, so it is intentionally NOT a
// package.json dependency — install it on demand):
//
//   npm i embedded-postgres --no-save && node supabase/verify.mjs
//
// Notes:
//   • Skips 0005 (pg_cron + the supabase_realtime publication are Supabase-only).
//   • Shims the auth schema/roles/auth.uid() that Supabase normally provides,
//     so auth.uid() reads the request.jwt.claim.sub GUC we set per "user".
import EmbeddedPostgres from 'embedded-postgres';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const HERE = import.meta.dirname;
const DIR = join(HERE, '.verify-pgdata');
rmSync(DIR, { recursive: true, force: true });

const read = (f) => readFileSync(join(HERE, 'migrations', f), 'utf8');
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
  console.log('\n[apply] shim + migrations 0001-0004, 0006 + seed');
  await c.query(SHIM);
  for (const f of ['0001_core_schema.sql', '0002_rls.sql', '0003_profile_trigger.sql', '0004_place_order.sql', '0006_submit_review.sql']) {
    await c.query(read(f));
    console.log(`  applied ${f}`);
  }
  await c.query(seed);
  await c.query(GRANTS);
  ok('all migrations + seed executed without error');

  const A = (await c.query(`insert into auth.users (raw_user_meta_data) values ('{"full_name":"Alice"}') returning id`)).rows[0].id;
  const B = (await c.query(`insert into auth.users (raw_user_meta_data) values ('{"full_name":"Bob"}') returning id`)).rows[0].id;
  const pA = (await c.query('select full_name, loyalty_points, loyalty_tier from profiles where id=$1', [A])).rows[0];
  if (pA && pA.full_name === 'Alice' && pA.loyalty_points === 0 && pA.loyalty_tier === 'Gourmand') ok('handle_new_user trigger provisioned profile from metadata');
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
  if (bal === 76) ok('loyalty balance credited via RPC (76)'); else bad(`balance wrong: ${bal}`);

  await c.query(`update orders set status='delivered' where id=$1`, [oid]);
  const newBal = (await asUser(c, A, () => c.query(`select submit_review($1,$2,5,'{Goût}','Top',null) as b`, [A, oid]))).rows[0].b;
  if (newBal === 126) ok('submit_review awarded +50 (76 → 126)'); else bad(`review balance wrong: ${newBal}`);

  await expectThrow('submit_review rejects a forged p_user',
    () => asUser(c, A, () => c.query(`select submit_review($1,$2,5,'{}','x',null)`, [B, oid])), 'forbidden');
  await expectThrow('second review on the same order is rejected (unique order_id)',
    () => asUser(c, A, () => c.query(`select submit_review($1,$2,4,'{}','again',null)`, [A, oid])), 'duplicate key');

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
