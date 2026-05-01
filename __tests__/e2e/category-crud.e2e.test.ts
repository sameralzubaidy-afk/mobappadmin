/**
 * Playwright E2E: Category CRUD flow
 * FILE: p2p-kids-admin/__tests__/e2e/category-crud.e2e.test.ts
 * ADMIN-V3-009: Create → Edit → Deactivate → Delete category
 * Module: MODULE-12-ADMIN-V3-CATEGORIES
 */

import { test, expect } from '@playwright/test';

test.describe('Category CRUD Flow (ADMIN-V3-009)', () => {
  test.beforeEach(async ({ page }) => {
    // Assumes admin is logged in (or use a login fixture)
    await page.goto('/categories');
    await page.waitForLoadState('networkidle');
  });

  test('should create → edit → deactivate → delete a category', async ({ page }) => {
    // ======================================================================
    // STEP 1: CREATE
    // ======================================================================
    await page.click('button:has-text("Create Category")');
    await page.waitForSelector('[data-testid="category-form"]', { timeout: 5000 });

    // Basic Info tab
    await page.fill('input[name="name"]', 'Art Supplies Test');
    await page.fill('textarea[name="description"]', 'Test category for art supplies');

    // SP Config tab (optional)
    await page.click('button:has-text("SP Config")');
    await page.fill('input[name="sp_earning_multiplier"]', '1.20');
    await page.fill('input[name="sp_spending_cap_percent"]', '75');

    // Submit
    await page.click('button:has-text("Create")');
    await page.waitForSelector('text=Art Supplies Test', { timeout: 10000 });

    // Verify in table
    const categoryRow = page.locator('tr:has-text("Art Supplies Test")');
    await expect(categoryRow).toBeVisible();

    // ======================================================================
    // STEP 2: EDIT
    // ======================================================================
    await categoryRow.locator('button:has-text("Edit")').click();
    await page.waitForSelector('[data-testid="category-form"]');

    // Change name
    await page.fill('input[name="name"]', 'Art Supplies Edited');
    await page.click('button:has-text("Save")');
    await page.waitForSelector('text=Art Supplies Edited', { timeout: 10000 });

    // Verify updated name
    const editedRow = page.locator('tr:has-text("Art Supplies Edited")');
    await expect(editedRow).toBeVisible();

    // ======================================================================
    // STEP 3: DEACTIVATE (via toggle or bulk action)
    // ======================================================================
    // Option A: Use toggle button in row
    await editedRow.locator('button[data-testid="toggle-active"]').click();
    await page.waitForTimeout(1000); // Wait for optimistic update

    // Verify row shows inactive state (badge or icon)
    const inactiveBadge = editedRow.locator('span:has-text("Inactive")');
    await expect(inactiveBadge).toBeVisible();

    // ======================================================================
    // STEP 4: DELETE (only allowed when item_count = 0)
    // ======================================================================
    // First ensure item_count is 0 (should be since we just created it)
    const itemCountCell = editedRow.locator('td').filter({ hasText: /^0$/ });
    await expect(itemCountCell).toBeVisible();

    // Click delete button
    await editedRow.locator('button:has-text("Delete")').click();

    // Confirm in modal
    await page.click('button:has-text("Confirm")');
    await page.waitForTimeout(1000);

    // Verify row is removed
    await expect(editedRow).not.toBeVisible();
  });

  test('should disable delete button when item_count > 0', async ({ page }) => {
    // Find a category with items (assume "Books" has items)
    const categoryRow = page.locator('tr:has-text("Books")').first();
    const deleteButton = categoryRow.locator('button:has-text("Delete")');

    // Should be disabled
    await expect(deleteButton).toBeDisabled();
  });

  test('should reject duplicate category name on create', async ({ page }) => {
    await page.click('button:has-text("Create Category")');
    await page.waitForSelector('[data-testid="category-form"]');

    // Try creating "Books" (already exists)
    await page.fill('input[name="name"]', 'Books');
    await page.click('button:has-text("Create")');

    // Should show error message
    await page.waitForSelector('text=/already exists/i', { timeout: 5000 });
  });
});
