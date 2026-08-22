import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Admin Portal
 * File: p2p-kids-admin/playwright.config.ts
 */

export default defineConfig({
  testDir: './__tests__',
  testMatch: '**/*.e2e.test.ts',
  testIgnore: [
    // Jest-based e2e tests (import @jest/globals) — they match the Playwright
    // `**/*.e2e.test.ts` glob but must NOT be collected by Playwright, or
    // collection aborts with "Do not import @jest/globals outside of the Jest
    // test environment" (e.g. items-flagged-status was missing here and broke
    // `npx playwright test --list` / `npm run test:playwright`).
    '**/id-badge-admin.e2e.test.ts',
    '**/payout-fees.e2e.test.ts',
    '**/review-moderation.e2e.test.ts',
    '**/e2e/id-badge-messages.e2e.test.ts',
    '**/e2e/items-flagged-status.e2e.test.ts',
  ],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
