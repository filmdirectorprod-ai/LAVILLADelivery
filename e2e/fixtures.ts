import { test as base, expect } from '@playwright/test';

// Gate for backend-dependent specs. The authenticated customer flows hit dynamic
// routes that need a live Supabase project (auth, place_order, mover, realtime).
// Until that's provisioned, set nothing and the flow specs skip cleanly; once the
// project exists and is seeded, export E2E_SUPABASE_READY=1 to enable them.
export const SUPABASE_READY = process.env.E2E_SUPABASE_READY === '1';

// Optional pre-seeded test account (created in the Supabase project) used by the
// flow specs to sign in without going through Google OAuth.
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
