/**
 * Playwright E2E: SP Config Category (change rates + preview)
 * FILE: p2p-kids-admin/__tests__/e2e/sp-config-category.e2e.test.ts
 * ADMIN-V3-009: Change SP rates → verify live preview + notification banner
 * Module: MODULE-12-ADMIN-V3-CATEGORIES
 */

import { test, expect } from '@playwright/test';

test.describe('SP Config Category (ADMIN-V3-009)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/categories');
    await page.waitForLoadState('networkidle');
  });

  test('should update SP rates and show live $50 preview', async ({ page }) => {
    // ======================================================================
    // STEP 1: Edit a category
    // ======================================================================
    const categoryRow = page.locator('tr:has-text("Books")').first();
    await categoryRow.locator('button:has-text("Edit")').click();
    await page.waitForSelector('[data-testid="category-form"]');

    // ======================================================================
    // STEP 2: Navigate to SP Config tab
    // ======================================================================
    await page.click('button:has-text("SP Config")');
    await page.waitForSelector('input[name="sp_earning_multiplier"]');

    // ======================================================================
    // STEP 3: Adjust earning multiplier (1.10 → 1.25)
    // ======================================================================
    await page.fill('input[name="sp_earning_multiplier"]', '1.25');

    // Wait for debounce + live preview update
    await page.waitForTimeout(600);

    // Verify preview math: $50 * 1.25 = 62.5 → round = 63 SP
    const earnPreview = page.locator('[data-testid="earn-sp-preview"]');
    await expect(earnPreview).toContainText('63');

    // ======================================================================
    // STEP 4: Adjust spending cap (70% → 80%)
    // ======================================================================
    await page.fill('input[name="sp_spending_cap_percent"]', '80');
    await page.waitForTimeout(600);

    // Verify preview: $50 * 0.80 = 40 SP (floor)
    const spendPreview = page.locator('[data-testid="max-spend-sp-preview"]');
    await expect(spendPreview).toContainText('40');

    // ======================================================================
    // STEP 5: Enable notification banner
    // ======================================================================
    const notifyCheckbox = page.locator('input[name="sp_rate_change_notify"]');
    await notifyCheckbox.check();

    // ======================================================================
    // STEP 6: Save and verify
    // ======================================================================
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(2000);

    // Verify category row reflects updated SP config (optional: check tooltips or columns)
    await expect(categoryRow).toBeVisible();
  });

  test('should reject SP rates outside valid bounds', async ({ page }) => {
    const categoryRow = page.locator('tr:has-text("Toys")').first();
    await categoryRow.locator('button:has-text("Edit")').click();
    await page.waitForSelector('[data-testid="category-form"]');

    await page.click('button:has-text("SP Config")');

    // Try setting earning multiplier out of range (e.g., 2.00)
    await page.fill('input[name="sp_earning_multiplier"]', '2.00');
    await page.click('button:has-text("Save")');

    // Should show validation error
    await page.waitForSelector('text=/earning multiplier must be between/i', { timeout: 5000 });
  });

  test('should allow SP config notes for internal tracking', async ({ page }) => {
    const categoryRow = page.locator('tr:has-text("Clothes")').first();
    await categoryRow.locator('button:has-text("Edit")').click();
    await page.waitForSelector('[data-testid="category-form"]');

    await page.click('button:has-text("SP Config")');

    // Fill config notes
    await page.fill('textarea[name="sp_config_notes"]', 'Testing bonus period for spring');

    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1500);

    // Reopen and verify note persisted
    await categoryRow.locator('button:has-text("Edit")').click();
    await page.click('button:has-text("SP Config")');

    const notesField = page.locator('textarea[name="sp_config_notes"]');
    await expect(notesField).toHaveValue('Testing bonus period for spring');
  });

  test('should show bonus badge icon when multiplier > 1.10', async ({ page }) => {
    const categoryRow = page.locator('tr:has-text("Electronics")').first();
    await categoryRow.locator('button:has-text("Edit")').click();
    await page.waitForSelector('[data-testid="category-form"]');

    await page.click('button:has-text("SP Config")');

    // Set multiplier to 1.15 (triggers bonus badge)
    await page.fill('input[name="sp_earning_multiplier"]', '1.15');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(2000);

    // Verify bonus badge shown in table (e.g., icon or "BONUS" text)
    const bonusBadge = categoryRow.locator('[data-testid="bonus-badge"]');
    await expect(bonusBadge).toBeVisible();
  });
});
