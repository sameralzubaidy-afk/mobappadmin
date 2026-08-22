/**
 * Group L — Admin Listing Approval — REAL E2E (AUTH-TC-L01–L04)
 * File: p2p-kids-admin/__tests__/group-l-listing-approval.e2e.test.ts
 *
 * Replaces the placeholder scaffold with REAL assertions for AUTH-TC-L01–L04
 * (canonical guide: cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-
 * LISTING-DISCOVERY-MANUAL-TESTING.md, "Group L — Admin Review / Pending").
 * The four cases are authored as ONE CONNECTED CHAIN (serial describe): each
 * case depends on the previous case's resulting state, all anchored on a single
 * item — the seller's submitted listing.
 *
 * ── Surface split (Playwright vs. mobile) ──────────────────────────────────
 * The admin portal (this spec, Playwright) drives the RPC-backed `/listings`
 * approval flow and asserts DB state. The mobile app (iOS simulator via the
 * QA mobile-mcp toolset) supplies the seller-side actions Playwright cannot
 * drive:
 *
 *   L01  Seller submits an item (MOBILE — mobile-mcp) →
 *        THIS spec DB read-back: item exists, status='pending', buyer-invisible.
 *   L02  Admin approves via /listings (THIS spec, Playwright UI) →
 *        DB read-back: status='available', approved_at/approved_by set.
 *   L03  Seller notification (DB read-back in THIS spec: a user_notifications
 *        row type='listing_approved' with data.deep_link '/listing/<id>').
 *        The on-device NotificationCenter icon/tap verification (per
 *        deepLink.ts listing_approved → ListingDetail) is a MOBILE follow-on.
 *   L04  Seller edits the approved listing (MOBILE — mobile-mcp) →
 *        THIS spec DB read-back asserts tr_items_require_reapproval_on_seller_edit
 *        fired: status='pending', approved_at/approved_by cleared, buyer-invisible.
 *
 * ── Mobile preconditions (QA agent via mobile-mcp) ─────────────────────────
 *   (1) Before running this suite: submit ONE item as test-seller via the bulk
 *       create flow (dev fixtures allowed). The spec anchors on the seller's
 *       latest item (max created_at).
 *   (2) Between L03 and L04: edit that item's title or price as test-seller and
 *       save. L04 asserts the resulting DB state; if the edit has not happened
 *       yet, it self-skips with a clear reason (prerequisite missing).
 *
 * ── Run ────────────────────────────────────────────────────────────────────
 *   From p2p-kids-admin/ (admin portal must be running on :3001):
 *     PLAYWRIGHT_ADMIN_E2E=true \
 *     ADMIN_E2E_EMAIL=<admin-qa email> ADMIN_E2E_PASSWORD=<admin-qa password> \
 *     npm run test:playwright -- --grep "Group L"
 *   Admin credentials come from the QA registry (/memories/repo/qa-test-accounts.md)
 *   — never invent them. DB read-backs use the service-role client from
 *   p2p-kids-admin/.env.local (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY),
 *   loaded by this spec via dotenv.
 *
 * ── Locators (verified against src/app/components/ListingSearch.tsx) ────────
 *   listings-status-select, listings-seller-email-input, btn-listings-search,
 *   listings-row-<id>, btn-approve-<id>, listings-reason-input, btn-confirm-action.
 *   The approve RPC result is surfaced via window.alert() → Playwright
 *   page.on('dialog') accept (per locator-conventions.md §Option B).
 *
 * ── Backend contracts verified live on staging (read-only) ─────────────────
 *   - admin_approve_listing(p_listing_id, p_admin_user_id, p_reason) — SECURITY
 *     DEFINER; emits a preference-aware `listing_approved` notification with
 *     data.deep_link = '/listing/<id>' (migration 20260425000001). It refuses
 *     flagged/in-review images (MODERATION_BLOCKED_FLAGGED / MODERATION_IN_PROGRESS).
 *   - tr_items_require_reapproval_on_seller_edit — BEFORE UPDATE on items; on an
 *     authenticated seller edit of an `available` listing it reverts status to
 *     'pending' and clears approved_at/approved_by.
 *   - Buyer-feed visibility predicate = status='available' (search_listings).
 */

import { test, expect, Page } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load the admin app's local env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// for read-only DB read-backs). `.env.local` is git-ignored and never committed.
const ENV_LOCAL =
  typeof __dirname !== 'undefined'
    ? path.resolve(__dirname, '..', '.env.local')
    : path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: ENV_LOCAL });

const PLAYWRIGHT_ADMIN_E2E = process.env.PLAYWRIGHT_ADMIN_E2E === 'true';

