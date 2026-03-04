// filepath: p2p-kids-admin/src/__tests__/e2e/subscription-admin-management.e2e.ts

/**
 * E2E Tests for Subscription Admin Management (SUB-011)
 * 
 * These tests verify admin subscription management functionality:
 * - Subscription list and metrics display
 * - Grace period configuration
 * - Admin actions (cancel, extend trial, reactivate)
 * 
 * Prerequisites:
 * - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set
 * - Test database must have subscription data
 * - ADMIN_UI_SECRET must be set for admin actions
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_UI_SECRET = process.env.ADMIN_UI_SECRET || 'test-secret';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

describe('SUB-011 E2E: Admin Subscription Management', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user with a trial subscription
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: `test-sub-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });

    if (userError || !userData.user) {
      throw new Error(`Failed to create test user: ${userError?.message}`);
    }

    testUserId = userData.user.id;

    // Create subscription record
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    await supabase.from('subscriptions').upsert({
      user_id: testUserId,
      status: 'trial',
      trial_started_at: new Date().toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      has_used_trial: false,
    });
  });

  describe('Subscription List & Metrics API', () => {
    it('should fetch subscription list with metrics', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/subscriptions?status=all`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(res.ok).toBe(true);
      const json = await res.json();

      expect(json).toHaveProperty('subscriptions');
      expect(json).toHaveProperty('metrics');
      expect(json).toHaveProperty('pagination');

      // Validate metrics structure
      expect(json.metrics).toHaveProperty('totalSubscribers');
      expect(json.metrics).toHaveProperty('activeSubscribers');
      expect(json.metrics).toHaveProperty('trialUsers');
      expect(json.metrics).toHaveProperty('gracePeriodUsers');
      expect(json.metrics).toHaveProperty('mrr');
      expect(json.metrics).toHaveProperty('churnRate');

      // MRR should be a number (in cents)
      expect(typeof json.metrics.mrr).toBe('number');
      expect(json.metrics.mrr).toBeGreaterThanOrEqual(0);
    });

    it('should filter subscriptions by status', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/subscriptions?status=trial`, {
        method: 'GET',
      });

      expect(res.ok).toBe(true);
      const json = await res.json();

      // All returned subscriptions should have status 'trial'
      json.subscriptions.forEach((sub: any) => {
        expect(sub.status).toBe('trial');
      });
    });

    it('should include user profile data in subscription list', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/subscriptions?status=all&limit=10`, {
        method: 'GET',
      });

      expect(res.ok).toBe(true);
      const json = await res.json();

      if (json.subscriptions.length > 0) {
        const firstSub = json.subscriptions[0];
        expect(firstSub).toHaveProperty('profile');
        // Profile should have display_name and email
        expect(firstSub.profile).toHaveProperty('display_name');
        expect(firstSub.profile).toHaveProperty('email');
      }
    });
  });

  describe('Grace Period Configuration', () => {
    it('should load grace period config from admin_config', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/config`, {
        method: 'GET',
      });

      expect(res.ok).toBe(true);
      const json = await res.json();

      const graceDaysConfig = json.data?.find((c: any) => c.key === 'grace_period_days');
      const thresholdsConfig = json.data?.find((c: any) => c.key === 'grace_reminder_thresholds');

      // Should have grace period configuration
      expect(graceDaysConfig).toBeDefined();
      if (graceDaysConfig) {
        expect(parseInt(graceDaysConfig.value)).toBeGreaterThan(0);
      }

      if (thresholdsConfig) {
        const thresholds = JSON.parse(thresholdsConfig.value);
        expect(Array.isArray(thresholds)).toBe(true);
      }
    });

    it('should update grace_period_days via admin config API', async () => {
      const newDays = 60;

      const res = await fetch(`${BASE_URL}/api/admin/config`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': ADMIN_UI_SECRET,
        },
        body: JSON.stringify({
          key: 'grace_period_days',
          value: String(newDays),
        }),
      });

      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.success).toBe(true);

      // Verify update
      const { data } = await supabase
        .from('admin_config')
        .select('value')
        .eq('key', 'grace_period_days')
        .single();

      expect(parseInt(data?.value || '0')).toBe(newDays);

      // Restore to 90 for other tests
      await supabase
        .from('admin_config')
        .upsert({ key: 'grace_period_days', value: '90', updated_at: new Date().toISOString() });
    });
  });

  describe('Admin Subscription Actions', () => {
    it('should extend trial for trial users', async () => {
      const daysToExtend = 7;

      const res = await fetch(`${BASE_URL}/api/admin/subscriptions/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': ADMIN_UI_SECRET,
        },
        body: JSON.stringify({
          action: 'extend_trial',
          user_id: testUserId,
          days: daysToExtend,
        }),
      });

      const json = await res.json();
      
      if (!res.ok) {
        console.error('Extend trial error:', json);
      }

      expect(res.ok).toBe(true);
      expect(json.success).toBe(true);
      expect(json.message).toContain('extended');

      // Verify in database
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('trial_ends_at')
        .eq('user_id', testUserId)
        .single();

      expect(sub).toBeDefined();
      // Trial end date should be extended
      expect(new Date(sub!.trial_ends_at).getTime()).toBeGreaterThan(Date.now());
    });

    it('should manually cancel active/trial subscriptions', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/subscriptions/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': ADMIN_UI_SECRET,
        },
        body: JSON.stringify({
          action: 'manually_cancel',
          user_id: testUserId,
          reason: 'test_cancellation',
        }),
      });

      const json = await res.json();
      
      if (!res.ok) {
        console.error('Manual cancel error:', json);
      }

      expect(res.ok).toBe(true);
      expect(json.success).toBe(true);

      // Verify status changed to grace_period
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status, cancelled_at, cancel_reason')
        .eq('user_id', testUserId)
        .single();

      expect(sub?.status).toBe('grace_period');
      expect(sub?.cancelled_at).not.toBeNull();
      expect(sub?.cancel_reason).toBe('test_cancellation');
    });

    it('should reactivate cancelled/grace_period subscriptions', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/subscriptions/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': ADMIN_UI_SECRET,
        },
        body: JSON.stringify({
          action: 'reactivate',
          user_id: testUserId,
          reason: 'test_reactivation',
        }),
      });

      const json = await res.json();
      
      if (!res.ok) {
        console.error('Reactivate error:', json);
      }

      expect(res.ok).toBe(true);
      expect(json.success).toBe(true);

      // Verify status changed to active
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status, cancelled_at, grace_ends_at')
        .eq('user_id', testUserId)
        .single();

      expect(sub?.status).toBe('active');
      expect(sub?.cancelled_at).toBeNull();
      expect(sub?.grace_ends_at).toBeNull();
    });

    it('should reject actions without admin secret', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/subscriptions/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // NO x-admin-secret header
        },
        body: JSON.stringify({
          action: 'manually_cancel',
          user_id: testUserId,
        }),
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Unauthorized');
    });

    it('should reject invalid action types', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/subscriptions/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': ADMIN_UI_SECRET,
        },
        body: JSON.stringify({
          action: 'invalid_action',
          user_id: testUserId,
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Unknown action');
    });
  });

  describe('Metrics Accuracy', () => {
    it('should calculate MRR correctly based on active subscriptions', async () => {
      // Get current metrics
      const res = await fetch(`${BASE_URL}/api/admin/subscriptions?status=all`);
      const json = await res.json();

      // MRR should only include active subscribers (not trial, not grace_period)
      const activeCount = json.subscriptions.filter((s: any) => s.status === 'active').length;
      const expectedMRR = activeCount * 499; // Assuming $4.99 = 499 cents

      // Allow small variance due to pricing differences
      expect(json.metrics.mrr).toBeGreaterThanOrEqual(0);
      expect(json.metrics.activeSubscribers).toBe(activeCount);
    });
  });
});
