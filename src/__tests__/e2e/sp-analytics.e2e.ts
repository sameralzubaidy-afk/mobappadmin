// FILE: p2p-kids-admin/src/__tests__/e2e/sp-analytics.e2e.ts
// Integration tests for SP Analytics Dashboard
// Run with: RUN_SUPABASE_E2E=true npm run test:e2e

import { getSPAnalyticsByCategory } from '@/lib/spConfigCategoryService';
import type { CategorySPAnalytics } from '@/types/category';

// Mock Supabase client for local testing - in real E2E this uses staging
const STAGING_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const STAGING_ENABLED = process.env.RUN_SUPABASE_E2E === 'true';

describe('SP Analytics E2E Tests', () => {
  // Skip if not in E2E mode
  const describeE2E = STAGING_ENABLED ? describe : describe.skip;

  describeE2E('getSPAnalyticsByCategory service', () => {
    it('should fetch analytics for a 30-day date range', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const analytics = await getSPAnalyticsByCategory({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });

      expect(Array.isArray(analytics)).toBe(true);

      // Each category should have required fields
      analytics.forEach((cat) => {
        expect(cat).toHaveProperty('category_id');
        expect(cat).toHaveProperty('category_name');
        expect(cat).toHaveProperty('velocity');
        expect(cat).toHaveProperty('gap_percent');
        expect(cat).toHaveProperty('avg_cash_per_trade');
        expect(cat).toHaveProperty('anomaly_flags');
        expect(Array.isArray(cat.anomaly_flags)).toBe(true);
      });
    });

    it('should return empty array when no data in range', async () => {
      // Future date range - should have no data
      const futureStart = new Date();
      futureStart.setFullYear(futureStart.getFullYear() + 1);
      const futureEnd = new Date(futureStart);
      futureEnd.setDate(futureEnd.getDate() + 30);

      const analytics = await getSPAnalyticsByCategory({
        start: futureStart.toISOString(),
        end: futureEnd.toISOString(),
      });

      expect(analytics).toEqual([]);
    });

    it('should correctly detect hoarding anomaly (gap > 10%)', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);

      const analytics = await getSPAnalyticsByCategory({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });

      const hoardingCategories = analytics.filter((cat) =>
        cat.anomaly_flags.includes('hoarding')
      );

      // All hoarding categories should have gap > 10%
      hoardingCategories.forEach((cat) => {
        expect(cat.gap_percent).toBeGreaterThan(10);
      });
    });

    it('should correctly detect low velocity anomaly (velocity < 0.5)', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);

      const analytics = await getSPAnalyticsByCategory({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });

      const lowVelocityCategories = analytics.filter((cat) =>
        cat.anomaly_flags.includes('low_velocity')
      );

      // All low velocity categories should have velocity < 0.5
      lowVelocityCategories.forEach((cat) => {
        expect(cat.velocity).toBeLessThan(0.5);
      });
    });

    it('should correctly detect spending spike anomaly (velocity > 2)', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);

      const analytics = await getSPAnalyticsByCategory({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });

      const spikingCategories = analytics.filter((cat) =>
        cat.anomaly_flags.includes('spending_spike')
      );

      // All spiking categories should have velocity > 2
      spikingCategories.forEach((cat) => {
        expect(cat.velocity).toBeGreaterThan(2);
      });
    });

    it('should handle different date ranges (7, 30, 90 days)', async () => {
      const dateRanges = [7, 30, 90];

      for (const days of dateRanges) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const analytics = await getSPAnalyticsByCategory({
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        });

        expect(Array.isArray(analytics)).toBe(true);
        // Data volume may vary but structure should be consistent
        analytics.forEach((cat) => {
          expect(typeof cat.velocity).toBe('number');
          expect(typeof cat.gap_percent).toBe('number');
          expect(typeof cat.avg_cash_per_trade).toBe('number');
        });
      }
    });

    it('should sort results by gap_percent descending', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const analytics = await getSPAnalyticsByCategory({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });

      if (analytics.length > 1) {
        for (let i = 0; i < analytics.length - 1; i++) {
          expect(analytics[i].gap_percent).toBeGreaterThanOrEqual(
            analytics[i + 1].gap_percent
          );
        }
      }
    });

    it('should have performance < 1s on staging data', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const startTime = Date.now();

      await getSPAnalyticsByCategory({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // < 1 second
    });
  });

  describeE2E('CSV Export functionality', () => {
    it('should generate valid CSV content', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const analytics = await getSPAnalyticsByCategory({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });

      if (analytics.length === 0) {
        console.warn('No analytics data available for CSV test');
        return;
      }

      // Simulate CSV generation
      const headers = [
        'Category ID',
        'Category Name',
        'Velocity',
        'Gap %',
        'Avg Cash Per Trade',
        'Anomaly Flags',
      ];

      const rows = analytics.map((cat) => [
        cat.category_id,
        cat.category_name,
        cat.velocity.toFixed(2),
        cat.gap_percent.toFixed(1),
        cat.avg_cash_per_trade.toFixed(2),
        cat.anomaly_flags.join('; '),
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) =>
          row
            .map((cell) => (typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell))
            .join(',')
        ),
      ].join('\n');

      // Verify CSV structure
      const lines = csvContent.split('\n');
      expect(lines[0]).toBe(headers.join(','));
      expect(lines.length).toBe(analytics.length + 1); // Headers + data rows

      // Verify each row has correct column count
      lines.slice(1).forEach((line) => {
        const columns = line.split(',');
        expect(columns.length).toBe(headers.length);
      });
    });
  });
});
