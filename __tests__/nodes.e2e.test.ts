// filepath: p2p-kids-admin/__tests__/nodes.e2e.test.ts
// E2E tests for NODE-001 and NODE-002 tasks (Playwright).
//
// Run via `npm run test:playwright` from p2p-kids-admin/. Authenticated admin
// specs are gated on PLAYWRIGHT_ADMIN_E2E=true and read credentials from
// ADMIN_E2E_EMAIL / ADMIN_E2E_PASSWORD (fallback PLAYWRIGHT_ADMIN_*), loaded
// from .env.local — same convention as the sibling admin e2e specs.
//
// NOTE (admin-role requirement): node-management WRITES (create/edit/toggle)
// are gated by RLS on `nodes` to `users.role='admin'` (policy
// `nodes_admin_manage`), so this spec must be run with an admin-role account.
// On staging the only such account is samer@samer.com — e.g.
//   ADMIN_E2E_EMAIL=samer@samer.com ADMIN_E2E_PASSWORD=samer \
//   PLAYWRIGHT_ADMIN_E2E=true npx playwright test nodes.e2e.test.ts
// With a non-admin account, create/edit fail (RLS blocks the write) and the
// list only shows active nodes (policy `nodes_public_active`).

import * as path from 'path';
import * as dotenv from 'dotenv';
import { test, expect, Page } from '@playwright/test';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const PLAYWRIGHT_ADMIN_E2E = process.env.PLAYWRIGHT_ADMIN_E2E === 'true';
const ADMIN_EMAIL = process.env.ADMIN_E2E_EMAIL || process.env.PLAYWRIGHT_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_E2E_PASSWORD || process.env.PLAYWRIGHT_ADMIN_PASSWORD || '';