// Accept both the spec-file convention (ADMIN_E2E_*) and the runner/env
// convention (PLAYWRIGHT_ADMIN_*) so the run works regardless of which var set
// is populated.
const ADMIN_E2E_EMAIL =
  process.env.ADMIN_E2E_EMAIL || process.env.PLAYWRIGHT_ADMIN_EMAIL;
const ADMIN_E2E_PASSWORD =
  process.env.ADMIN_E2E_PASSWORD || process.env.PLAYWRIGHT_ADMIN_PASSWORD;

// Standing staging personas (QA registry /memories/repo/qa-test-accounts.md).
// Overridable via env if a different persona pair is seeded.
const SELLER_EMAIL =
  process.env.GROUP_L_SELLER_EMAIL || 'test-seller@kidsmarketplace.test';
const BUYER_EMAIL =
  process.env.GROUP_L_BUYER_EMAIL || 'test-buyer@kidsmarketplace.test';

const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_READY = Boolean(NEXT_PUBLIC_SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

// ── Shared chain state (serial mode, single worker) ────────────────────────
let supabase: SupabaseClient;
let sellerId: string;
let buyerId: string;
let buyerNodeId: string | null;
let itemId: string;
let itemTitle: string;

// ── Read-only DB helpers (service-role client; no writes anywhere) ─────────

/**
 * Resolve email → user id via public.profiles (which carries the email column
 * and is service-role readable). NOTE: `auth.admin.listUsers` is NOT used here —
 * staging has ~5k auth users, so pagination (capped) cannot reliably surface a
 * seeded persona.
 */
async function resolveUserIdByEmail(email: string): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  if (error) {
    throw new Error(`profiles email lookup failed: ${error.message}`);
  }
  if (!data?.user_id) {
    throw new Error(`No profile found for email: ${email}`);
  }
  return data.user_id as string;
}

async function resolveNodeId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('node_id')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    throw new Error(`profiles read failed: ${error.message}`);
  }
  return (data?.node_id as string) ?? null;
}

async function findLatestItem(sellerIdToUse: string) {
  const { data, error } = await supabase
    .from('items')
    .select('id, title, price, status, approved_at, approved_by, created_at')
    .eq('seller_id', sellerIdToUse)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`items read failed: ${error.message}`);
  }
  return data;
}

async function getItem(id: string) {
  const { data, error } = await supabase
    .from('items')
    .select('id, title, price, status, approved_at, approved_by, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw new Error(`items read failed: ${error.message}`);
  }
  return data;
}

/**
 * Buyer-feed visibility mirror. search_listings() exposes an item only when
 * items.status = 'available' — a pending item never appears regardless of node.
 * This helper is the authoritative "is it visible to test-buyer" check.
 */
async function buyerVisibleCount(id: string): Promise<number> {
  const { count, error } = await supabase
    .from('items')
    .select('id', { count: 'exact', head: true })
    .eq('id', id)
    .eq('status', 'available');
  if (error) {
    throw new Error(`buyer-visible count failed: ${error.message}`);
  }
  return count ?? 0;
}

/** Corroborating check: run the exact feed RPC (node-scoped + title) and see if the item surfaces. */
async function isItemInBuyerNodeFeed(
  id: string,
  title: string,
  nodeId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('search_listings', {
    p_query: title,
    p_limit: 50,
    p_node_ids: [nodeId],
  });
  if (error) {
    throw new Error(`search_listings failed: ${error.message}`);
  }
  return (data ?? []).some((r: any) => r.id === id);
}

async function findApprovalNotification(sellerIdToUse: string, id: string) {
  const { data, error } = await supabase
    .from('user_notifications')
    .select('*')
    .eq('user_id', sellerIdToUse)
    .eq('type', 'listing_approved')
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) {
    throw new Error(`user_notifications read failed: ${error.message}`);
  }
  return (
    (data ?? []).find(
      (n: any) => String(n.data?.listing_id) === id || String(n.data?.item_id) === id
    ) ?? null
  );
}

/**
 * Ensure the Playwright page has an authenticated admin session.
 * Navigates to a protected route; if the app redirects to /auth/login, fills
 * the login form and submits. Self-skips when no credentials are configured.
 * (Mirrors the convention in `__tests__/admin-payouts-earnings.e2e.test.ts`.)
 */
