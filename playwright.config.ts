import { defineConfig, devices } from '@playwright/test';

// La Villa — end-to-end test config.
//
// Two tiers of specs live under e2e/:
//   • *.smoke.spec.ts  — exercise the statically-prerendered public pages
//     (/onboarding, /auth). These run with NO backend, so they pass in CI even
//     before Supabase is provisioned.
//   • *.flow.spec.ts   — exercise the authenticated customer journeys (browse →
//     cart → checkout → tracking → review → loyalty). These hit dynamic routes
//     that require a live Supabase project, so they auto-skip unless
//     E2E_SUPABASE_READY=1 is set (see e2e/fixtures.ts).
//
// Run:  npm run e2e:install   (one-time: download Chromium)
//       npm run e2e           (against BASE_URL, default http://localhost:3000)
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    locale: 'fr-FR',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 420, height: 880 } },
    },
  ],
  // Only auto-start a dev server when testing locally against the default URL.
  // CI / preview deployments set E2E_BASE_URL and skip this.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        // Probe a statically-prerendered public page for readiness: the root
        // route needs a live Supabase backend and would 500 without one, which
        // Playwright treats as "not ready". /onboarding renders backend-free.
        url: `${BASE_URL}/onboarding`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
