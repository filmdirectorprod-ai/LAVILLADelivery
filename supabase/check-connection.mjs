// Vérifie que .env.local est correctement rempli et que la base répond.
// N'AFFICHE JAMAIS une valeur de clé — uniquement des états.
//
//   node supabase/check-connection.mjs
import { readFileSync } from 'node:fs';

const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { console.log(`  ✗ ${m}`); failed++; };
let failed = 0;

let env = {};
try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2].trim();
  }
} catch {
  console.log('  ✗ .env.local introuvable — lancez ce script depuis le dossier du projet.');
  process.exit(1);
}

console.log('\n[1] Le fichier .env.local');
const need = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const k of need) {
  if (!env[k]) bad(`${k} est vide`);
  else if (env[k].startsWith('"') || env[k].endsWith('"')) bad(`${k} contient des guillemets — retirez-les`);
  else ok(`${k} renseignée (${env[k].length} caractères)`);
}
if (env.NEXT_PUBLIC_SUPABASE_URL && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(env.NEXT_PUBLIC_SUPABASE_URL))
  bad('NEXT_PUBLIC_SUPABASE_URL ne ressemble pas à https://xxxx.supabase.co');
if (failed) { console.log('\nCorrigez ces points, puis relancez.\n'); process.exit(1); }

const url = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svc = env.SUPABASE_SERVICE_ROLE_KEY;

async function call(path, key, init = {}) {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  return { status: r.status, body: await r.text() };
}

console.log('\n[2] La connexion');
const ping = await call('products?select=id&limit=1', anon).catch((e) => ({ status: 0, body: e.message }));
if (ping.status === 200) ok('la base répond, et le catalogue est lisible avec la clé publique');
else bad(`échec (HTTP ${ping.status}) — ${ping.body.slice(0, 160)}`);

console.log('\n[3] Les migrations 0051 / 0052');
for (const [fn, args] of [
  ['admin_customer_rows', { p_limit: 1 }],
  ['admin_stats_snapshot', { p_from: '2026-01-01', p_to: '2026-12-31', p_prev_from: '2025-01-01' }],
]) {
  const r = await call(`rpc/${fn}`, svc, { method: 'POST', body: JSON.stringify(args) })
    .catch((e) => ({ status: 0, body: e.message }));
  if (r.status === 200) ok(`${fn}() répond`);
  else if (r.status === 404 || /does not exist|schema cache/i.test(r.body))
    bad(`${fn}() est absente — le SQL des migrations n'a pas été appliqué`);
  else bad(`${fn}() → HTTP ${r.status} : ${r.body.slice(0, 160)}`);
}

console.log(failed ? '\n❌ ' + failed + ' point(s) à régler.\n' : '\n✅ Tout est en place — vous pouvez lancer demarrer.sh\n');
process.exit(failed ? 1 : 0);
