/**
 * Playwright E2E: Bulk Deactivate Categories
 * FILE: p2p-kids-admin/__tests__/e2e/bulk-deactivate.e2e.test.ts
 * ADMIN-V3-009: Bulk-select 3 → deactivate → verify all inactive
 * Module: MODULE-12-ADMIN-V3-CATEGORIES
 */

import { test, expect } from '@playwright/test';

test.describe('Bulk Deactivate Categories (ADMIN-V3-009)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/categories');
    await page.waitForLoadState('networkidle');
  });

  test('should bulk-select 3 categories and deactivate them', async ({ page }) => {
    // ======================================================================
    // STEP 1: Select 3 active categories via checkboxes
    // ======================================================================
    const activeRows = page.locator('tr').filter({ hasText: /active/i });
    
    // Ensure at least 3 active categories exist
    const count = await activeRows.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // Click first 3 checkboxes
    for (let i = 0; i < 3; i++) {
      await activeRows.nth(i).locator('input[type="checkbox"]').check();
    }

    // Wait for bulk actions dropdown to appear
    await page.waitForSelector('[data-testid="bulk-actions"]', { timeout: 5000 });

    // Verify count shows "3 selected"
    const bulkActions = page.locator('[data-testid="bulk-actions"]');
    await expect(bulkActions).toContainText('3');

    // ======================================================================
    // STEP 2: Click "Deactivate" in bulk actions
    // ======================================================================
    await bulkActions.locator('button:has-text("Deactivate")').click();

    // Confirm in modal
    await page.waitForSelector('text=/confirm.*deactivate/i', { timeout: 5000 });
    await page.click('button:has-text("Confirm")');

    await page.waitForTimeout(2000); // Wait for API calls

    // ======================================================================
    // STEP 3: Verify all 3 are now inactive
    // ======================================================================
    // Capture the category names before deactivating (optional)
    const firstRowName = await activeRows.nth(0).locator('td').first().textContent();
    const secondRowName = await activeRows.nth(1).locator('td').first().textContent();
    const thirdRowName = await activeRows.nth(2).locator('td').first().textContent();

    // Check that each row now shows "Inactive" badge
    const firstInactive = page.locator(`tr:has-text("${firstRowName}") span:has-text("Inactive")`);
    const secondInactive = page.locator(`tr:has-text("${secondRowName}") span:has-text("Inactive")`);
    const thirdInactive = page.locator(`tr:has-text("${thirdRowName}") span:has-text("Inactive")`);

    await expect(firstInactive).toBeVisible();
    await expect(secondInactive).toBeVisible();
    await expect(thirdInactive).toBeVisible();

    // ======================================================================
    // STEP 4: Reactivate them (cleanup for idempotency)
    // ======================================================================
    // Select the same 3 again (now inactive)
    const inactiveRows = page.locator('tr').filter({ hasText: /inactive/i });

    for (let i = 0; i < 3; i++) {
      await inactiveRows.nth(i).locator('input[type="checkbox"]').check();
    }

    await page.waitForSelector('[data-testid="bulk-actions"]');
    await bulkActions.locator('button:has-text("Activate")').click();
    await page.click('button:has-text("Confirm")');
    await page.waitForTimeout(2000);

    // Verify they are active again
    const firstActive = page.locator(`tr:has-text("${firstRowName}") span:has-text("Active")`);
    await expect(firstActive).toBeVisible();
  });

  test('should disable bulk deactivate if "Other" category selected', async ({ page }) => {
    // Select "Other" category (system category that cannot be deactivated)
    const otherRow = page.locator('tr:has-text("Other")').first();
    await otherRow.locator('input[type="checkbox"]').check();

    // Bulk actions should appear but Deactivate button should be disabled
    await page.waitForSelector('[data-testid="bulk-actions"]');
    const deactivateButton = page.locator('button:has-text("Deactivate")');

    await expect(deactivateButton).toBeDisabled();
  });

  test('should show warning if trying to delete categories with items', async ({ page }) => {
    // Find a category with item_count > 0
    const categoryWithItems = page.locator('tr').filter({ hasText: /\d+/ }).first();
    await categoryWithItems.locator('input[type="checkbox"]').check();

    await page.waitForSelector('[data-testid="bulk-actions"]');
    await page.locator('button:has-text("Delete")').click();

    // Should show error modal or toast
    await page.waitForSelector('text=/cannot delete.*items/i', { timeout: 5000 });
  });

  test('should clear selection after bulk action', async ({ page }) => {
    const activeRows = page.locator('tr').filter({ hasText: /active/i });

    // Select 2 categories
    await activeRows.nth(0).locator('input[type="checkbox"]').check();
    await activeRows.nth(1).locator('input[type="checkbox"]').check();

    await page.waitForSelector('[data-testid="bulk-actions"]');

    // Deactivate
    await page.locator('button:has-text("Deactivate")').click();
    await page.click('button:has-text("Confirm")');
    await page.waitForTimeout(2000);

    // Bulk actions should disappear (selection cleared)
    await expect(page.locator('[data-testid="bulk-actions"]')).not.toBeVisible();

    // All checkboxes should be unchecked
    const checkedCount = await page.locator('input[type="checkbox"]:checked').count();
    expect(checkedCount).toBe(0);
  });
});
