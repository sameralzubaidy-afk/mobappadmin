/**
 * Playwright E2E: Admin Cart Config — TC-N01 / TC-N02
 * File: p2p-kids-admin/__tests__/e2e/cart-admin-config.e2e.test.ts
 * Source: MODULE-15.1.2 TradeFlowV2 Manual Testing Guide — Group N
 *
 * SCOPE
 *   TC-N01  Admin sets minimum cart value and it reflects in the admin UI
 *           (end-to-end app reflection requires the mobile Maestro TC-M11 flow)
 *   TC-N02  Admin minimum cart value validation (negative / non-numeric rejected)
 *
 * ROUTE   /settings/cart
 * TESTIDS data-testid="cart-min-value-input"  (in CartSettingsPage)
 *
 * NOTE    cart_max_saved_carts and cart_saved_expiry_days are rendered in the
 *         page but are hardcoded in the DB trigger / cart RPC — those fields
 *         are intentionally NOT asserted as end-to-end wired here.
 */

import { test, expect, Page } from '@playwright/test';

const PLAYWRIGHT_ADMIN_E2E = process.env.PLAYWRIGHT_ADMIN_E2E === 'true';
const ADMIN_EMAIL = process.env.ADMIN_E2E_EMAIL || process.env.PLAYWRIGHT_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_E2E_PASSWORD || process.env.PLAYWRIGHT_ADMIN_PASSWORD || '';

// ── shared login helper ─────────────────────────────────────────────────────
async function ensureAdminSession(page: Page): Promise<void> {
  await page.goto('/settings/cart');
  await page.waitForLoadState('networkidle');

  if (page.url().includes('/auth') || page.url().includes('/login')) {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      test.skip(true, 'Set PLAYWRIGHT_ADMIN_EMAIL / PLAYWRIGHT_ADMIN_PASSWORD to run authenticated admin specs.');
    }
    await page.locator('input[type="email"], input[name="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[type="password"], input[name="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")').first().click();
    await page.waitForLoadState('networkidle');
    await page.goto('/settings/cart');
    await page.waitForLoadState('networkidle');
  }
}

// ── test suite ──────────────────────────────────────────────────────────────
test.describe('Cart Admin Config (TC-N01 / TC-N02)', () => {
  test.skip(!PLAYWRIGHT_ADMIN_E2E, 'Set PLAYWRIGHT_ADMIN_E2E=true to run admin Playwright tests.');

  test.beforeEach(async ({ page }) => {
    await ensureAdminSession(page);
  });

  // ── TC-N01: round-trip update of minimum cart value ──────────────────────
  test('TC-N01 — saves minimum cart value and displays the new value', async ({ page }) => {
    // Wait for the page to fully load and the input to appear.
    const minValueInput = page.getByTestId('cart-min-value-input');
    await expect(minValueInput).toBeVisible({ timeout: 10_000 });

    // Read the current value so we can restore it.
    const originalDollars = await minValueInput.inputValue();

    // Write a distinct new value.
    const newDollars = originalDollars === '25.00' ? '30.00' : '25.00';
    await minValueInput.fill(newDollars);

    // Save.
    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Save Settings")').first();
    await saveBtn.click();

    // TC-N01 Expected: success toast/message is visible.
    await expect(page.locator('text=/saved successfully/i, [class*="green"]').first()).toBeVisible({ timeout: 8_000 });

    // Reload and confirm persistence.
    await page.reload({ waitUntil: 'networkidle' });
    const persisted = await page.getByTestId('cart-min-value-input').inputValue();
    expect(persisted).toBe(newDollars);

    // Restore original value so CI runs are idempotent.
    await page.getByTestId('cart-min-value-input').fill(originalDollars);
    await page.locator('button:has-text("Save"), button:has-text("Save Settings")').first().click();
    await expect(page.locator('text=/saved successfully/i, [class*="green"]').first()).toBeVisible({ timeout: 8_000 });
  });

  // ── TC-N02: validation — negative value rejected ─────────────────────────
  test('TC-N02 — rejects a negative minimum cart value', async ({ page }) => {
    const minValueInput = page.getByTestId('cart-min-value-input');
    await expect(minValueInput).toBeVisible({ timeout: 10_000 });

    // Enter negative value.
    await minValueInput.fill('-1');

    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Save Settings")').first();
    await saveBtn.click();

    // TC-N02 Expected: inline error visible; no success toast.
    await expect(
      page.locator('text=/cannot be negative/i, text=/must be/i, [class*="red"]').first()
    ).toBeVisible({ timeout: 5_000 });

    // No success message should appear.
    await expect(page.locator('text=/saved successfully/i').first()).not.toBeVisible();

    // Leave the field in a valid state so subsequent tests see a clean page.
    await minValueInput.fill('20.00');
  });

  // ── TC-N02 (extra): max-saved-carts field bounds are surfaced in the UI ──
  test('TC-N02 (extra) — max saved carts below 1 shows validation error', async ({ page }) => {
    const input = page.getByTestId('cart-max-saved-carts-input');
    await expect(input).toBeVisible({ timeout: 10_000 });

    await input.fill('0');
    await page.locator('button:has-text("Save"), button:has-text("Save Settings")').first().click();

    await expect(
      page.locator('text=/between 1/i, [class*="red"]').first()
    ).toBeVisible({ timeout: 5_000 });

    // Restore.
    await input.fill('3');
  });
});
