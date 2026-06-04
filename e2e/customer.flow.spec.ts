import { test, expect, signIn, SUPABASE_READY, TEST_EMAIL, TEST_PASSWORD } from './fixtures';

// Authenticated customer journey. Hits dynamic routes that require a live,
// seeded Supabase project (auth, place_order RPC, mover, realtime), so the whole
// suite skips unless E2E_SUPABASE_READY=1 and a test account is configured.
test.describe('Customer journey (requires live Supabase)', () => {
  test.skip(!SUPABASE_READY, 'Set E2E_SUPABASE_READY=1 + E2E_TEST_EMAIL/PASSWORD to run.');
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Missing E2E_TEST_EMAIL / E2E_TEST_PASSWORD.');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('browse → add to cart → checkout → tracking', async ({ page }) => {
    // Home renders the catalog.
    await expect(page).toHaveURL(/\/$/);

    // Open the catalog and pick the first product.
    await page.goto('/search');
    await page.locator('[data-testid="product-card"], button, a').first().click();
    await page.waitForURL('**/product/**');

    // Add to cart, land on cart.
    await page.getByRole('button', { name: /ajouter|panier/i }).first().click();
    await page.waitForURL('**/cart');

    // Proceed to checkout and place the order.
    await page.getByRole('button', { name: /commander/i }).click();
    await page.waitForURL('**/checkout');
    await page.getByRole('button', { name: /confirmer|payer|commander/i }).first().click();

    // Server-authoritative order placement redirects to live tracking.
    await page.waitForURL('**/tracking/**', { timeout: 15_000 });
    await expect(page.getByText(/arrivée estimée|commande livrée/i)).toBeVisible();
  });

  test('loyalty screen reflects the profile balance', async ({ page }) => {
    await page.goto('/loyalty');
    await expect(page.getByText('Votre solde de points')).toBeVisible();
    await expect(page.getByText(/palier/i).first()).toBeVisible();
  });

  test('orders list shows history with tabs', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByRole('heading', { name: 'Mes commandes' })).toBeVisible();
    await expect(page.getByText('En cours')).toBeVisible();
    await expect(page.getByText('Terminées')).toBeVisible();
  });
});
