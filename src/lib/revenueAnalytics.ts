// Admin Revenue Analytics Service
// filepath: p2p-kids-admin/src/lib/revenueAnalytics.ts

import { createClient } from '@/lib/supabase/server';

export interface RevenueMetrics {
  period: {
    start_date: string;
    end_date: string;
  };
  subscription_revenue: {
    active_subscribers: number;
    mrr: number;
    arr: number;
  };
  transaction_fee_revenue: {
    total: number;
    subscribers: number;
    non_subscribers: number;
  };
  totals: {
    total_revenue: number;
    total_users: number;
    arpu: number;
  };
}

export interface EngagementMetrics {
  date: string;
  daily: {
    total: number;
    subscribers: number;
    non_subscribers: number;
  };
  monthly: {
    total: number;
    subscribers: number;
    non_subscribers: number;
  };
  dau_mau_ratio: number;
}

export interface TimeSeriesDataPoint {
  period: string;
  transaction_fees: number;
  subscription_revenue: number;
  total_revenue: number;
}

export class RevenueAnalyticsService {
  /**
   * Get revenue metrics for a specific period
   */
  static async getRevenueMetrics(
    adminId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<RevenueMetrics> {
    const supabase = createClient();

    const { data, error } = await supabase.rpc('get_revenue_metrics', {
      p_admin_id: adminId,
      p_start_date: startDate?.toISOString(),
      p_end_date: endDate?.toISOString(),
    });

    if (error) {
      console.error('[RevenueAnalytics] Failed to get revenue metrics:', error);
      throw new Error(`Failed to get revenue metrics: ${error.message}`);
    }

    return data as RevenueMetrics;
  }

  /**
   * Get engagement metrics (DAU/MAU)
   */
  static async getEngagementMetrics(
    adminId: string,
    date?: Date
  ): Promise<EngagementMetrics> {
    const supabase = createClient();

    const { data, error } = await supabase.rpc('get_engagement_metrics', {
      p_admin_id: adminId,
      p_date: date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
    });

    if (error) {
      console.error('[RevenueAnalytics] Failed to get engagement metrics:', error);
      throw new Error(`Failed to get engagement metrics: ${error.message}`);
    }

    return data as EngagementMetrics;
  }

  /**
   * Get revenue time series for charts
   */
  static async getRevenueTimeSeries(
    adminId: string,
    startDate?: Date,
    endDate?: Date,
    interval: 'day' | 'week' | 'month' = 'day'
  ): Promise<TimeSeriesDataPoint[]> {
    const supabase = createClient();

    const { data, error } = await supabase.rpc('get_revenue_time_series', {
      p_admin_id: adminId,
      p_start_date: startDate?.toISOString(),
      p_end_date: endDate?.toISOString(),
      p_interval: interval,
    });

    if (error) {
      console.error('[RevenueAnalytics] Failed to get time series:', error);
      throw new Error(`Failed to get time series: ${error.message}`);
    }

    return (data || []) as TimeSeriesDataPoint[];
  }
}
