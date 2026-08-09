/**
 * FILE: p2p-kids-admin/src/app/analytics/notifications/page.tsx
 * MODULE: MODULE-14-NOTIFICATIONS-V2 (NOTIF-V2-010)
 * TASK: Notification Analytics & Metrics Dashboard
 * 
 * Admin dashboard for viewing notification analytics metrics:
 * - Delivery rates by category
 * - Open rates by type
 * - Click rates
 * - A/B test performance
 */

'use client';

import React, { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// InfoTooltip Component
function InfoTooltip({ message }: { message: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const handleMouseEnter = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 10, // Position above with 10px spacing
        left: rect.left + rect.width / 2,
      });
    }
    setShowTooltip(true);
  };

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors cursor-help ml-2"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        title={message}
        data-testid="info-tooltip-button"
      >
        <span className="text-xs font-bold">?</span>
      </button>
      {showTooltip && (
        <div
          className="fixed w-48 bg-gray-900 text-white text-xs rounded-lg p-2 shadow-2xl z-50 whitespace-normal pointer-events-none"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {message}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
}

interface CategoryMetrics {
  category: string;
  variant: string;
  total: number;
  delivered: number;
  failed: number;
  opened: number;
  clicked: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
}

interface TypeMetrics {
  type: string;
  variant: string;
  total: number;
  delivered: number;
  opened: number;
  clicked: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
}

interface NotificationMetrics {
  total_sent: number;
  date_range: {
    start: string;
    end: string;
  };
  by_category: CategoryMetrics[];
  by_type: TypeMetrics[];
}

interface ChannelMetrics {
  category: string;
  email: number;
  in_app: number;
  push: number;
  total: number;
}

export default function NotificationAnalyticsPage() {
  const [metrics, setMetrics] = useState<NotificationMetrics | null>(null);
  const [channelMetrics, setChannelMetrics] = useState<ChannelMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(30); // days
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedNotificationType, setSelectedNotificationType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClientComponentClient();

  useEffect(() => {
    loadMetrics();
  }, [dateRange, selectedCategory, selectedNotificationType]);

  const loadMetrics = async () => {
    setLoading(true);
    setError(null);

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      const { data, error: rpcError } = await supabase.rpc(
        'get_notification_analytics',
        {
          p_start_date: startDate.toISOString(),
          p_end_date: new Date().toISOString(),
          p_category: selectedCategory,
          p_notification_type: selectedNotificationType,
        }
      );

      if (rpcError) {
        console.error('[NotificationAnalytics] RPC error:', rpcError);
        setError(rpcError.message);
      } else if (data) {
        setMetrics(data);
        // Calculate channel metrics
        loadChannelMetrics(startDate);
      }
    } catch (err) {
      console.error('[NotificationAnalytics] Load error:', err);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const loadChannelMetrics = async (startDate: Date) => {
    try {
      const { data, error: queryError } = await supabase.rpc(
        'get_notification_channel_metrics',
        {
          p_start_date: startDate.toISOString(),
          p_end_date: new Date().toISOString(),
          p_category: selectedCategory,
        }
      );

      if (!queryError && data) {
        setChannelMetrics(data);
      }
    } catch (err) {
      console.error('[NotificationAnalytics] Channel metrics error:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-semibold">Error Loading Analytics</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => loadMetrics()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Notification Analytics</h1>
        <p className="text-gray-600">
          Track delivery rates, open rates, and click rates for all notifications
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex gap-2">
          <button
            onClick={() => setDateRange(7)}
            className={`px-4 py-2 rounded-lg transition ${
              dateRange === 7
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            data-testid="date-range-7"
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setDateRange(30)}
            className={`px-4 py-2 rounded-lg transition ${
              dateRange === 30
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            data-testid="date-range-30"
          >
            Last 30 Days
          </button>
          <button
            onClick={() => setDateRange(90)}
            className={`px-4 py-2 rounded-lg transition ${
              dateRange === 90
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            data-testid="date-range-90"
          >
            Last 90 Days
          </button>
        </div>

        <div>
          <label className="text-sm text-gray-600 mr-2">Category:</label>
          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
            data-testid="category-filter"
          >
            <option value="">All Categories</option>
            <option value="subscription">Subscription</option>
            <option value="sp_events">SP Events</option>
            <option value="badges">Badges</option>
            <option value="trades">Trades</option>
            <option value="system">System</option>
          </select>
        </div>

        <div>
          <label className="text-sm text-gray-600 mr-2">Notification Type:</label>
          <select
            value={selectedNotificationType || ''}
            onChange={(e) => setSelectedNotificationType(e.target.value || null)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
            data-testid="notification-type-filter"
          >
            <option value="">All Types</option>
            <option value="email">Email</option>
            <option value="in_app">In-App</option>
            <option value="push">Push Notification</option>
          </select>
        </div>
      </div>

      {metrics && (
        <>
          {/* Overview Card */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-4xl font-bold text-blue-600" data-testid="total-sent">
                    {metrics.total_sent.toLocaleString()}
                  </div>
                  <InfoTooltip message="Total number of notifications sent during the selected time period across all categories and channels (email, in-app, push)." />
                </div>
                <div className="text-gray-600">Total Notifications Sent</div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-4xl font-bold text-green-600" data-testid="avg-delivery-rate">
                    {metrics.by_category.length > 0
                      ? (
                          metrics.by_category.reduce(
                            (sum, cat) => sum + cat.delivery_rate,
                            0
                          ) / metrics.by_category.length
                        ).toFixed(1)
                      : 0}
                    %
                  </div>
                  <InfoTooltip message="Average delivery rate across all categories. Delivery rate = (Notifications delivered / Total notifications sent) × 100. This includes email, in-app, and push notifications successfully delivered to users." />
                </div>
                <div className="text-gray-600">Avg Delivery Rate</div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-4xl font-bold text-primary-600" data-testid="avg-open-rate">
                    {metrics.by_category.length > 0
                      ? (
                          metrics.by_category.reduce(
                            (sum, cat) => sum + (cat.open_rate || 0),
                            0
                          ) / metrics.by_category.length
                        ).toFixed(1)
                      : 0}
                    %
                  </div>
                  <InfoTooltip message="Average open rate across all categories. Open rate = (Notifications opened by users / Notifications delivered) × 100. Indicates how many delivered notifications were actually viewed by users." />
                </div>
                <div className="text-gray-600">Avg Open Rate</div>
              </div>
            </div>
          </div>

          {/* Notifications by Channel */}
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xl font-semibold">Notifications by Channel</h2>
                <InfoTooltip message="Breakdown of notifications sent across different delivery channels (Email, In-App, Push) for each category. Shows which channels are most utilized for each notification type." />
              </div>
              <p className="text-sm text-gray-600 mt-1">Count of notifications per category by delivery channel</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="channel-metrics-table">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-1">
                        📧 Email
                        <InfoTooltip message="Number of notifications sent via email channel for this category." />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-1">
                        💬 In-App
                        <InfoTooltip message="Number of notifications sent via in-app messages for this category. These appear in the notification center within the app." />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-1">
                        🔔 Push
                        <InfoTooltip message="Number of push notifications sent for this category. These are delivered to devices regardless of app being open." />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-1">
                        Total
                        <InfoTooltip message="Combined total of all notification channels (Email + In-App + Push) for this category." />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {channelMetrics.map((metric, index) => (
                    <tr key={`${metric.category}-${index}`}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {metric.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 text-blue-600 font-semibold text-sm">
                          {metric.email}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-50 text-green-600 font-semibold text-sm">
                          {metric.in_app}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary-50 text-primary-600 font-semibold text-sm">
                          {metric.push}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-900 font-bold text-sm">
                          {metric.total}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Metrics by Category */}
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xl font-semibold">Metrics by Category</h2>
                <InfoTooltip message="Detailed performance metrics for each notification category. Shows delivery success rates, user engagement (opens), and interaction rates (clicks) broken down by A/B test variants." />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="category-metrics-table">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Variant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        Total
                        <InfoTooltip message="Total number of notifications sent in this category and variant." />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        Delivered
                        <InfoTooltip message="Number of notifications successfully delivered to users' devices or accounts." />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        Delivery Rate
                        <InfoTooltip message="Percentage of sent notifications that were successfully delivered. Green (≥90%), Yellow (70-89%), Red (<70%)." />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        Open Rate
                        <InfoTooltip message="Percentage of delivered notifications that were opened/viewed by users. Shows engagement level." />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        Click Rate
                        <InfoTooltip message="Percentage of delivered notifications that users clicked on. Indicates conversion potential." />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {metrics.by_category.map((cat, index) => (
                    <tr key={`${cat.category}-${cat.variant}-${index}`}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {cat.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {cat.variant}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cat.total}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cat.delivered}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`font-semibold ${
                            cat.delivery_rate >= 90
                              ? 'text-green-600'
                              : cat.delivery_rate >= 70
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }`}
                        >
                          {cat.delivery_rate?.toFixed(1) || 0}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="font-semibold text-primary-600">
                          {cat.open_rate?.toFixed(1) || 0}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="font-semibold text-blue-600">
                          {cat.click_rate?.toFixed(1) || 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Performing Notification Types */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xl font-semibold">Top Performing Types</h2>
                <InfoTooltip message="The highest-performing notification types sorted by total volume. Shows which specific notification types (e.g., 'sale_alert', 'trial_reminder') generate the most opens and clicks." />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="type-metrics-table">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        Type
                        <InfoTooltip message="The specific notification type identifier (e.g., 'sale_alert', 'trial_reminder', 'badge_earned')." />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Variant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        Total
                        <InfoTooltip message="Total number of this notification type sent." />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        Open Rate
                        <InfoTooltip message="Percentage of this notification type that were opened by users. Higher is better for engagement." />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        Click Rate
                        <InfoTooltip message="Percentage of this notification type that users clicked on. Indicates conversion effectiveness." />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {metrics.by_type.slice(0, 10).map((type, index) => (
                    <tr key={`${type.type}-${type.variant}-${index}`}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {type.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {type.variant}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {type.total}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-primary-600">
                        {type.open_rate?.toFixed(1) || 0}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                        {type.click_rate?.toFixed(1) || 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
