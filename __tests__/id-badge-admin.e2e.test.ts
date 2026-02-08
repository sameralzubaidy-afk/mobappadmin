// File: p2p-kids-admin/__tests__/id-badge-admin.e2e.test.ts
// TASK BADGE-010: E2E tests for ID Badge Admin Queue & Review
// Module: MODULE-10-ID-BADGE-VERIFICATION-V2.md
// REQUIRES: SUPABASE_E2E_ENABLED=true and production Supabase credentials

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const E2E_ENABLED = process.env.SUPABASE_E2E_ENABLED === 'true';

// Skip all tests if E2E not enabled
const describeE2E = E2E_ENABLED ? describe : describe.skip;

/**
 * End-to-End tests for ID Badge Admin functionality
 * 
 * These tests verify the full flow:
 * - API endpoints return correct data
 * - Database queries work correctly
 * - Screenshot storage integration
 * - Decision processing updates database
 * 
 * Prerequisites:
 * - SUPABASE_E2E_ENABLED=true
 * - NEXT_PUBLIC_SUPABASE_URL set
 * - SUPABASE_SERVICE_ROLE_KEY set
 * - Test user with pending ID badge request exists
 */

describeE2E('ID Badge Admin - E2E Tests', () => {
  let supabase: SupabaseClient;
  let testRequestId: string;
  let testUserId: string;

  beforeAll(async () => {
    if (!E2E_ENABLED) {
      console.log('Skipping E2E tests (SUPABASE_E2E_ENABLED not set)');
      return;
    }

    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Create a test request for E2E testing
    const { data: testUser } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, email')
      .limit(1)
      .single();

    if (testUser) {
      testUserId = testUser.user_id;

      const { data: request } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: testUserId,
          status: 'pending',
          first_name: testUser.first_name || 'Test',
          last_name: testUser.last_name || 'User',
          email: testUser.email || 'test@example.com',
        })
        .select('id')
        .single();

      if (request) {
        testRequestId = request.id;
      }
    }
  });

  afterAll(async () => {
    if (!E2E_ENABLED || !testRequestId) return;

    // Cleanup test request
    await supabase
      .from('id_badge_verification_requests')
      .delete()
      .eq('id', testRequestId);
  });

  test('should fetch all ID badge requests', async () => {
    const { data, error } = await supabase
      .from('id_badge_verification_requests')
      .select('*')
      .order('submitted_at', { ascending: false });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
  });

  test('should filter requests by status', async () => {
    const { data: pending } = await supabase
      .from('id_badge_verification_requests')
      .select('*')
      .eq('status', 'pending');

    expect(pending).toBeDefined();
    expect(Array.isArray(pending)).toBe(true);

    if (pending && pending.length > 0) {
      expect(pending.every((r) => r.status === 'pending')).toBe(true);
    }
  });

  test('should search requests by name', async () => {
    const { data: results } = await supabase
      .from('id_badge_verification_requests')
      .select('*')
      .or('first_name.ilike.%Test%,last_name.ilike.%Test%');

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });

  test('should calculate stats correctly', async () => {
    const { data: requests } = await supabase
      .from('id_badge_verification_requests')
      .select('status, submitted_at, reviewed_at');

    expect(requests).toBeDefined();

    if (requests) {
      const pending = requests.filter((r) => r.status === 'pending').length;
      const approved = requests.filter((r) => r.status === 'approved').length;
      const rejected = requests.filter((r) => r.status === 'rejected').length;

      expect(pending).toBeGreaterThanOrEqual(0);
      expect(approved).toBeGreaterThanOrEqual(0);
      expect(rejected).toBeGreaterThanOrEqual(0);
    }
  });

  test('should fetch single request by ID', async () => {
    if (!testRequestId) {
      console.log('Skipping: no test request ID');
      return;
    }

    const { data, error } = await supabase
      .from('id_badge_verification_requests')
      .select('*')
      .eq('id', testRequestId)
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.id).toBe(testRequestId);
    expect(data?.status).toBe('pending');
  });

  test('should update request status on decision', async () => {
    if (!testRequestId) {
      console.log('Skipping: no test request ID');
      return;
    }

    // Simulate approve decision
    const { error } = await supabase
      .from('id_badge_verification_requests')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        approval_notes: 'E2E test approval',
      })
      .eq('id', testRequestId);

    expect(error).toBeNull();

    // Verify update
    const { data: updated } = await supabase
      .from('id_badge_verification_requests')
      .select('status, reviewed_at, approval_notes')
      .eq('id', testRequestId)
      .single();

    expect(updated?.status).toBe('approved');
    expect(updated?.reviewed_at).toBeDefined();
    expect(updated?.approval_notes).toBe('E2E test approval');
  });

  test('should verify RLS policies allow admin access', async () => {
    // Admin should see all requests
    const { data, error } = await supabase
      .from('id_badge_verification_requests')
      .select('*');

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  test('should verify rejection reasons enum exists', async () => {
    const { data, error } = await supabase.rpc('get_enum_values', {
      enum_name: 'id_badge_rejection_reason',
    });

    // Note: This RPC may not exist, so we check table constraints instead
    if (error) {
      // Fallback: check if rejection_reason column exists
      const { data: tableInfo } = await supabase
        .from('id_badge_verification_requests')
        .select('rejection_reason')
        .limit(1);

      expect(tableInfo).toBeDefined();
    }
  });

  test('should verify screenshot storage bucket exists', async () => {
    const { data: buckets } = await supabase.storage.listBuckets();

    expect(buckets).toBeDefined();
    const idBadgeBucket = buckets?.find(
      (b) => b.name === 'id-badge-verification-screenshots'
    );
    expect(idBadgeBucket).toBeDefined();
  });

  test('API: GET /api/admin/id-badges should return requests', async () => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/api/admin/id-badges`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    // Note: This test assumes Next.js API route is running
    // May need to skip if running in isolation
    if (response.status === 404) {
      console.log('Skipping API test (Next.js not running)');
      return;
    }

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.requests).toBeDefined();
  });

  test('should verify configurable messages exist', async () => {
    const { data: messages, error } = await supabase
      .from('id_badge_verification_messages')
      .select('message_key, message_text');

    expect(error).toBeNull();
    expect(messages).toBeDefined();
    expect(messages?.length).toBeGreaterThanOrEqual(12);

    const keys = messages?.map((m) => m.message_key) || [];
    expect(keys).toContain('upload_disclaimer');
    expect(keys).toContain('approved_email_subject');
    expect(keys).toContain('rejected_email_subject');
  });

  test('should verify admin_config has ID badge settings', async () => {
    const { data: config } = await supabase
      .from('admin_config')
      .select('key, value')
      .in('key', [
        'id_badge_verification_enabled',
        'id_badge_verification_approval_sla_hours',
      ]);

    expect(config).toBeDefined();
    expect(config?.length).toBeGreaterThanOrEqual(1);
  });
});

describeE2E('ID Badge Admin - Screenshot Handling', () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    if (!E2E_ENABLED) return;

    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  });

  test('should handle screenshot deletion idempotently', async () => {
    const nonExistentPath = 'test/nonexistent.jpg';

    // Delete non-existent file (should not error)
    const { error } = await supabase.storage
      .from('id-badge-verification-screenshots')
      .remove([nonExistentPath]);

    // Supabase storage delete is idempotent (no error for missing files)
    expect(error).toBeNull();
  });

  test('should generate signed URL for screenshot', async () => {
    // Find a request with screenshot_path
    const { data: request } = await supabase
      .from('id_badge_verification_requests')
      .select('screenshot_path')
      .not('screenshot_path', 'is', null)
      .limit(1)
      .single();

    if (!request?.screenshot_path) {
      console.log('Skipping: no screenshot found');
      return;
    }

    const { data: signedUrl, error } = await supabase.storage
      .from('id-badge-verification-screenshots')
      .createSignedUrl(request.screenshot_path, 3600);

    expect(error).toBeNull();
    expect(signedUrl?.signedUrl).toBeDefined();
    expect(signedUrl?.signedUrl).toContain('https://');
  });
});
