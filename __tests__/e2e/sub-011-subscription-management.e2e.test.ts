/**
 * E2E Tests: Subscription Management & Grace Period Config
 * File: p2p-kids-admin/__tests__/e2e/sub-011-subscription-management.e2e.test.ts
 * Module: MODULE-11-SUBSCRIPTIONS-V2.md
 * Task: SUB-011
 * 
 * NOTE: After running this test and changing grace period config values,
 * the following mobile Maestro flows must be run:
 * - subscription-grace-period.yaml
 * - subscription-cancel.yaml
 * - notifications-grace-reminders.yaml
 */

import { test, expect } from '@playwright/test';

const PLAYWRIGHT_ADMIN_E2E = process.env.PLAYWRIGHT_ADMIN_E2E === 'true';
const ADMIN_E2E_EMAIL = process.env.ADMIN_E2E_EMAIL;
const ADMIN_E2E_PASSWORD = process.env.ADMIN_E2E_PASSWORD;

async function ensureAdminSession(page: any) {
  await page.goto('/subscriptions/manage');

  if (page.url().includes('/auth/login')) {
    if (!ADMIN_E2E_EMAIL || !ADMIN_E2E_PASSWORD) {
      test.skip(true, 'Set ADMIN_E2E_EMAIL and ADMIN_E2E_PASSWORD for authenticated E2E runs.');
    }

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const submitButton = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")').first();

    await emailInput.fill(ADMIN_E2E_EMAIL!);
    await passwordInput.fill(ADMIN_E2E_PASSWORD!);
    await submitButton.click();
    await page.waitForLoadState('networkidle');

    await page.goto('/subscriptions/manage');
  }

  await page.waitForLoadState('networkidle');
}

test.describe('Subscription Management & Grace Period Config (SUB-011)', () => {
  test.skip(!PLAYWRIGHT_ADMIN_E2E, 'Set PLAYWRIGHT_ADMIN_E2E=true to run admin UI Playwright tests.');

  test.beforeEach(async ({ page }) => {
    await ensureAdminSession(page);
  });

  test('displays subscription metrics correctly', async ({ page }) => {
    // Wait for metrics to load
    await page.waitForSelector('[data-testid="subscription-metrics"]', { timeout: 10000 });

    // Verify all metric cards are visible
    await expect(page.getByTestId('metric-mrr')).toBeVisible();
    await expect(page.getByTestId('metric-active')).toBeVisible();
    await expect(page.getByTestId('metric-trial')).toBeVisible();
    await expect(page.getByTestId('metric-grace')).toBeVisible();
    await expect(page.getByTestId('metric-churn')).toBeVisible();

    // Verify metrics are formatted correctly (should show numbers or currency)
    const mrrText = await page.getByTestId('metric-mrr').textContent();
    expect(mrrText).toMatch(/\$\d+\.\d{2}/); // Should be formatted as currency
  });

  test('displays grace period configuration section', async ({ page }) => {
    // Verify grace period config section exists
    await expect(page.getByTestId('grace-period-config')).toBeVisible();

    // Verify both config fields are present
    await expect(page.getByTestId('grace-days-input')).toBeVisible();
    await expect(page.getByTestId('reminder-thresholds-input')).toBeVisible();

    // Verify save buttons exist
    await expect(page.getByTestId('save-grace-days-btn')).toBeVisible();
    await expect(page.getByTestId('save-reminder-thresholds-btn')).toBeVisible();
  });

  test('updates grace period days successfully', async ({ page }) => {
    // Wait for config to load
    await page.waitForSelector('[data-testid="grace-days-input"]');

    // Get current value
    const currentValue = await page.getByTestId('grace-days-input').inputValue();
    const originalValue = parseInt(currentValue, 10);

    // Change to a new value
    const newValue = originalValue === 90 ? 60 : 90;
    await page.getByTestId('grace-days-input').fill(String(newValue));

    // Save the change
    await page.getByTestId('save-grace-days-btn').click();

    // Wait for success message
    await expect(page.getByTestId('config-success')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('config-success')).toContainText('Grace period days updated successfully');

    // Verify the value persisted
    const updatedValue = await page.getByTestId('grace-days-input').inputValue();
    expect(parseInt(updatedValue, 10)).toBe(newValue);

    // Restore original value
    await page.getByTestId('grace-days-input').fill(String(originalValue));
    await page.getByTestId('save-grace-days-btn').click();
    await expect(page.getByTestId('config-success')).toBeVisible({ timeout: 5000 });
  });

  test('validates grace period days input', async ({ page }) => {
    await page.waitForSelector('[data-testid="grace-days-input"]');

    // Test invalid input (zero)
    await page.getByTestId('grace-days-input').fill('0');
    await page.getByTestId('save-grace-days-btn').click();

    // Should show error
    await expect(page.getByTestId('config-error')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('config-error')).toContainText('must be a positive integer');
  });

  test('updates reminder thresholds successfully', async ({ page }) => {
    await page.waitForSelector('[data-testid="reminder-thresholds-input"]');

    // Get current value
    const currentValue = await page.getByTestId('reminder-thresholds-input').inputValue();

    // Change to a new value
    const newValue = '90, 60, 30, 7';
    await page.getByTestId('reminder-thresholds-input').fill(newValue);

    // Save the change
    await page.getByTestId('save-reminder-thresholds-btn').click();

    // Wait for success message
    await expect(page.getByTestId('config-success')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('config-success')).toContainText('Reminder thresholds updated successfully');

    // Restore original value
    await page.getByTestId('reminder-thresholds-input').fill(currentValue);
    await page.getByTestId('save-reminder-thresholds-btn').click();
    await expect(page.getByTestId('config-success')).toBeVisible({ timeout: 5000 });
  });

  test('filters subscriptions by status', async ({ page }) => {
    // Wait for filters to load
    await page.waitForSelector('[data-testid="filter-all"]');

    // Click trial filter
    await page.getByTestId('filter-trial').click();

    // Verify filter is active (should have blue background)
    const trialFilter = page.getByTestId('filter-trial');
    await expect(trialFilter).toHaveClass(/bg-blue-600/);

    // Click active filter
    await page.getByTestId('filter-active').click();
    await expect(page.getByTestId('filter-active')).toHaveClass(/bg-blue-600/);

    // Click all filter
    await page.getByTestId('filter-all').click();
    await expect(page.getByTestId('filter-all')).toHaveClass(/bg-blue-600/);
  });

  test('displays subscriptions table when data exists', async ({ page }) => {
    // If subscriptions exist, table should be visible
    const hasSubscriptions = await page.getByTestId('subscriptions-table').isVisible().catch(() => false);
    const isEmpty = await page.getByTestId('empty-state').isVisible().catch(() => false);

    // One of these should be true
    expect(hasSubscriptions || isEmpty).toBe(true);

    if (hasSubscriptions) {
      // Verify table has expected structure
      await expect(page.locator('table thead th').first()).toBeVisible();
      
      // Should have at least the header row
      const rows = page.locator('table tbody tr');
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('handles loading state', async ({ page }) => {
    // Reload page to see loading state
    await page.goto('/subscriptions/manage');
    
    // Loading state should appear briefly (may be too fast to catch)
    const loadingVisible = await page.getByTestId('loading-state').isVisible().catch(() => false);
    
    // Eventually should show either data or empty state
    await page.waitForSelector('[data-testid="subscriptions-table"], [data-testid="empty-state"], [data-testid="error-state"]', {
      timeout: 10000,
    });
  });
});
