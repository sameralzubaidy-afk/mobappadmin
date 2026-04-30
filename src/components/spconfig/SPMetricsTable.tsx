// FILE: p2p-kids-admin/src/components/spconfig/SPMetricsTable.tsx
// ADMIN-V3-006: Per-category metrics table

'use client';

import React from 'react';
import type { CategorySPAnalytics } from '@/types/category';

interface SPMetricsTableProps {
  /** Analytics data per category */
  analytics: CategorySPAnalytics[];
  /** Callback when row is clicked */
  onRowClick: (categoryId: string) => void;
  /** Loading state */
  loading?: boolean;
}

/**
 * Table showing velocity, gap %, and avg cash per trade per category
 */
export function SPMetricsTable({ analytics, onRowClick, loading }: SPMetricsTableProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-8 text-center text-gray-500" data-testid="sp-metrics-loading">
          Loading metrics...
        </div>
      </div>
    );
  }

  if (analytics.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-8 text-center text-gray-500" data-testid="sp-metrics-empty">
          No category data available for the selected date range
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden" data-testid="sp-metrics-table">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Category
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Velocity
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Gap %
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Avg Cash / Trade
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Anomalies
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {analytics.map((category) => {
            const hasAnomalies = category.anomaly_flags.length > 0;

            return (
              <tr
                key={category.category_id}
                onClick={() => onRowClick(category.category_id)}
                className="hover:bg-gray-50 cursor-pointer transition"
                data-testid={`sp-metrics-row-${category.category_id}`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {category.category_name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div
                    className={`text-sm ${
                      category.velocity < 0.5
                        ? 'text-orange-600 font-medium'
                        : category.velocity > 2
                        ? 'text-red-600 font-medium'
                        : 'text-gray-900'
                    }`}
                    data-testid={`velocity-${category.category_id}`}
                  >
                    {category.velocity.toFixed(2)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div
                    className={`text-sm ${
                      category.gap_percent > 10
                        ? 'text-yellow-600 font-medium'
                        : 'text-gray-900'
                    }`}
                    data-testid={`gap-${category.category_id}`}
                  >
                    {category.gap_percent.toFixed(1)}%
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm text-gray-900" data-testid={`avg-cash-${category.category_id}`}>
                    ${category.avg_cash_per_trade.toFixed(2)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {hasAnomalies ? (
                    <div className="flex flex-wrap gap-1">
                      {category.anomaly_flags.map((flag) => (
                        <span
                          key={flag}
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            flag === 'hoarding'
                              ? 'bg-yellow-100 text-yellow-800'
                              : flag === 'low_velocity'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                          data-testid={`badge-${flag}-${category.category_id}`}
                        >
                          {flag.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
