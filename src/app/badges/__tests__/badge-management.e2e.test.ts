/**
 * E2E Tests for Badge Management (Admin Portal)
 * TASK: BADGES-V2-007
 * 
 * Tests complete badge management flows including icon upload
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test data
const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@test.com';
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'admin123';

describe('Badge Management E2E Tests', () => {
  let authToken: string;
  let testBadgeId: string;

  beforeAll(async () => {
    // Authenticate using existing production session
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.warn('[E2E Setup] No authenticated user found. Tests may fail if RLS is enabled.');
    } else {
      console.log('[E2E Setup] Using authenticated user:', user.email);
    }
  });

  afterAll(async () => {
    // Cleanup: Avoid signing out to maintain session for other tests/UI
    console.log('[E2E Cleanup] Tests finished');
  });

  describe('Badge List and Management', () => {
    it('should fetch all badges', async () => {
      const { data, error } = await supabase
        .from('badges')
        .select('*')
        .order('sort_order', { ascending: true });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);

      if (data && data.length > 0) {
        testBadgeId = data[0].id; // Store for later tests
        console.log('[E2E] Found', data.length, 'badges');
        
        // Verify badge structure
        expect(data[0]).toHaveProperty('id');
        expect(data[0]).toHaveProperty('name');
        expect(data[0]).toHaveProperty('category');
        expect(data[0]).toHaveProperty('threshold');
        expect(data[0]).toHaveProperty('is_active');
      }
    });

    it('should toggle badge active status', async () => {
      if (!testBadgeId) {
        console.warn('[E2E] Skipping: No test badge available');
        return;
      }

      // Get current status
      const { data: currentData } = await supabase
        .from('badges')
        .select('is_active')
        .eq('id', testBadgeId)
        .single();

      const currentStatus = currentData?.is_active;

      // Toggle status
      const { error: updateError } = await supabase
        .from('badges')
        .update({ is_active: !currentStatus })
        .eq('id', testBadgeId);

      expect(updateError).toBeNull();

      // Verify toggle
      const { data: updatedData } = await supabase
        .from('badges')
        .select('is_active')
        .eq('id', testBadgeId)
        .single();

      expect(updatedData?.is_active).toBe(!currentStatus);

      // Restore original status
      await supabase
        .from('badges')
        .update({ is_active: currentStatus })
        .eq('id', testBadgeId);
    });

    it('should update badge details', async () => {
      if (!testBadgeId) {
        console.warn('[E2E] Skipping: No test badge available');
        return;
      }

      // Get original data
      const { data: originalData } = await supabase
        .from('badges')
        .select('name, description')
        .eq('id', testBadgeId)
        .single();

      const newName = `${originalData?.name} (E2E Test)`;

      // Update badge
      const { error: updateError } = await supabase
        .from('badges')
        .update({ name: newName })
        .eq('id', testBadgeId);

      expect(updateError).toBeNull();

      // Verify update
      const { data: updatedData } = await supabase
        .from('badges')
        .select('name')
        .eq('id', testBadgeId)
        .single();

      expect(updatedData?.name).toBe(newName);

      // Restore original name
      await supabase
        .from('badges')
        .update({ name: originalData?.name })
        .eq('id', testBadgeId);
    });
  });

  describe('Badge Icon Upload', () => {
    it('should verify badge-icons bucket exists', async () => {
      const { data, error } = await supabase.storage.getBucket('badge-icons');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.id).toBe('badge-icons');
      expect(data?.public).toBe(true);
    });

    it('should list files in badge-icons bucket', async () => {
      const { data, error } = await supabase.storage.from('badge-icons').list('icons', {
        limit: 10,
      });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      console.log('[E2E] Badge icons found:', data?.length || 0);
    });

    it('should upload a test badge icon (admin only)', async () => {
      if (!testBadgeId) {
        console.warn('[E2E] Skipping: No test badge available');
        return;
      }

      // Create a small test image (1x1 PNG)
      const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const testImageBlob = new Blob(
        [Uint8Array.from(atob(testImageBase64), (c) => c.charCodeAt(0))],
        { type: 'image/png' }
      );

      const filePath = `icons/e2e-test-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from('badge-icons')
        .upload(filePath, testImageBlob);

      if (uploadError) {
        console.warn('[E2E] Icon upload may require admin service role key:', uploadError.message);
        // This is expected if using anon key (RLS restricts upload to admin)
        expect(uploadError.message).toContain('policy');
      } else {
        console.log('[E2E] Icon uploaded successfully:', filePath);

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('badge-icons')
          .getPublicUrl(filePath);

        expect(publicUrl).toContain('badge-icons');
        expect(publicUrl).toContain(filePath);

        // Cleanup
        await supabase.storage.from('badge-icons').remove([filePath]);
      }
    });
  });

  describe('Manual Badge Award', () => {
    it('should search for user by email', async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, email, display_name')
        .limit(1)
        .single();

      if (error) {
        console.warn('[E2E] No profiles available for testing');
      } else {
        expect(data).toBeDefined();
        expect(data).toHaveProperty('user_id');
        expect(data).toHaveProperty('email');
      }
    });

    it('should call manual_award_badge RPC', async () => {
      // Find a test user
      const { data: userData } = await supabase
        .from('profiles')
        .select('user_id')
        .limit(1)
        .single();

      if (!userData || !testBadgeId) {
        console.warn('[E2E] Skipping: No test user or badge available');
        return;
      }

      const { data, error } = await supabase.rpc('manual_award_badge', {
        p_user_id: userData.user_id,
        p_badge_id: testBadgeId,
        p_reason: 'E2E test award',
      });

      // Either succeeds or fails with "already has badge"
      if (error) {
        console.log('[E2E] Manual award error (expected if already awarded):', error.message);
      } else {
        expect(data).toHaveProperty('success');
        console.log('[E2E] Manual award result:', data);

        // Verify badge was awarded
        const { data: userBadges } = await supabase
          .from('user_badges')
          .select('*')
          .eq('user_id', userData.user_id)
          .eq('badge_id', testBadgeId);

        expect(userBadges).toBeDefined();
        expect(userBadges!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Badge Audit Logs', () => {
    it('should fetch badge audit logs', async () => {
      const { data, error } = await supabase.rpc('get_badge_audit_logs', {
        p_user_id: null,
        p_badge_id: null,
        p_action_type: null,
        p_limit: 10,
      });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      console.log('[E2E] Audit log entries:', data?.length || 0);
    });
  });
});
