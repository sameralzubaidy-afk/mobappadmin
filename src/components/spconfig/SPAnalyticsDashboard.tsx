// FILE: p2p-kids-admin/src/components/spconfig/SPAnalyticsDashboard.tsx
// ADMIN-V3-006: Main dashboard container with table + alerts

'use client';

import React from 'react';
import { Download } from 'lucide-react';
import type { CategorySPAnalytics } from '@/types/category';
import { SPMetricsTable } from './SPMetricsTable';
import { SPAnomalyAlerts } from './SPAnomalyAlerts';

interface SPAnalyticsDashboardProps {
  /** Analytics data */
  analytics: CategorySPAnalytics[];
  /** Callback when category is clicked */
  onCategoryClick: (categoryId: string) => void;
  /** Callback for CSV export */
  onExportCSV: () => void;
  /** Loading state */
  loading?: boolean;
  /** Current date range in days */
  dateRange: number;
}

/**
 * Main dashboard component with metrics table and anomaly alerts panel
 */
export function SPAnalyticsDashboard({
  analytics,
  onCategoryClick,
  onExportCSV,
  loading,
  dateRange,
}: SPAnalyticsDashboardProps) {
  const flaggedCount = analytics.filter((cat) => cat.anomaly_flags.length > 0).length;

  return (
    <div className="space-y-6" data-testid="sp-analytics-dashboard">
      {/* Header with Export */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Category SP Metrics</h2>
          <p className="text-sm text-gray-600 mt-1">
            Last {dateRange} days · {analytics.length} categories
            {flaggedCount > 0 && ` · ${flaggedCount} flagged`}
          </p>
        </div>
        <button
          onClick={onExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          data-testid="export-csv-button"
          aria-label="Export CSV"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Anomaly Alerts Panel */}
      {!loading && analytics.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <SPAnomalyAlerts analytics={analytics} onCategoryClick={onCategoryClick} />
        </div>
      )}

      {/* Metrics Table */}
      <SPMetricsTable
        analytics={analytics}
        onRowClick={onCategoryClick}
        loading={loading}
      />
    </div>
  );
}
