/**
 * Playwright E2E: Category Reorder (DnD persistence)
 * FILE: p2p-kids-admin/__tests__/e2e/category-reorder.e2e.test.ts
 * ADMIN-V3-009: Drag category to new position → verify persisted
 * Module: MODULE-12-ADMIN-V3-CATEGORIES
 */

import { test, expect } from '@playwright/test';

test.describe('Category Reorder (ADMIN-V3-009)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/categories');
    await page.waitForLoadState('networkidle');
  });

  test('should reorder categories via drag-and-drop and persist', async ({ page }) => {
    // ======================================================================
    // STEP 1: Capture initial order
    // ======================================================================
    const initialOrder = await page.locator('tbody tr td:first-child').allTextContents();
    const firstCategory = initialOrder[0];
    const secondCategory = initialOrder[1];

    // ======================================================================
    // STEP 2: Drag first row to second position
    // ======================================================================
    const firstRow = page.locator('tbody tr').first();
    const secondRow = page.locator('tbody tr').nth(1);

    // Get bounding boxes
    const firstBox = await firstRow.boundingBox();
    const secondBox = await secondRow.boundingBox();

    if (!firstBox || !secondBox) {
      throw new Error('Could not get bounding boxes for drag-and-drop');
    }

    // Perform drag
    await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2, { steps: 10 });
    await page.mouse.up();

    await page.waitForTimeout(1500); // Wait for optimistic update + API call

    // ======================================================================
    // STEP 3: Verify optimistic UI update
    // ======================================================================
    const updatedOrder = await page.locator('tbody tr td:first-child').allTextContents();
    expect(updatedOrder[0]).toBe(secondCategory);
    expect(updatedOrder[1]).toBe(firstCategory);

    // ======================================================================
    // STEP 4: Reload page and verify persistence
    // ======================================================================
    await page.reload();
    await page.waitForLoadState('networkidle');

    const persistedOrder = await page.locator('tbody tr td:first-child').allTextContents();
    expect(persistedOrder[0]).toBe(secondCategory);
    expect(persistedOrder[1]).toBe(firstCategory);
  });

  test('should rollback on reorder failure', async ({ page }) => {
    // Simulate network failure (intercept reorder RPC and make it fail)
    await page.route('**/api/admin/categories/reorder', (route) => {
      route.abort('failed');
    });

    const initialOrder = await page.locator('tbody tr td:first-child').allTextContents();

    const firstRow = page.locator('tbody tr').first();
    const secondRow = page.locator('tbody tr').nth(1);

    const firstBox = await firstRow.boundingBox();
    const secondBox = await secondRow.boundingBox();

    if (!firstBox || !secondBox) {
      throw new Error('Could not get bounding boxes');
    }

    await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2, { steps: 10 });
    await page.mouse.up();

    await page.waitForTimeout(1500);

    // Should show error message
    await page.waitForSelector('text=/failed to reorder/i', { timeout: 5000 });

    // Verify order rolled back to initial
    const rolledBackOrder = await page.locator('tbody tr td:first-child').allTextContents();
    expect(rolledBackOrder).toEqual(initialOrder);
  });
});
