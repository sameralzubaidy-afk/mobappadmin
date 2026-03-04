// filepath: p2p-kids-admin/src/__tests__/api/admin/subscriptions.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for subscription metrics calculation
 * These tests verify the business logic for MRR, churn rate, and other key metrics
 */

describe('Subscription Metrics Calculation', () => {
  const mockTierMap = {
    'tier-1': {
      id: 'tier-1',
      display_name: 'Kids Club+',
      price_cents: 499,
      stripe_price_id: 'price_test',
    },
  };

  const resolveSubscriptionPrice = (row: any, tierMap: Record<string, any>): number | null => {
    if (row.monthly_price_cents != null) {
      return row.monthly_price_cents;
    }
    if (row.last_payment_amount != null) {
      return row.last_payment_amount;
    }
    if (row.tier_id && tierMap[row.tier_id]) {
      return tierMap[row.tier_id].price_cents;
    }
    return null;
  };

  const calculateMetrics = (subscriptions: any[], tierMap: Record<string, any> = {}) => {
    const activeStatuses = ['trial', 'active'];
    const activeOnly = subscriptions.filter(s => s.status === 'active');
    const trialOnly = subscriptions.filter(s => s.status === 'trial');
    const graceOnly = subscriptions.filter(s => s.status === 'grace_period');
    const expiredOnly = subscriptions.filter(s => s.status === 'expired');
    const cancelledOnly = subscriptions.filter(s => s.cancelled_at !== null);
    const allActive = subscriptions.filter(s => activeStatuses.includes(s.status));

    const mrr = activeOnly.reduce((sum, s) => sum + (resolveSubscriptionPrice(s, tierMap) ?? 0), 0);

    const totalChurned = subscriptions.filter(
      (s) => s.status === 'expired' || s.cancelled_at !== null
    ).length;
    const churnRate = subscriptions.length > 0 
      ? (totalChurned / subscriptions.length) * 100 
      : 0;

    const graceToResubscribeRate = 0; // TODO: Implement with historical tracking

    return {
      totalSubscribers: allActive.length,
      activeSubscribers: activeOnly.length,
      trialUsers: trialOnly.length,
      gracePeriodUsers: graceOnly.length,
      expiredUsers: expiredOnly.length,
      cancelledUsers: cancelledOnly.length,
      mrr,
      churnRate: Math.round(churnRate * 10) / 10,
      graceToResubscribeRate,
    };
  };

  it('calculates MRR correctly for active subscriptions', () => {
    const subscriptions = [
      { status: 'active', monthly_price_cents: 499, tier_id: 'tier-1' },
      { status: 'active', monthly_price_cents: 499, tier_id: 'tier-1' },
      { status: 'trial', monthly_price_cents: 0, tier_id: 'tier-1' },
      { status: 'grace_period', monthly_price_cents: 499, tier_id: 'tier-1' },
    ];

    const metrics = calculateMetrics(subscriptions, mockTierMap);
    
    expect(metrics.mrr).toBe(998); // Only active subs: 2 * 499
    expect(metrics.activeSubscribers).toBe(2);
    expect(metrics.trialUsers).toBe(1);
    expect(metrics.gracePeriodUsers).toBe(1);
  });

  it('calculates churn rate correctly', () => {
    const subscriptions = [
      { status: 'active', cancelled_at: null },
      { status: 'cancelled', cancelled_at: '2024-01-01' },
      { status: 'expired', cancelled_at: '2024-01-01' },
      { status: 'trial', cancelled_at: null },
    ];

    const metrics = calculateMetrics(subscriptions, mockTierMap);
    
    // Total churned = 2 (cancelled + expired)
    // Churn rate = 2 / 4 * 100 = 50%
    expect(metrics.churnRate).toBe(50.0);
    expect(metrics.cancelledUsers).toBe(2);
  });

  it('handles empty subscription list', () => {
    const metrics = calculateMetrics([], mockTierMap);
    
    expect(metrics.mrr).toBe(0);
    expect(metrics.activeSubscribers).toBe(0);
    expect(metrics.churnRate).toBe(0);
  });

  it('resolves subscription price correctly from multiple sources', () => {
    // Priority: monthly_price_cents > last_payment_amount > tier price
    
    const sub1 = { monthly_price_cents: 599, last_payment_amount: 499, tier_id: 'tier-1' };
    expect(resolveSubscriptionPrice(sub1, mockTierMap)).toBe(599);

    const sub2 = { last_payment_amount: 499, tier_id: 'tier-1' };
    expect(resolveSubscriptionPrice(sub2, mockTierMap)).toBe(499);

    const sub3 = { tier_id: 'tier-1' };
    expect(resolveSubscriptionPrice(sub3, mockTierMap)).toBe(499);

    const sub4 = { tier_id: 'unknown' };
    expect(resolveSubscriptionPrice(sub4, mockTierMap)).toBeNull();
  });

  it('counts grace period users correctly', () => {
    const subscriptions = [
      { status: 'grace_period', cancelled_at: '2024-01-01' },
      { status: 'grace_period', cancelled_at: '2024-01-02' },
      { status: 'active', cancelled_at: null },
    ];

    const metrics = calculateMetrics(subscriptions, mockTierMap);
    
    expect(metrics.gracePeriodUsers).toBe(2);
  });

  it('calculates total subscribers (trial + active) correctly', () => {
    const subscriptions = [
      { status: 'trial', cancelled_at: null },
      { status: 'trial', cancelled_at: null },
      { status: 'active', cancelled_at: null },
      { status: 'grace_period', cancelled_at: '2024-01-01' },
      { status: 'expired', cancelled_at: '2024-01-01' },
    ];

    const metrics = calculateMetrics(subscriptions, mockTierMap);
    
    expect(metrics.totalSubscribers).toBe(3); // 2 trial + 1 active
  });
});

describe('Admin Subscription Actions Validation', () => {
  it('validates extend trial parameters', () => {
    const isValidExtendTrialRequest = (days: any, status: string) => {
      if (status !== 'trial') {
        return { valid: false, error: 'Can only extend trial for users currently in trial status' };
      }
      if (!days || typeof days !== 'number' || days < 1 || days > 90) {
        return { valid: false, error: 'Days must be between 1 and 90' };
      }
      return { valid: true };
    };

    expect(isValidExtendTrialRequest(7, 'trial')).toEqual({ valid: true });
    expect(isValidExtendTrialRequest(0, 'trial').valid).toBe(false);
    expect(isValidExtendTrialRequest(91, 'trial').valid).toBe(false);
    expect(isValidExtendTrialRequest(7, 'active').valid).toBe(false);
  });

  it('validates reactivate action eligibility', () => {
    const canReactivate = (status: string) => {
      return ['cancelled', 'grace_period', 'expired', 'paused'].includes(status);
    };

    expect(canReactivate('cancelled')).toBe(true);
    expect(canReactivate('grace_period')).toBe(true);
    expect(canReactivate('expired')).toBe(true);
    expect(canReactivate('paused')).toBe(true);
    expect(canReactivate('active')).toBe(false);
    expect(canReactivate('trial')).toBe(false);
  });

  it('validates manual cancel eligibility', () => {
    const canCancel = (status: string) => {
      return ['active', 'trial'].includes(status);
    };

    expect(canCancel('active')).toBe(true);
    expect(canCancel('trial')).toBe(true);
    expect(canCancel('cancelled')).toBe(false);
    expect(canCancel('grace_period')).toBe(false);
  });
});