async function ensureAdminSession(page: Page) {
  await page.goto('/listings');

  // The admin app guards pages CLIENT-SIDE (ProtectedLayout / AdminShell call
  // supabase.auth.getUser() on mount and router.push('/auth/login') when there
  // is no session). page.goto() resolves before that async redirect fires, so
  // checking page.url() immediately after goto() races the redirect (the url is
  // still '/listings' for ~100–500ms). Instead, WAIT for the redirect decision.
  let onLoginPage = true;
  try {
    await page.waitForURL('**/auth/login**', { timeout: 10_000 });
  } catch {
    onLoginPage = false; // never redirected → already authenticated
  }

  if (onLoginPage) {
    if (!ADMIN_E2E_EMAIL || !ADMIN_E2E_PASSWORD) {
      test.skip(
        true,
        'Set ADMIN_E2E_EMAIL/ADMIN_E2E_PASSWORD (or PLAYWRIGHT_ADMIN_*) for authenticated E2E runs.'
      );
    }

    const emailInput = page
      .locator('input[type="email"], input[name="email"]')
      .first();
    const passwordInput = page
      .locator('input[type="password"], input[name="password"]')
      .first();
    const submitButton = page
      .locator(
        'button[type="submit"], button:has-text("Sign in"), button:has-text("Login")'
      )
      .first();

    await emailInput.fill(ADMIN_E2E_EMAIL!);
    await passwordInput.fill(ADMIN_E2E_PASSWORD!);
    await submitButton.click();

    // A successful login navigates to '/' (login page: router.push('/') after
    // the RBAC admin check). Wait for navigation away from /auth/login — this
    // also surfaces a bad-credential login as a clear timeout instead of the
    // earlier silent skip. (Avoid waitForLoadState('networkidle'): on a Next.js
    // dev server it can hang on HMR websocket traffic.)
    await page.waitForURL((url) => !url.pathname.startsWith('/auth/login'), {
      timeout: 20_000,
    });
  }

  await page.goto('/listings');
  await page.waitForSelector('[data-testid="listings-status-select"]', {
    timeout: 20_000,
  });
}

test.describe.configure({ mode: 'serial' });

