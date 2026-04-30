// FILE: p2p-kids-admin/src/app/sp-analytics/page.tsx
// ADMIN-V3-006: SP Analytics Dashboard Page
// Route: /admin/sp-analytics

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DateRangePicker } from '@/components/spconfig/DateRangePicker';
import { SPAnalyticsDashboard } from '@/components/spconfig/SPAnalyticsDashboard';
import { getSPAnalyticsByCategory } from '@/lib/spConfigCategoryService';
import type { CategorySPAnalytics } from '@/types/category';

/**
 * SP Analytics Dashboard page
 * Shows per-category velocity, gap %, avg cash flow, and anomaly flags
 */
export default function SPAnalyticsDashboardPage() {
  const router = useRouter();
  const [dateRange, setDateRange] = useState<number>(30); // Default 30 days
  const [analytics, setAnalytics] = useState<CategorySPAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch analytics when date range changes
  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      setError(null);

      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - dateRange);

        const data = await getSPAnalyticsByCategory({
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        });

        setAnalytics(data);
      } catch (err) {
        console.error('[SPAnalyticsDashboardPage] Error fetching analytics:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load analytics. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [dateRange]);

  /**
   * Handle category click - navigate to categories page with edit modal + SP Config tab
   */
  const handleCategoryClick = (categoryId: string) => {
    router.push(`/categories?edit=${categoryId}&tab=sp-config`);
  };

  /**
   * Export current analytics snapshot as CSV
   */
  const handleExportCSV = () => {
    if (analytics.length === 0) {
      alert('No data to export');
      return;
    }

    // CSV headers
    const headers = [
      'Category ID',
      'Category Name',
      'Velocity',
      'Gap %',
      'Avg Cash Per Trade',
      'Anomaly Flags',
    ];

    // CSV rows
    const rows = analytics.map((cat) => [
      cat.category_id,
      cat.category_name,
      cat.velocity.toFixed(2),
      cat.gap_percent.toFixed(1),
      cat.avg_cash_per_trade.toFixed(2),
      cat.anomaly_flags.join('; '),
    ]);

    // Generate CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => (typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell)).join(',')
      ),
    ].join('\n');

    // Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sp-analytics-${dateRange}days-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto" data-testid="sp-analytics-page">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">SP Analytics Dashboard</h1>
        <p className="text-gray-600">
          Track Swap Points velocity, gap percentage, and cash flow metrics per category
        </p>
      </div>

      {/* Date Range Filter */}
      <div className="mb-6">
        <DateRangePicker value={dateRange} onChange={setDateRange} testIdPrefix="sp-analytics-date-range" />
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6" data-testid="sp-analytics-error">
          <div className="text-red-800 font-medium">Error Loading Analytics</div>
          <div className="text-red-600 text-sm mt-1">{error}</div>
        </div>
      )}

      {/* Dashboard */}
      <SPAnalyticsDashboard
        analytics={analytics}
        onCategoryClick={handleCategoryClick}
        onExportCSV={handleExportCSV}
        loading={loading}
        dateRange={dateRange}
      />
    </div>
  );
}
