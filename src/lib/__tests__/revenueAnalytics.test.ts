// Unit Tests: Revenue Analytics Service
// filepath: p2p-kids-admin/src/lib/__tests__/revenueAnalytics.test.ts

import { RevenueAnalyticsService } from '../revenueAnalytics';
import { createClient } from '@/lib/supabase/server';

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

describe('RevenueAnalyticsService', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      rpc: jest.fn(),
    };
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRevenueMetrics', () => {
    it('should fetch revenue metrics successfully', async () => {
      const mockData = {
        period: {
          start_date: '2026-02-25T00:00:00Z',
          end_date: '2026-03-25T00:00:00Z',
        },
        subscription_revenue: {
          active_subscribers: 150,
          mrr: 1198.50,
          arr: 14382.00,
        },
        transaction_fee_revenue: {
          total: 450.75,
          subscribers: 198.50,
          non_subscribers: 252.25,
        },
        totals: {
          total_revenue: 1649.25,
          total_users: 500,
          arpu: 3.30,
        },
      };

      mockSupabase.rpc.mockResolvedValue({ data: mockData, error: null });

      const result = await RevenueAnalyticsService.getRevenueMetrics(
        'admin-123',
        new Date('2026-02-25'),
        new Date('2026-03-25')
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_revenue_metrics', {
        p_admin_id: 'admin-123',
        p_start_date: expect.any(String),
        p_end_date: expect.any(String),
      });
      expect(result).toEqual(mockData);
    });

    it('should handle errors when fetching revenue metrics', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      await expect(
        RevenueAnalyticsService.getRevenueMetrics('admin-123')
      ).rejects.toThrow('Failed to get revenue metrics');
    });

    it('should use default dates when not provided', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: { period: {}, subscription_revenue: {}, transaction_fee_revenue: {}, totals: {} },
        error: null,
      });

      await RevenueAnalyticsService.getRevenueMetrics('admin-123');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_revenue_metrics', {
        p_admin_id: 'admin-123',
        p_start_date: undefined,
        p_end_date: undefined,
      });
    });
  });

  describe('getEngagementMetrics', () => {
    it('should fetch engagement metrics successfully', async () => {
      const mockData = {
        date: '2026-03-25',
        daily: {
          total: 45,
          subscribers: 30,
          non_subscribers: 15,
        },
        monthly: {
          total: 250,
          subscribers: 180,
          non_subscribers: 70,
        },
        dau_mau_ratio: 18.0,
      };

      mockSupabase.rpc.mockResolvedValue({ data: mockData, error: null });

      const result = await RevenueAnalyticsService.getEngagementMetrics(
        'admin-123',
        new Date('2026-03-25')
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_engagement_metrics', {
        p_admin_id: 'admin-123',
        p_date: '2026-03-25',
      });
      expect(result).toEqual(mockData);
      expect(result.dau_mau_ratio).toBe(18.0);
    });

    it('should handle errors when fetching engagement metrics', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC failed' },
      });

      await expect(
        RevenueAnalyticsService.getEngagementMetrics('admin-123')
      ).rejects.toThrow('Failed to get engagement metrics');
    });

    it('should use current date when not provided', async () => {
      const mockData = { date: new Date().toISOString().split('T')[0], daily: {}, monthly: {}, dau_mau_ratio: 0 };
      mockSupabase.rpc.mockResolvedValue({ data: mockData, error: null });

      await RevenueAnalyticsService.getEngagementMetrics('admin-123');

      const expectedDate = new Date().toISOString().split('T')[0];
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_engagement_metrics', {
        p_admin_id: 'admin-123',
        p_date: expectedDate,
      });
    });
  });

  describe('getRevenueTimeSeries', () => {
    it('should fetch time series data successfully', async () => {
      const mockData = [
        {
          period: '2026-03-01T00:00:00Z',
          transaction_fees: 45.50,
          subscription_revenue: 400.00,
          total_revenue: 445.50,
        },
        {
          period: '2026-03-02T00:00:00Z',
          transaction_fees: 52.30,
          subscription_revenue: 400.00,
          total_revenue: 452.30,
        },
      ];

      mockSupabase.rpc.mockResolvedValue({ data: mockData, error: null });

      const result = await RevenueAnalyticsService.getRevenueTimeSeries(
        'admin-123',
        new Date('2026-03-01'),
        new Date('2026-03-25'),
        'day'
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_revenue_time_series', {
        p_admin_id: 'admin-123',
        p_start_date: expect.any(String),
        p_end_date: expect.any(String),
        p_interval: 'day',
      });
      expect(result).toEqual(mockData);
      expect(result.length).toBe(2);
    });

    it('should handle errors when fetching time series', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Time series failed' },
      });

      await expect(
        RevenueAnalyticsService.getRevenueTimeSeries('admin-123')
      ).rejects.toThrow('Failed to get time series');
    });

    it('should return empty array when no data exists', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      const result = await RevenueAnalyticsService.getRevenueTimeSeries('admin-123');

      expect(result).toEqual([]);
    });

    it('should support different interval types', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      await RevenueAnalyticsService.getRevenueTimeSeries('admin-123', undefined, undefined, 'week');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_revenue_time_series', {
        p_admin_id: 'admin-123',
        p_start_date: undefined,
        p_end_date: undefined,
        p_interval: 'week',
      });
    });
  });
});
