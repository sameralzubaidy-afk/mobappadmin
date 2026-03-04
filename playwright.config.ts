import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Admin Portal
 * File: p2p-kids-admin/playwright.config.ts
 */

export default defineConfig({
  testDir: './__tests__',
  testMatch: '**/*.e2e.test.ts',
  testIgnore: [
    '**/id-badge-admin.e2e.test.ts',
    '**/payout-fees.e2e.test.ts',
    '**/review-moderation.e2e.test.ts',
    '**/e2e/id-badge-messages.e2e.test.ts',
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
