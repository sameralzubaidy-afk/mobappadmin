// E2E Test: Revenue Analytics Dashboard
// filepath: p2p-kids-admin/src/__tests__/e2e/revenue-analytics.e2e.ts

/**
 * E2E Test for ADMIN-V2-005: Revenue & Analytics Dashboard
 * 
 * Prerequisites:
 * - Supabase database migration 20260325000000_admin_v2_005_revenue_analytics.sql applied
 * - At least one admin user exists in production database
 * - Some subscription and trade data exists for realistic metrics
 * 
 * Run with: RUN_SUPABASE_E2E=true npm run test:e2e
 */

describe('ADMIN-V2-005: Revenue Analytics Dashboard E2E', () => {
  const ADMIN_API_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:3001';
  const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
  const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;

  let authToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    if (!process.env.RUN_SUPABASE_E2E) {
      console.warn('⚠️  Skipping E2E test. Set RUN_SUPABASE_E2E=true to run against production Supabase.');
      return;
    }

    if (!TEST_ADMIN_EMAIL || !TEST_ADMIN_PASSWORD) {
      throw new Error('TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set for E2E tests');
    }

    // Authenticate as admin
    const authResponse = await fetch(`${ADMIN_API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_ADMIN_EMAIL,
        password: TEST_ADMIN_PASSWORD,
      }),
    });

    if (!authResponse.ok) {
      throw new Error(`Admin authentication failed: ${authResponse.statusText}`);
    }

    const authData = await authResponse.json();
    authToken = authData.access_token;
    adminUserId = authData.user.id;
  });

  describe('Revenue Metrics API', () => {
    it('should fetch revenue metrics successfully', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      const response = await fetch(`${ADMIN_API_URL}/api/admin/analytics/revenue`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.ok).toBe(true);
      const json = await response.json();

      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
      expect(json.data.revenue).toBeDefined();
      expect(json.data.engagement).toBeDefined();

      // Verify revenue metrics structure
      const { revenue } = json.data;
      expect(revenue.period).toBeDefined();
      expect(revenue.subscription_revenue).toBeDefined();
      expect(revenue.transaction_fee_revenue).toBeDefined();
      expect(revenue.totals).toBeDefined();

      // Verify subscription revenue fields
      expect(typeof revenue.subscription_revenue.active_subscribers).toBe('number');
      expect(typeof revenue.subscription_revenue.mrr).toBe('number');
      expect(typeof revenue.subscription_revenue.arr).toBe('number');
      expect(revenue.subscription_revenue.arr).toBe(revenue.subscription_revenue.mrr * 12);

      // Verify transaction fee revenue fields
      expect(typeof revenue.transaction_fee_revenue.total).toBe('number');
      expect(typeof revenue.transaction_fee_revenue.subscribers).toBe('number');
      expect(typeof revenue.transaction_fee_revenue.non_subscribers).toBe('number');

      // Verify totals
      expect(typeof revenue.totals.total_revenue).toBe('number');
      expect(typeof revenue.totals.total_users).toBe('number');
      expect(typeof revenue.totals.arpu).toBe('number');

      console.log('✓ Revenue metrics validated:', {
        mrr: revenue.subscription_revenue.mrr,
        active_subscribers: revenue.subscription_revenue.active_subscribers,
        total_revenue: revenue.totals.total_revenue,
      });
    });

    it('should respect date range parameters', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      const startDate = new Date('2026-01-01').toISOString();
      const endDate = new Date('2026-03-25').toISOString();

      const response = await fetch(
        `${ADMIN_API_URL}/api/admin/analytics/revenue?start_date=${startDate}&end_date=${endDate}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      expect(response.ok).toBe(true);
      const json = await response.json();

      expect(json.success).toBe(true);
      expect(json.data.revenue.period.start_date).toBeDefined();
      expect(json.data.revenue.period.end_date).toBeDefined();
    });
  });

  describe('Engagement Metrics API', () => {
    it('should fetch engagement metrics successfully', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      const response = await fetch(`${ADMIN_API_URL}/api/admin/analytics/revenue`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.ok).toBe(true);
      const json = await response.json();

      const { engagement } = json.data;
      expect(engagement).toBeDefined();

      // Verify engagement structure
      expect(engagement.date).toBeDefined();
      expect(engagement.daily).toBeDefined();
      expect(engagement.monthly).toBeDefined();
      expect(typeof engagement.dau_mau_ratio).toBe('number');

      // Verify daily metrics
      expect(typeof engagement.daily.total).toBe('number');
      expect(typeof engagement.daily.subscribers).toBe('number');
      expect(typeof engagement.daily.non_subscribers).toBe('number');
      expect(engagement.daily.total).toBe(
        engagement.daily.subscribers + engagement.daily.non_subscribers
      );

      // Verify monthly metrics
      expect(typeof engagement.monthly.total).toBe('number');
      expect(typeof engagement.monthly.subscribers).toBe('number');
      expect(typeof engagement.monthly.non_subscribers).toBe('number');
      expect(engagement.monthly.total).toBe(
        engagement.monthly.subscribers + engagement.monthly.non_subscribers
      );

      console.log('✓ Engagement metrics validated:', {
        dau: engagement.daily.total,
        mau: engagement.monthly.total,
        ratio: engagement.dau_mau_ratio,
      });
    });
  });

  describe('Time Series API', () => {
    it('should fetch revenue time series successfully', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      const response = await fetch(
        `${ADMIN_API_URL}/api/admin/analytics/revenue?include_time_series=true&interval=day`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      expect(response.ok).toBe(true);
      const json = await response.json();

      expect(json.success).toBe(true);
      expect(json.data.timeSeries).toBeDefined();
      expect(Array.isArray(json.data.timeSeries)).toBe(true);

      if (json.data.timeSeries.length > 0) {
        const point = json.data.timeSeries[0];
        expect(point.period).toBeDefined();
        expect(typeof point.transaction_fees).toBe('number');
        expect(typeof point.subscription_revenue).toBe('number');
        expect(typeof point.total_revenue).toBe('number');
        expect(point.total_revenue).toBe(point.transaction_fees + point.subscription_revenue);

        console.log('✓ Time series data validated:', {
          periods: json.data.timeSeries.length,
          sample: point,
        });
      }
    });

    it('should support different interval types', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      const intervals = ['day', 'week', 'month'];

      for (const interval of intervals) {
        const response = await fetch(
          `${ADMIN_API_URL}/api/admin/analytics/revenue?include_time_series=true&interval=${interval}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        expect(response.ok).toBe(true);
        const json = await response.json();
        expect(json.success).toBe(true);
        expect(Array.isArray(json.data.timeSeries)).toBe(true);

        console.log(`✓ ${interval} interval validated`);
      }
    });
  });

  describe('Authorization', () => {
    it('should reject requests without authentication', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      const response = await fetch(`${ADMIN_API_URL}/api/admin/analytics/revenue`);

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid token', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      const response = await fetch(`${ADMIN_API_URL}/api/admin/analytics/revenue`, {
        headers: {
          Authorization: 'Bearer invalid-token-12345',
        },
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });
  });

  describe('Performance', () => {
    it('should return metrics within 500ms', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      const startTime = Date.now();

      const response = await fetch(`${ADMIN_API_URL}/api/admin/analytics/revenue`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const duration = Date.now() - startTime;

      expect(response.ok).toBe(true);
      expect(duration).toBeLessThan(500);

      console.log(`✓ API response time: ${duration}ms`);
    });
  });
});
