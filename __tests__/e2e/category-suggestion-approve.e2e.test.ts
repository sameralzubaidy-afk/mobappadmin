/**
 * Playwright E2E: Category Suggestion Approval Flow
 * FILE: p2p-kids-admin/__tests__/e2e/category-suggestion-approve.e2e.test.ts
 * ADMIN-V3-009: Approve suggestion → verify category created + item reassigned
 * Module: MODULE-12-ADMIN-V3-CATEGORIES
 */

import { test, expect } from '@playwright/test';

test.describe('Category Suggestion Approval (ADMIN-V3-009)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/categories/suggestions');
    await page.waitForLoadState('networkidle');
  });

  test('should approve suggestion and create new category', async ({ page }) => {
    // Assumes at least one pending suggestion exists in DB
    // (You may need to seed this via API or SQL before running test)

    // ======================================================================
    // STEP 1: Find a pending suggestion
    // ======================================================================
    const suggestionRow = page.locator('tr').filter({ hasText: /pending/i }).first();
    await expect(suggestionRow).toBeVisible({ timeout: 10000 });

    // Extract suggested name (e.g., "Art Supplies")
    const suggestedName = await suggestionRow.locator('td').nth(1).textContent();

    // ======================================================================
    // STEP 2: Click Approve button
    // ======================================================================
    await suggestionRow.locator('button:has-text("Approve")').click();

    // Wait for modal or confirmation
    await page.waitForSelector('[data-testid="approve-modal"]', { timeout: 5000 });

    // Fill in SP config if required (or use defaults)
    await page.fill('input[name="sp_earning_multiplier"]', '1.10');
    await page.fill('input[name="sp_spending_cap_percent"]', '70');

    await page.click('button:has-text("Confirm")');
    await page.waitForTimeout(2000); // Wait for API call

    // ======================================================================
    // STEP 3: Verify category created
    // ======================================================================
    await page.goto('/categories');
    await page.waitForLoadState('networkidle');

    const newCategoryRow = page.locator(`tr:has-text("${suggestedName}")`);
    await expect(newCategoryRow).toBeVisible({ timeout: 10000 });

    // ======================================================================
    // STEP 4: Verify suggestion status changed to 'approved'
    // ======================================================================
    await page.goto('/categories/suggestions');
    await page.waitForLoadState('networkidle');

    // Filter to approved suggestions
    await page.click('button:has-text("Approved")');
    await page.waitForTimeout(1000);

    const approvedRow = page.locator(`tr:has-text("${suggestedName}")`);
    await expect(approvedRow).toBeVisible();
  });

  test('should reject suggestion with optional note', async ({ page }) => {
    const suggestionRow = page.locator('tr').filter({ hasText: /pending/i }).first();
    await expect(suggestionRow).toBeVisible({ timeout: 10000 });

    const suggestedName = await suggestionRow.locator('td').nth(1).textContent();

    // Click Reject
    await suggestionRow.locator('button:has-text("Reject")').click();

    // Wait for modal
    await page.waitForSelector('[data-testid="reject-modal"]', { timeout: 5000 });

    // Add admin note
    await page.fill('textarea[name="admin_note"]', 'Too generic');
    await page.click('button:has-text("Confirm")');
    await page.waitForTimeout(1000);

    // Verify status changed to 'rejected'
    await page.click('button:has-text("Rejected")');
    await page.waitForTimeout(1000);

    const rejectedRow = page.locator(`tr:has-text("${suggestedName}")`);
    await expect(rejectedRow).toBeVisible();
  });

  test('should merge suggestion into existing category', async ({ page }) => {
    const suggestionRow = page.locator('tr').filter({ hasText: /pending/i }).first();
    await expect(suggestionRow).toBeVisible({ timeout: 10000 });

    // Click Merge
    await suggestionRow.locator('button:has-text("Merge")').click();

    // Select target category (e.g., "Books")
    await page.waitForSelector('select[name="target_category_id"]', { timeout: 5000 });
    await page.selectOption('select[name="target_category_id"]', { label: 'Books' });

    await page.click('button:has-text("Confirm Merge")');
    await page.waitForTimeout(2000);

    // Verify suggestion removed from pending
    await expect(suggestionRow).not.toBeVisible();
  });
});
