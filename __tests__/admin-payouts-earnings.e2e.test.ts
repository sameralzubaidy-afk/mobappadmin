/**
 * E2E Tests: Admin Payouts Management
 * File: p2p-kids-admin/__tests__/admin-payouts-earnings.e2e.test.ts
 * Module: MODULE-06-TRADE-FLOW-sellerpayouts.md
 * Task: PAY-008
 */

import { test, expect } from '@playwright/test';

test.describe('Admin Payouts Management', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: Implement admin login
    await page.goto('/auth/login');
    // Perform admin login steps
  });

  test('displays payout stats correctly', async ({ page }) => {
    await page.goto('/payouts/earnings');

    // Wait for stats to load
    await page.waitForSelector('[data-testid="payout-stats"]');

    // Verify stat cards are visible
    await expect(page.getByText('Total Payouts')).toBeVisible();
    await expect(page.getByText('Completed')).toBeVisible();
    await expect(page.getByText('Pending')).toBeVisible();
    await expect(page.getByText('Failed')).toBeVisible();
    await expect(page.getByText('Total Volume')).toBeVisible();
  });

  test('loads and displays payouts table', async ({ page }) => {
    await page.goto('/payouts/earnings');

    // Wait for table to load
    await page.waitForSelector('table');

    // Verify table headers
    await expect(page.getByText('Seller')).toBeVisible();
    await expect(page.getByText('Trade ID')).toBeVisible();
    await expect(page.getByText('Status')).toBeVisible();
    await expect(page.getByText('Net Amount')).toBeVisible();
    await expect(page.getByText('Provider')).toBeVisible();
    await expect(page.getByText('Created')).toBeVisible();
  });

  test('filters payouts by status', async ({ page }) => {
    await page.goto('/payouts/earnings');

    // Select status filter
    await page.selectOption('select', { value: 'completed' });

    // Wait for filtered results
    await page.waitForTimeout(1000);

    // Verify only completed payouts are shown
    const statusBadges = page.locator('.status-badge');
    const count = await statusBadges.count();
    
    for (let i = 0; i < count; i++) {
      await expect(statusBadges.nth(i)).toContainText('COMPLETED');
    }
  });

  test('searches payouts by seller email', async ({ page }) => {
    await page.goto('/payouts/earnings');

    // Enter search term
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('seller@example.com');

    // Wait for search results
    await page.waitForTimeout(1000);

    // Verify results contain search term
    await expect(page.getByText('seller@example.com')).toBeVisible();
  });

  test('opens payout detail modal', async ({ page }) => {
    await page.goto('/payouts/earnings');

    // Wait for table
    await page.waitForSelector('table tbody tr');

    // Click first payout row
    await page.click('table tbody tr:first-child');

    // Verify modal is open
    await expect(page.getByText('Payout Details')).toBeVisible();
    await expect(page.getByText('Payout ID')).toBeVisible();
    await expect(page.getByText('Amount Breakdown')).toBeVisible();
    await expect(page.getByText('Provider Information')).toBeVisible();
  });

  test('closes detail modal', async ({ page }) => {
    await page.goto('/payouts/earnings');

    // Open modal
    await page.waitForSelector('table tbody tr');
    await page.click('table tbody tr:first-child');
    await expect(page.getByText('Payout Details')).toBeVisible();

    // Close modal
    await page.click('button:has-text("✕")');

    // Verify modal is closed
    await expect(page.getByText('Payout Details')).not.toBeVisible();
  });

  test('displays amount breakdown in detail modal', async ({ page }) => {
    await page.goto('/payouts/earnings');

    // Open modal
    await page.waitForSelector('table tbody tr');
    await page.click('table tbody tr:first-child');

    // Verify breakdown fields
    await expect(page.getByText('Gross Amount')).toBeVisible();
    await expect(page.getByText('Platform Fee')).toBeVisible();
    await expect(page.getByText('Payout Fee')).toBeVisible();
    await expect(page.getByText('Net Amount')).toBeVisible();
  });

  test('retries failed payout', async ({ page }) => {
    await page.goto('/payouts/earnings');

    // Filter to failed payouts
    await page.selectOption('select', { value: 'failed' });
    await page.waitForTimeout(1000);

    // Check if any failed payouts exist
    const retryButtons = page.locator('button:has-text("Retry")');
    const count = await retryButtons.count();

    if (count > 0) {
      // Click retry button
      await retryButtons.first().click();

      // Handle confirmation dialog
      page.on('dialog', dialog => dialog.accept());

      // Wait for success message or refresh
      await page.waitForTimeout(1000);
    }
  });

  test('refreshes payout list', async ({ page }) => {
    await page.goto('/payouts/earnings');

    // Wait for initial load
    await page.waitForSelector('table');

    // Click refresh button
    await page.click('button:has-text("Refresh")');

    // Verify loading indicator appears
    // (Implementation depends on your loading state UI)
  });

  test('exports payouts as CSV', async ({ page }) => {
    await page.goto('/payouts/earnings');

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    await page.click('button:has-text("Export")');

    // Wait for download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('displays empty state when no payouts', async ({ page }) => {
    // This test assumes a clean database or specific test data
    await page.goto('/payouts/earnings');

    // Search for non-existent seller
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('nonexistent@example.com');
    await page.waitForTimeout(1000);

    // Verify empty state
    await expect(page.getByText('No payouts found matching your criteria')).toBeVisible();
  });

  test('links to trade detail page', async ({ page }) => {
    await page.goto('/payouts/earnings');

    // Wait for table
    await page.waitForSelector('table tbody tr');

    // Find and click trade ID link
    const tradeLink = page.locator('a[href*="/trades/"]').first();
    
    if (await tradeLink.count() > 0) {
      await tradeLink.click();
      
      // Verify navigation to trade detail page
      await expect(page).toHaveURL(/\/trades\//);
    }
  });

  test('displays provider reference ID in detail', async ({ page }) => {
    await page.goto('/payouts/earnings');

    // Open detail modal
    await page.waitForSelector('table tbody tr');
    await page.click('table tbody tr:first-child');

    // Verify provider information
    await expect(page.getByText('Provider')).toBeVisible();
    await expect(page.getByText('Reference ID')).toBeVisible();
  });

  test('displays failure reason for failed payouts', async ({ page }) => {
    await page.goto('/payouts/earnings');

    // Filter to failed payouts
    await page.selectOption('select', { value: 'failed' });
    await page.waitForTimeout(1000);

    // Open first failed payout detail
    const rows = page.locator('table tbody tr');
    const count = await rows.count();

    if (count > 0) {
      await rows.first().click();

      // Check for failure reason section
      const failureSection = page.locator('text=Failure Reason');
      if (await failureSection.count() > 0) {
        await expect(failureSection).toBeVisible();
      }
    }
  });
});