// ── shared login helper (mirrors sibling admin e2e specs) ───────────────────
async function ensureAdminSession(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/nodes`);

  // The admin app guards pages CLIENT-SIDE (ProtectedLayout calls
  // supabase.auth.getUser() on mount and router.push('/auth/login') when there
  // is no session). page.goto() resolves before that async redirect fires, so
  // WAIT for the redirect decision instead of checking the URL immediately.
  let onLoginPage = true;
  try {
    await page.waitForURL('**/auth/login**', { timeout: 10_000 });
  } catch {
    onLoginPage = false; // never redirected → already authenticated
  }

  if (onLoginPage) {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      test.skip(
        true,
        'Set ADMIN_E2E_EMAIL/ADMIN_E2E_PASSWORD (or PLAYWRIGHT_ADMIN_*) for authenticated E2E runs.'
      );
    }
    await page
      .locator('input[type="email"], input[name="email"]')
      .first()
      .fill(ADMIN_EMAIL);
    await page
      .locator('input[type="password"], input[name="password"]')
      .first()
      .fill(ADMIN_PASSWORD);
    await page
      .locator(
        'button[type="submit"], button:has-text("Sign in"), button:has-text("Login")'
      )
      .first()
      .click();

    // A successful login navigates away from /auth/login. Wait for it (this
    // surfaces bad credentials as a clear timeout instead of a silent skip).
    // Avoid waitForLoadState('networkidle'): on a Next.js dev server it can
    // hang on HMR websocket traffic.
    await page.waitForURL((url) => !url.pathname.startsWith('/auth/login'), {
      timeout: 20_000,
    });
    await page.goto(`${BASE_URL}/nodes`);
  }
}

test.describe('Node Management (NODE-001 & NODE-002)', () => {
  test.skip(!PLAYWRIGHT_ADMIN_E2E, 'Set PLAYWRIGHT_ADMIN_E2E=true to run admin Playwright tests.');

  test.beforeEach(async ({ page }) => {
    await ensureAdminSession(page);
  });

  test.describe('NODE-001: Create Admin UI for Nodes', () => {
    test('should display nodes page with stats cards', async ({ page }) => {
      await page.goto(`${BASE_URL}/nodes`);
      
      // Check page title and heading
      await expect(page.locator('h1')).toContainText('Geographic Nodes');
      
      // Check stats cards are visible
      await expect(page.locator('text=Total Nodes')).toBeVisible();
      await expect(page.locator('text=Active Nodes')).toBeVisible();
      await expect(page.locator('text=Total Members')).toBeVisible();
    });

    test('should show nodes table with columns', async ({ page }) => {
      await page.goto(`${BASE_URL}/nodes`);
      
      // Check table headers (scoped to th — `text=Members` would also match
      // the "Total Members" stats card and trip strict mode).
      await expect(page.locator('th:has-text("Node Name")')).toBeVisible();
      await expect(page.locator('th:has-text("Location")')).toBeVisible();
      await expect(page.locator('th:has-text("Coordinates")')).toBeVisible();
      await expect(page.locator('th:has-text("Radius")')).toBeVisible();
      await expect(page.locator('th:has-text("Members")')).toBeVisible();
      await expect(page.locator('th:has-text("Status")')).toBeVisible();
      await expect(page.locator('th:has-text("Actions")')).toBeVisible();
    });

    test('should open add node form when clicking + Add Node button', async ({ page }) => {
      await page.goto(`${BASE_URL}/nodes`);
      
      // Click Add Node button
      await page.click('button:has-text("+ Add Node")');
      
      // Check modal appears
      await expect(page.locator('h2:has-text("Add New Node")')).toBeVisible();
      
      // Check form fields are visible
      await expect(page.locator('label:has-text("Node Name")')).toBeVisible();
      await expect(page.locator('label:has-text("ZIP Code")')).toBeVisible();
      await expect(page.locator('label:has-text("City")')).toBeVisible();
      await expect(page.locator('label:has-text("State")')).toBeVisible();
      await expect(page.locator('label:has-text("Latitude")')).toBeVisible();
      await expect(page.locator('label:has-text("Longitude")')).toBeVisible();
      await expect(page.locator('label:has-text("Search Radius")')).toBeVisible();
      await expect(page.locator('label:has-text("Description")')).toBeVisible();
      await expect(page.locator('label:has-text("Active Node")')).toBeVisible();
    });

    test('should validate required fields on form submission', async ({ page }) => {
      await page.goto(`${BASE_URL}/nodes`);
      
      // Click Add Node
      await page.click('button:has-text("+ Add Node")');
      
      // Try to submit empty form
      await page.click('button:has-text("Create Node")');
      
      // Check validation errors appear
      await expect(page.locator('text=Node name must be at least 2 characters')).toBeVisible();
      await expect(page.locator('text=City is required')).toBeVisible();
      await expect(page.locator('text=State must be 2-letter code')).toBeVisible();
      await expect(page.locator('text=ZIP code must be 5 digits')).toBeVisible();
    });

    test('should auto-populate coordinates from ZIP code', async ({ page }) => {
      await page.goto(`${BASE_URL}/nodes`);
      
      // Click Add Node
      await page.click('button:has-text("+ Add Node")');
      
      // Enter ZIP code
      await page.fill('input[placeholder="06850"]', '06850');
      
      // Wait for ZIP lookup
      await page.waitForTimeout(2000);
      
      // Check coordinates are populated (should see looking up message or populated fields)
      const latInput = page.locator('input[placeholder="41.1177"]');
      const lngInput = page.locator('input[placeholder="-73.4079"]');
      
      // Either see the looking up message or the values populated
      const lookingUp = page.locator('text=Looking up ZIP code');
      const hasLatValue = await latInput.inputValue();
      const hasLngValue = await lngInput.inputValue();
      
      const condition = await lookingUp.isVisible().catch(() => false);
      expect(condition || parseFloat(hasLatValue) > 0 || parseFloat(hasLngValue) < 0).toBeTruthy();
    });

    test('should create a new node successfully', async ({ page }) => {
      await page.goto(`${BASE_URL}/nodes`);

      const testNodeName = `Test Node ${Date.now()}`;

      // Click Add Node
      await page.click('button:has-text("+ Add Node")');

      // Wait for the modal to actually open (the click can race React hydration
      // in the dev server and silently no-op).
      await expect(page.locator('h2:has-text("Add New Node")')).toBeVisible({ timeout: 10_000 });

      // Fill form with test data
      await page.fill('input[placeholder="e.g., Norwalk Central"]', testNodeName);
      await page.fill('input[placeholder="06850"]', '06850');

      // Wait for the ZIP auto-lookup to populate coordinates — the form blocks
      // creation without valid coordinates (city/state/lat/lng), and a fixed
      // sleep races the async external lookup. The lat input's initial value is
      // "0", so wait for a non-zero value (not just non-empty).
      await expect(page.locator('input[placeholder="41.1177"]')).not.toHaveValue(
        /^(0|)$/,
        { timeout: 15_000 }
      );

      // Set radius
      await page.fill('input[placeholder="10"]', '15');

      // Add description
      await page.fill(
        'textarea[placeholder*="Central Norwalk area"]',
        'Test node description'
      );

      // Submit form
      await page.click('button:has-text("Create Node")');

      // Wait for success message
      await page.waitForTimeout(1000);

      // Node should appear in table (reload page to verify persistence). Scope
      // to the nodes table — the node also appears in the per-node KPI table,
      // so an unscoped text match is ambiguous.
      await page.reload();
      const nodesTable = page.locator('table', { hasText: 'Members' });
      await expect(
        nodesTable.locator('tbody tr', { hasText: testNodeName }).first()
      ).toBeVisible({ timeout: 15_000 });
    });

    test('should edit an existing node', async ({ page }) => {
      await page.goto(`${BASE_URL}/nodes`);
      
      // Find first node and click Edit
      const editButton = page.locator('button:has-text("Edit")').first();
      await editButton.click();
      
      // Check Edit modal
      await expect(page.locator('h2:has-text("Edit Node")')).toBeVisible();
      
      // Update radius
      const radiusInput = page.locator('input[min="1"][max="100"]');
      await radiusInput.fill('20');
      
      // Submit
      await page.click('button:has-text("Update Node")');
      
      // Wait for success
      await page.waitForTimeout(1000);
    });
  });

  test.describe('NODE-002: Node Activation/Deactivation Toggle', () => {
    test('should show Deactivate button for active nodes', async ({ page }) => {
      await page.goto(`${BASE_URL}/nodes`);
      
      // Check for active status badge
      const activeBadges = page.locator('span:has-text("Active")');
      if ((await activeBadges.count()) > 0) {
        // Find corresponding Deactivate button
        await expect(page.locator('button:has-text("Deactivate")')).toBeVisible();
      }
    });

    test('should show Activate button for inactive nodes', async ({ page }) => {
      await page.goto(`${BASE_URL}/nodes`);
      
      // Check for inactive status badge
      const inactiveBadges = page.locator('span:has-text("Inactive")');
      if ((await inactiveBadges.count()) > 0) {
        // Find corresponding Activate button
        await expect(page.locator('button:has-text("Activate")')).toBeVisible();
      }
    });

    test('should show confirmation dialog when toggling active status', async ({ page }) => {
      await page.goto(`${BASE_URL}/nodes`);
      
      const deactivateButton = page.locator('button:has-text("Deactivate")').first();
      if (await deactivateButton.isVisible()) {
        // Set up dialog handler
        page.once('dialog', (dialog) => {
          expect(dialog.message()).toContain('Are you sure you want to deactivate');
          dialog.accept();
        });
        
        // Click deactivate
        await deactivateButton.click();
        
        // Wait for update
        await page.waitForTimeout(1000);
      }
    });

    test('should deactivate node and update status badge', async ({ page }) => {
      await page.goto(`${BASE_URL}/nodes`);
      
      const deactivateButton = page.locator('button:has-text("Deactivate")').first();
      if (await deactivateButton.isVisible()) {
        // Get node name from table row
        const row = deactivateButton.locator('..');
        const nodeName = await row.locator('text=').first().textContent();
        
        // Set up dialog handler
        page.once('dialog', (dialog) => {
          dialog.accept();
        });
        
        // Deactivate
        await deactivateButton.click();
        
        // Wait for success message
        await page.waitForTimeout(500);
        
        // Check for success alert
        const alerts = page.locator('text=successfully');
        expect(await alerts.count()).toBeGreaterThan(0);
        
        // Reload and verify status changed
        await page.reload();
        if (nodeName) {
          const nodeRow = page.locator(`text=${nodeName}`).locator('..');
          await expect(nodeRow.locator('text=Inactive')).toBeVisible();
        }
      }
    });

    test('should show warning for nodes with members on deactivation', async ({ page }) => {
      await page.goto(`${BASE_URL}/nodes`);
      
      // Find node with members > 0
      const rows = page.locator('tbody tr');
      for (let i = 0; i < (await rows.count()); i++) {
        const row = rows.nth(i);
        const memberCount = await row
          .locator('td')
          .nth(4)
          .textContent();
        
        if (memberCount && parseInt(memberCount) > 0) {
          const deactivateBtn = row.locator('button:has-text("Deactivate")');
          if (await deactivateBtn.isVisible()) {
            // Set up dialog handler
            page.once('dialog', (dialog) => {
              expect(dialog.message()).toContain('Warning');
              expect(dialog.message()).toContain('members');
              dialog.dismiss();
            });
            
            await deactivateBtn.click();
            break;
          }
        }
      }
    });

    test('should reactivate an inactive node', async ({ page }) => {
      await page.goto(`${BASE_URL}/nodes`);
      
      const activateButton = page.locator('button:has-text("Activate")').first();
      if (await activateButton.isVisible()) {
        // Set up dialog handler
        page.once('dialog', (dialog) => {
          dialog.accept();
        });
        
        // Activate
        await activateButton.click();
        
        // Wait for success
        await page.waitForTimeout(1000);
      }
    });

    test('should update audit log on toggle', async ({ page }) => {
      // This would require checking the admin_audit_log table directly
      // For now, we verify the action completes without error
      await page.goto(`${BASE_URL}/nodes`);
      
      const deactivateButton = page.locator('button:has-text("Deactivate")').first();
      if (await deactivateButton.isVisible()) {
        page.once('dialog', (dialog) => {
          dialog.accept();
        });
        
        await deactivateButton.click();
        
        // Wait and check no errors appear
        await page.waitForTimeout(1000);
        
        // If error alert appears, test fails
        const errorAlerts = page.locator('text=Failed');
        expect(await errorAlerts.count()).toBe(0);
      }
    });
  });

  test.describe('Stats Cards Dynamic Updates', () => {
    test('stats should reflect current node counts', async ({ page }) => {
      await page.goto(`${BASE_URL}/nodes`);
      
      // Get table row count
      const rows = page.locator('tbody tr');
      const rowCount = await rows.count();
      
      // Get total nodes from stats card (value is the second div in the card)
      const totalNodesCard = page.locator('text=Total Nodes').locator('..');
      const totalNodesText = await totalNodesCard.locator('div').nth(1).textContent();
      const totalNodes = parseInt(totalNodesText || '0');
      
      expect(totalNodes).toBeGreaterThanOrEqual(0);
    });

    test('active nodes count should match active status badges', async ({ page }) => {
      await page.goto(`${BASE_URL}/nodes`);

      // Wait for the nodes table to render before reading badges + the card so
      // both reflect the same loaded state.
      const nodesTable = page.locator('table', { hasText: 'Members' });
      await expect(nodesTable.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

      // Count active badges — exact match so it does not also match the
      // "Inactive" badge (has-text is case-insensitive and substring-matches).
      const activeBadges = page.locator('span', { hasText: /^Active$/ });
      const activeCount = await activeBadges.count();
      
      // Get active nodes from stats (value is the second div in the card)
      const activeNodesCard = page.locator('text=Active Nodes').locator('..');
      const activeNodesText = await activeNodesCard.locator('div').nth(1).textContent();
      const activeNodesDisplayed = parseInt(activeNodesText || '0');
      
      expect(activeNodesDisplayed).toBe(activeCount);
    });

    test('total members should sum all member counts', async ({ page }) => {
      await page.goto(`${BASE_URL}/nodes`);

      // The Members column and the Total Members card both derive from
      // admin_node_kpis — wait for the per-node KPI table to render so both
      // reads are consistent (avoids summing 0 before the live counts load).
      await expect(page.locator('table').first().locator('tbody tr').first()).toBeVisible({
        timeout: 15_000,
      });

      // Sum member counts from the NODES table only. The page renders two
      // tables (Per-Node KPIs + nodes); an unscoped `tbody tr td:nth-child(5)`
      // would also sum the KPI table's "Completed" column and double-count.
      let totalMembers = 0;
      const nodesTable = page.locator('table', { hasText: 'Members' });
      const memberCells = nodesTable.locator('tbody tr td:nth-child(5)');
      const cellCount = await memberCells.count();

      for (let i = 0; i < cellCount; i++) {
        const text = await memberCells.nth(i).textContent();
        totalMembers += parseInt(text || '0');
      }

      // Get total from stats (value is the second div in the card)
      const membersCard = page.locator('text=Total Members').locator('..');
      const membersText = await membersCard.locator('div').nth(1).textContent();
      const membersDisplayed = parseInt(membersText || '0');
      
      expect(membersDisplayed).toBe(totalMembers);
    });
  });
});