test.describe('Group L — Admin Listing Approval (AUTH-TC-L01–L04)', () => {
  test.skip(
    !PLAYWRIGHT_ADMIN_E2E,
    'Set PLAYWRIGHT_ADMIN_E2E=true to run admin UI Playwright tests.'
  );
  test.skip(
    !DB_READY,
    'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — load p2p-kids-admin/.env.local (or set them) for the DB read-backs.'
  );

  test.beforeAll(async () => {
    if (!DB_READY) {
      return;
    }
    supabase = createClient(NEXT_PUBLIC_SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    sellerId = await resolveUserIdByEmail(SELLER_EMAIL);
    buyerId = await resolveUserIdByEmail(BUYER_EMAIL);
    buyerNodeId = await resolveNodeId(buyerId);

    // Anchor the chain on the seller's most recent item (mobile precondition).
    const latest = await findLatestItem(sellerId);
    if (latest) {
      itemId = latest.id;
      itemTitle = latest.title;
      console.log(
        `[Group L] anchor item ${latest.id} ("${latest.title}") status=${latest.status}`
      );
      if (latest.status !== 'pending') {
        console.log(
          '[Group L] WARNING: anchor item is not pending — mobile submission precondition ' +
            'appears unmet. Submit a FRESH item as test-seller before running L01–L03.'
        );
      }
    }
    console.log(
      `[Group L] seller=${sellerId} buyer=${buyerId} node=${buyerNodeId} anchorItem=${itemId || '(none)'}`
    );
  });

  // ── AUTH-TC-L01 · New listing not visible until approved ─────────────────
  test('L01 — new listing is not visible until approved', async () => {
    expect(itemId, 'no seller item found — submit one via mobile first').toBeTruthy();

    const item = await getItem(itemId);

    // Seller side: the item exists and is pending/under review (My Items shows it).
    expect(item.status, 'item status').toBe('pending');
    expect(item.approved_at, 'approved_at while pending').toBeNull();
    expect(item.approved_by, 'approved_by while pending').toBeNull();

    // Buyer side: not visible in the node feed.
    expect(await buyerVisibleCount(itemId), 'buyer-visible count').toBe(0);
    expect(await isItemInBuyerNodeFeed(itemId, item.title, buyerNodeId!)).toBe(false);
  });

  // ── AUTH-TC-L02 · Admin approves → item becomes visible ──────────────────
  test('L02 — admin approves via /listings → item becomes available', async ({
    page,
  }) => {
    expect(itemId, 'no seller item found — submit one via mobile first').toBeTruthy();

    await ensureAdminSession(page);
    await page.goto('/listings');

    // Filter the RPC-backed queue to Pending and narrow to the seller's item.
    await page.selectOption('[data-testid="listings-status-select"]', 'pending');
    await page.fill('[data-testid="listings-seller-email-input"]', SELLER_EMAIL);
    await page.click('[data-testid="btn-listings-search"]');

    const row = page.locator(`[data-testid="listings-row-${itemId}"]`);
    await expect(row).toBeVisible({ timeout: 20000 });

    // Best-effort moderation-gate pre-check (read-only) — the RPC refuses
    // flagged/in-review images. The alert + DB read-back are the source of truth.
    const { data: gate } = await supabase.rpc('get_listing_moderation_gate', {
      p_listing_id: itemId,
    });
    console.log('[L02] moderation gate:', JSON.stringify(gate));

    // Open the details modal (row onClick opens it) and start approval.
    await row.click();
    await expect(page.getByTestId('listings-details-modal')).toBeVisible();
    await expect(page.getByTestId(`btn-approve-${itemId}`)).toBeVisible();
    await page.getByTestId(`btn-approve-${itemId}`).click();

    // Confirm Approval (reason optional for approve).
    const confirmBtn = page.getByTestId('btn-confirm-action');
    await expect(confirmBtn).toBeVisible();
    await expect(confirmBtn).toBeEnabled();

    // The RPC result surfaces via window.alert() → register handler first.
    let dialogMessage = '';
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await confirmBtn.click();

    // Wait for the alert to fire, then the queue refreshes.
    await expect
      .poll(async () => dialogMessage, { timeout: 20000 })
      .not.toBe('');
    console.log('[L02] approval alert:', dialogMessage);

    // The approval must not have been refused (e.g. AI-moderation block).
    expect(dialogMessage, 'approval alert').not.toContain('Failed to approve');
    expect(dialogMessage, 'approval alert').not.toContain('Blocked by AI moderation');

    // The queue auto-refreshes after approval, but it is still filtered to
    // 'pending' — the approved item leaves that set, so it no longer appears in
    // this filter's list. Switch the filter to 'active' (Available) and re-search.
    // The 100ms auto-refresh (with the stale 'pending' filter) can land AFTER our
    // search and clobber the results with an empty set, so poll-and-re-search
    // until the row actually reflects the approved status.
    await page.selectOption('[data-testid="listings-status-select"]', 'active');
    await expect
      .poll(
        async () => {
          await page.click('[data-testid="btn-listings-search"]');
          await page.waitForTimeout(600);
          return row.getByText(/available/i).isVisible().catch(() => false);
        },
        { timeout: 20000, intervals: [800, 1200, 2000] }
      )
      .toBe(true);

    // Authoritative DB read-back.
    const item = await getItem(itemId);
    expect(item.status, 'item status after approval').toBe('available');
    expect(item.approved_at, 'approved_at set').not.toBeNull();
    expect(item.approved_by, 'approved_by set').not.toBeNull();

    // Buyer side: now visible in the node feed.
    expect(await buyerVisibleCount(itemId), 'buyer-visible count').toBe(1);
    expect(await isItemInBuyerNodeFeed(itemId, item.title, buyerNodeId!)).toBe(true);
  });

  // ── AUTH-TC-L03 · Seller receives approval notification ──────────────────
  test('L03 — seller receives a listing_approved notification with deep link', async () => {
    expect(itemId, 'L02 must pass first').toBeTruthy();

    const notif = await findApprovalNotification(sellerId, itemId);
    expect(notif, 'user_notifications row (listing_approved) missing for seller').not.toBeNull();

    expect(notif.type, 'notification type').toBe('listing_approved');
    expect(notif.category, 'notification category').toBe('system');
    expect(String(notif.data?.listing_id), 'data.listing_id').toBe(itemId);
    expect(String(notif.data?.item_id), 'data.item_id').toBe(itemId);
    expect(notif.data?.deep_link, 'data.deep_link').toBe(`/listing/${itemId}`);
    expect(notif.data?.type, 'data.type').toBe('listing_approved');

    // On-device follow-on (mobile-mcp): NotificationCenter shows the Tag icon +
    // green badge for listing_approved (NotificationCenterScreen.tsx), and
    // tapping deep-links to ListingDetail per deepLink.ts listing_approved →
    // ListingDetail + '/listing/<id>' → ListingDetail.
  });

  // ── AUTH-TC-L04 · Editing an approved listing returns to pending ─────────
  test('L04 — editing the approved listing returns it to pending', async () => {
    expect(itemId, 'L02 must pass first').toBeTruthy();

    // Precondition: the seller edits the approved item via the mobile app
    // (mobile-mcp) BEFORE this test — Playwright cannot drive the simulator.
    const item = await getItem(itemId);
    if (item.status === 'available') {
      test.skip(
        true,
        'L04 precondition not met: seller edit not yet performed via mobile. ' +
          `Edit item ${itemId} (title or price) as test-seller and save, then re-run this test.`
      );
    }

    // tr_items_require_reapproval_on_seller_edit fired:
    expect(item.status, 'item status after seller edit').toBe('pending');
    expect(item.approved_at, 'approved_at cleared').toBeNull();
    expect(item.approved_by, 'approved_by cleared').toBeNull();

    // Buyer feed again excludes it until re-approved.
    expect(await buyerVisibleCount(itemId), 'buyer-visible count').toBe(0);
    expect(await isItemInBuyerNodeFeed(itemId, item.title, buyerNodeId!)).toBe(false);
  });
});
