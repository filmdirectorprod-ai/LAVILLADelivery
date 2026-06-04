import { test, expect } from './fixtures';

// Smoke coverage for the statically-prerendered public pages. These render with
// no Supabase backend, so they validate the build + routing + client bundles in
// CI even before the database is provisioned.

test.describe('Onboarding', () => {
  test('walks through the 3 slides to the auth screen', async ({ page }) => {
    await page.goto('/onboarding');

    // First slide.
    await expect(page.getByText('Le goût de La Villa', { exact: false })).toBeVisible();

    // Advance: Suivant → Suivant → Commencer.
    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByText('Livraison rapide', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByText('Suivez votre commande', { exact: false })).toBeVisible();

    await page.getByRole('button', { name: 'Commencer' }).click();
    await page.waitForURL('**/auth');
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  });

  test('"Passer" jumps straight to auth', async ({ page }) => {
    await page.goto('/onboarding');
    await page.getByRole('button', { name: 'Passer' }).click();
    await page.waitForURL('**/auth');
  });
});

test.describe('Auth', () => {
  test('shows sign-in form and toggles to sign-up', async ({ page }) => {
    await page.goto('/auth');

    await expect(page.getByText('Bienvenue', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('vous@exemple.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();

    // Toggle to sign-up reveals the full-name field.
    await page.getByRole('button', { name: /inscrivez-vous/i }).click();
    await expect(page.getByText('Créer un compte', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Sofia El Amrani')).toBeVisible();
    await expect(page.getByRole('button', { name: "S'inscrire" })).toBeVisible();
  });

  test('blocks submit with empty credentials', async ({ page }) => {
    await page.goto('/auth');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByText(/renseignez votre e-mail/i)).toBeVisible();
  });
});
