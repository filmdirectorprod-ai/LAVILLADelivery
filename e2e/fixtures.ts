import { test as base, expect } from '@playwright/test';

// Gate for backend-dependent specs. The authenticated customer flows hit dynamic
// routes that need a live Supabase project (auth, place_order, mover, realtime).
// Until that's provisioned, set nothing and the flow specs skip cleanly; once the
// project exists and is seeded, export E2E_SUPABASE_READY=1 to enable them.
export const SUPABASE_READY = process.env.E2E_SUPABASE_READY === '1';

// Optional pre-seeded test account (created in the Supabase project) used by the
// flow specs to sign in without going through Google OAuth.
//
// The account needs more than credentials for the checkout spec to reach
// /tracking: without a DEFAULT DELIVERY ADDRESS and a phone number on its
// profile, the payment screen has nothing to submit and the run dies on a
// timeout that says only "waiting for navigation". Seed it once:
//
//   insert into addresses (user_id, label, recipient, phone, line1, city, zone_id, is_default)
//   values ('<user id>', 'Domicile', 'Compte de test', '0600000000',
//           '12 Av. Hassan II, Ville Nouvelle', 'Fès',
//           (select id from delivery_zones order by fee_dh limit 1), true);
//   update profiles set phone = '0600000000' where id = '<user id>';
//
// Deleting the auth user removes all of it again — and every order it placed,
// through the on-delete-cascade on orders.user_id.
export const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? '';
export const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? '';

export const test = base;
export { expect };

/** Sign in via the /auth email+password form. Assumes the account exists. */
export async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/auth');
  await page.getByPlaceholder('vous@exemple.com').fill(TEST_EMAIL);
  await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL('**/');
}
