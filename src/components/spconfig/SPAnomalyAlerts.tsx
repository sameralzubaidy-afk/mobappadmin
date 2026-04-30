// FILE: p2p-kids-admin/src/components/spconfig/SPAnomalyAlerts.tsx
// ADMIN-V3-006: Anomaly alerts panel for flagged categories

'use client';

import React from 'react';
import { AlertTriangle, TrendingDown, TrendingUp, Package } from 'lucide-react';
import type { CategorySPAnalytics, AnomalyFlag } from '@/types/category';

interface SPAnomalyAlertsProps {
  /** Analytics data with anomaly flags */
  analytics: CategorySPAnalytics[];
  /** Callback when category is clicked */
  onCategoryClick: (categoryId: string) => void;
}

const ANOMALY_CONFIG: Record<
  AnomalyFlag,
  {
    icon: React.ReactNode;
    label: string;
    description: string;
    color: string;
    bgColor: string;
  }
> = {
  hoarding: {
    icon: <Package size={16} />,
    label: 'Hoarding',
    description: 'Gap > 10% — users earning but not spending',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50 border-yellow-200',
  },
  low_velocity: {
    icon: <TrendingDown size={16} />,
    label: 'Low Velocity',
    description: 'Velocity < 0.5 — spending is much lower than earning',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50 border-orange-200',
  },
  spending_spike: {
    icon: <TrendingUp size={16} />,
    label: 'Spending Spike',
    description: 'Velocity > 2 — users spending more SP than earning',
    color: 'text-red-700',
    bgColor: 'bg-red-50 border-red-200',
  },
};

/**
 * Panel showing categories with detected anomalies
 */
export function SPAnomalyAlerts({ analytics, onCategoryClick }: SPAnomalyAlertsProps) {
  const flaggedCategories = analytics.filter((cat) => cat.anomaly_flags.length > 0);

  if (flaggedCategories.length === 0) {
    return (
      <div
        className="bg-green-50 border border-green-200 rounded-lg p-6 text-center"
        data-testid="sp-anomaly-none"
      >
        <div className="text-green-700 font-medium mb-1">✓ All Categories Healthy</div>
        <div className="text-green-600 text-sm">
          No anomalies detected in the selected date range
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="sp-anomaly-alerts">
      <div className="flex items-center gap-2 text-gray-700 font-medium mb-4">
        <AlertTriangle size={18} className="text-yellow-600" />
        <span>
          {flaggedCategories.length} {flaggedCategories.length === 1 ? 'Category' : 'Categories'}{' '}
          Flagged
        </span>
      </div>

      {flaggedCategories.map((category) => (
        <div
          key={category.category_id}
          className="border rounded-lg p-4 hover:shadow-md transition cursor-pointer"
          onClick={() => onCategoryClick(category.category_id)}
          data-testid={`anomaly-card-${category.category_id}`}
        >
          <div className="font-medium text-gray-900 mb-2">{category.category_name}</div>

          <div className="space-y-2">
            {category.anomaly_flags.map((flag) => {
              const config = ANOMALY_CONFIG[flag];
              return (
                <div
                  key={flag}
                  className={`flex items-center gap-2 text-sm px-3 py-2 border rounded ${config.bgColor} ${config.color}`}
                  data-testid={`anomaly-flag-${flag}`}
                >
                  {config.icon}
                  <div>
                    <span className="font-medium">{config.label}:</span>{' '}
                    <span className="opacity-90">{config.description}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-600">
            <div>
              <span className="font-medium">Velocity:</span>{' '}
              {category.velocity.toFixed(2)}
            </div>
            <div>
              <span className="font-medium">Gap:</span> {category.gap_percent.toFixed(1)}%
            </div>
            <div>
              <span className="font-medium">Avg Cash:</span> $
              {category.avg_cash_per_trade.toFixed(2)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
