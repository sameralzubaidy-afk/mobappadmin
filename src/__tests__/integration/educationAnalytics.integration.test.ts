// FILE: p2p-kids-admin/src/__tests__/integration/educationAnalytics.integration.test.ts
// MODULE-18 V1 EDU-009: Integration tests for education analytics dashboard

/**
 * Integration test for education analytics dashboard
 * Requires Supabase connection and education_analytics table
 * Run with: RUN_SUPABASE_E2E=true npm run test:e2e
 */

import { getEducationAnalytics } from '../../lib/educationAnalyticsService';

const INTEGRATION_ENABLED = process.env.RUN_SUPABASE_E2E === 'true';

describe('Education Analytics Integration', () => {
  beforeAll(() => {
    if (!INTEGRATION_ENABLED) {
      console.log('⚠️  Skipping integration tests (RUN_SUPABASE_E2E not set)');
    }
  });

  it('should fetch analytics for 30-day range', async () => {
    if (!INTEGRATION_ENABLED) {
      console.log('Skipped: RUN_SUPABASE_E2E not set');
      return;
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const analytics = await getEducationAnalytics({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    // Verify structure
    expect(analytics).toHaveProperty('onboarding');
    expect(analytics).toHaveProperty('help');
    expect(analytics).toHaveProperty('calculator');

    // Verify onboarding structure
    expect(analytics.onboarding).toHaveProperty('started');
    expect(analytics.onboarding).toHaveProperty('completed');
    expect(analytics.onboarding).toHaveProperty('skipped');
    expect(analytics.onboarding).toHaveProperty('completionRate');

    // Verify types
    expect(typeof analytics.onboarding.started).toBe('number');
    expect(typeof analytics.onboarding.completed).toBe('number');
    expect(typeof analytics.onboarding.skipped).toBe('number');
    expect(typeof analytics.onboarding.completionRate).toBe('number');

    // Verify help structure
    expect(analytics.help).toHaveProperty('views');
    expect(analytics.help).toHaveProperty('sectionExpansionsByType');
    expect(typeof analytics.help.views).toBe('number');
    expect(typeof analytics.help.sectionExpansionsByType).toBe('object');

    // Verify calculator structure
    expect(analytics.calculator).toHaveProperty('uses');
    expect(analytics.calculator).toHaveProperty('uniqueUsers');
    expect(analytics.calculator).toHaveProperty('priceBucketHistogram');
    expect(typeof analytics.calculator.uses).toBe('number');
    expect(typeof analytics.calculator.uniqueUsers).toBe('number');
    expect(typeof analytics.calculator.priceBucketHistogram).toBe('object');
  });

  it('should fetch analytics for 7-day range', async () => {
    if (!INTEGRATION_ENABLED) {
      console.log('Skipped: RUN_SUPABASE_E2E not set');
      return;
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const analytics = await getEducationAnalytics({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    expect(analytics).toHaveProperty('onboarding');
    expect(analytics).toHaveProperty('help');
    expect(analytics).toHaveProperty('calculator');
  });

  it('should return valid completion rate', async () => {
    if (!INTEGRATION_ENABLED) {
      console.log('Skipped: RUN_SUPABASE_E2E not set');
      return;
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const analytics = await getEducationAnalytics({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    // Completion rate should be between 0 and 1
    expect(analytics.onboarding.completionRate).toBeGreaterThanOrEqual(0);
    expect(analytics.onboarding.completionRate).toBeLessThanOrEqual(1);
  });

  it('should handle empty date range gracefully', async () => {
    if (!INTEGRATION_ENABLED) {
      console.log('Skipped: RUN_SUPABASE_E2E not set');
      return;
    }

    // Future date range (should have no data)
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() + 1);
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 2);

    const analytics = await getEducationAnalytics({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    // Should return zero values, not error
    expect(analytics.onboarding.started).toBe(0);
    expect(analytics.onboarding.completed).toBe(0);
    expect(analytics.onboarding.skipped).toBe(0);
    expect(analytics.help.views).toBe(0);
    expect(analytics.calculator.uses).toBe(0);
  });

  it('should validate price bucket histogram keys', async () => {
    if (!INTEGRATION_ENABLED) {
      console.log('Skipped: RUN_SUPABASE_E2E not set');
      return;
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const analytics = await getEducationAnalytics({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    const histogram = analytics.calculator.priceBucketHistogram;

    // Should have all 4 buckets
    expect(histogram).toHaveProperty('<10');
    expect(histogram).toHaveProperty('10-50');
    expect(histogram).toHaveProperty('50-100');
    expect(histogram).toHaveProperty('>100');

    // All values should be non-negative
    expect(histogram['<10']).toBeGreaterThanOrEqual(0);
    expect(histogram['10-50']).toBeGreaterThanOrEqual(0);
    expect(histogram['50-100']).toBeGreaterThanOrEqual(0);
    expect(histogram['>100']).toBeGreaterThanOrEqual(0);
  });
});
