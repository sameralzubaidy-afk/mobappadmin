'use client';

// filepath: p2p-kids-admin/src/app/analytics/page.tsx

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { RevenueMetrics, EngagementMetrics, TimeSeriesDataPoint } from '@/lib/revenueAnalytics';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AnalyticsData {
  revenue: RevenueMetrics;
  engagement: EngagementMetrics;
  timeSeries?: TimeSeriesDataPoint[];
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function getDateRangeBounds(range: '7d' | '30d' | '90d' | '1y') {
  const now = new Date();
  const ranges = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '1y': 365,
  };

  return {
    startDate: new Date(now.getTime() - ranges[range] * DAY_IN_MS),
    endDate: now,
  };
}

export default function RevenueAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [interval, setInterval] = useState<'day' | 'week' | 'month'>('day');

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = getDateRangeBounds(dateRange);

      const params = new URLSearchParams({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        include_time_series: 'true',
        interval: interval,
      });

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers: HeadersInit = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

      const res = await fetch(`/api/admin/analytics/revenue?${params.toString()}`, {
        headers,
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load analytics');
      }

      setData(json.data);
    } catch (err: any) {
      console.error('[RevenueAnalyticsDashboard] Error:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [dateRange, interval]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const { startDate: fallbackStartDate, endDate: fallbackEndDate } = getDateRangeBounds(dateRange);

  const revenue: RevenueMetrics = data?.revenue ?? {
    period: {
      start_date: fallbackStartDate.toISOString(),
      end_date: fallbackEndDate.toISOString(),
    },
    subscription_revenue: {
      active_subscribers: 0,
      mrr: 0,
      arr: 0,
    },
    transaction_fee_revenue: {
      total: 0,
      subscribers: 0,
      non_subscribers: 0,
    },
    totals: {
      total_revenue: 0,
      total_users: 0,
      arpu: 0,
    },
  };

  const engagement: EngagementMetrics = data?.engagement ?? {
    date: fallbackEndDate.toISOString().split('T')[0],
    daily: {
      total: 0,
      subscribers: 0,
      non_subscribers: 0,
    },
    monthly: {
      total: 0,
      subscribers: 0,
      non_subscribers: 0,
    },
    dau_mau_ratio: 0,
  };

  const timeSeries: TimeSeriesDataPoint[] = data?.timeSeries ?? [];

  const periodStart = revenue.period?.start_date ?? fallbackStartDate.toISOString();
  const periodEnd = revenue.period?.end_date ?? fallbackEndDate.toISOString();

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl" data-testid="analytics-dashboard">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Revenue & Analytics</h1>
        
        {/* Date Range Selector */}
        <div className="flex gap-2">
          {(['7d', '30d', '90d', '1y'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1 rounded text-sm font-medium ${
                dateRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              data-testid={`date-range-${range}`}
            >
              {range === '1y' ? '1 Year' : range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          Loading analytics...
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          ✗ {error}
        </div>
      )}

      {/* Period Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-sm text-blue-800" data-testid="period-info-banner">
        📊 Showing data from {new Date(periodStart).toLocaleDateString()} to{' '}
        {new Date(periodEnd).toLocaleDateString()}
      </div>

      {/* Subscription Revenue Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">💰 Subscription Revenue</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Active Subscribers"
            value={formatNumber(revenue.subscription_revenue.active_subscribers)}
            color="blue"
            testId="metric-active-subscribers"
          />
          <MetricCard
            title="MRR (Monthly Recurring Revenue)"
            value={formatCurrency(revenue.subscription_revenue.mrr)}
            color="green"
            testId="metric-mrr"
            subtitle="Active subscribers only"
          />
          <MetricCard
            title="ARR (Annual Recurring Revenue)"
            value={formatCurrency(revenue.subscription_revenue.arr)}
            color="purple"
            testId="metric-arr"
            subtitle="MRR × 12"
          />
        </div>
      </section>

      {/* Transaction Fee Revenue Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">💳 Transaction Fee Revenue</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Total Transaction Fees"
            value={formatCurrency(revenue.transaction_fee_revenue.total)}
            color="indigo"
            testId="metric-total-fees"
            subtitle={`${dateRange.toUpperCase()} Period`}
          />
          <MetricCard
            title="Subscriber Fees"
            value={formatCurrency(revenue.transaction_fee_revenue.subscribers)}
            color="cyan"
            testId="metric-subscriber-fees"
            subtitle="$0.99 per trade"
          />
          <MetricCard
            title="Non-Subscriber Fees"
            value={formatCurrency(revenue.transaction_fee_revenue.non_subscribers)}
            color="orange"
            testId="metric-non-subscriber-fees"
            subtitle="$2.99 per trade"
          />
        </div>
      </section>

      {/* Total Revenue & ARPU Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">📈 Total Revenue & User Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Total Revenue"
            value={formatCurrency(revenue.totals.total_revenue)}
            color="emerald"
            testId="metric-total-revenue"
            subtitle="Subscription + Transaction Fees"
          />
          <MetricCard
            title="Total Users"
            value={formatNumber(revenue.totals.total_users)}
            color="gray"
            testId="metric-total-users"
          />
          <MetricCard
            title="ARPU (Average Revenue Per User)"
            value={formatCurrency(revenue.totals.arpu)}
            color="pink"
            testId="metric-arpu"
            subtitle="Per 30-day period"
          />
        </div>
      </section>

      {/* Engagement Metrics Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">👥 User Engagement</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            title="DAU (Daily Active Users)"
            value={formatNumber(engagement.daily.total)}
            color="violet"
            testId="metric-dau"
            subtitle={`${formatNumber(engagement.daily.subscribers)} subscribers`}
          />
          <MetricCard
            title="MAU (Monthly Active Users)"
            value={formatNumber(engagement.monthly.total)}
            color="fuchsia"
            testId="metric-mau"
            subtitle={`${formatNumber(engagement.monthly.subscribers)} subscribers`}
          />
          <MetricCard
            title="DAU/MAU Ratio"
            value={`${engagement.dau_mau_ratio.toFixed(1)}%`}
            color="rose"
            testId="metric-dau-mau-ratio"
            subtitle="Engagement stickiness"
          />
          <MetricCard
            title="Non-Subscriber DAU"
            value={formatNumber(engagement.daily.non_subscribers)}
            color="amber"
            testId="metric-non-subscriber-dau"
          />
        </div>
      </section>

      {/* Time Series Chart Section */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">📊 Revenue Trend</h2>
          <div className="flex gap-2">
            {(['day', 'week', 'month'] as const).map((int) => (
              <button
                key={int}
                onClick={() => setInterval(int)}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  interval === int
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                data-testid={`interval-${int}`}
              >
                {int.charAt(0).toUpperCase() + int.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="time-series-table">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Period</th>
                  <th className="text-right py-2 px-3">Transaction Fees</th>
                  <th className="text-right py-2 px-3">Subscription</th>
                  <th className="text-right py-2 px-3 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {timeSeries.length > 0 ? (
                  timeSeries.map((point, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3">
                        {new Date(point.period).toLocaleDateString()}
                      </td>
                      <td className="text-right py-2 px-3 text-indigo-600">
                        {formatCurrency(point.transaction_fees)}
                      </td>
                      <td className="text-right py-2 px-3 text-green-600">
                        {formatCurrency(point.subscription_revenue)}
                      </td>
                      <td className="text-right py-2 px-3 font-semibold">
                        {formatCurrency(point.total_revenue)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-4 px-3 text-sm text-gray-500" colSpan={4}>
                      No revenue trend data available for the selected range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Export/Additional Actions */}
      <div className="flex gap-4">
        <button
          onClick={loadAnalytics}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 font-medium"
          data-testid="refresh-button"
        >
          🔄 Refresh Data
        </button>
      </div>
    </div>
  );
}

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: string;
  color: 'blue' | 'green' | 'purple' | 'indigo' | 'cyan' | 'orange' | 'emerald' | 'gray' | 'pink' | 'violet' | 'fuchsia' | 'rose' | 'amber';
  testId: string;
  subtitle?: string;
}

function MetricCard({ title, value, color, testId, subtitle }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    cyan: 'bg-cyan-50 border-cyan-200 text-cyan-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    gray: 'bg-gray-50 border-gray-200 text-gray-900',
    pink: 'bg-pink-50 border-pink-200 text-pink-900',
    violet: 'bg-violet-50 border-violet-200 text-violet-900',
    fuchsia: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-900',
    rose: 'bg-rose-50 border-rose-200 text-rose-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
  };

  return (
    <div
      className={`${colorClasses[color]} rounded-lg border p-6 shadow-sm`}
      data-testid={testId}
    >
      <h3 className="text-sm font-medium opacity-75 mb-2">{title}</h3>
      <p className="text-3xl font-bold mb-1">{value}</p>
      {subtitle && <p className="text-xs opacity-60">{subtitle}</p>}
    </div>
  );
}
