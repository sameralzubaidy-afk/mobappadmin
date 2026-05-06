// FILE: p2p-kids-admin/src/components/education/CalculatorUsageCard.tsx
// MODULE-18 V1 EDU-009: Calculator usage metrics card with price bucket histogram

'use client';

import React from 'react';
import { Calculator } from 'lucide-react';
import { theme } from '@/styles/theme';

interface CalculatorUsageCardProps {
  uses: number;
  uniqueUsers: number;
  priceBucketHistogram: Record<string, number>; // '<10', '10-50', '50-100', '>100'
  testID?: string;
}

export function CalculatorUsageCard({
  uses,
  uniqueUsers,
  priceBucketHistogram,
  testID = 'calculator-usage-card',
}: CalculatorUsageCardProps) {
  // Price buckets in order
  const buckets = [
    { key: '<10', label: '< $10' },
    { key: '10-50', label: '$10-50' },
    { key: '50-100', label: '$50-100' },
    { key: '>100', label: '> $100' },
  ];

  const bucketData = buckets.map((bucket) => ({
    ...bucket,
    count: priceBucketHistogram[bucket.key] || 0,
  }));

  const maxBucketCount = Math.max(...bucketData.map((b) => b.count), 1);

  // Empty state
  if (uses === 0 && uniqueUsers === 0) {
    return (
      <div
        data-testid={testID}
        className="rounded-xl p-6 flex flex-col gap-4"
        style={{
          background: theme.colors.card.bg,
          border: `1px solid ${theme.colors.card.border}`,
          boxShadow: theme.shadow.card,
        }}
      >
        <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
          Calculator Usage
        </h3>
        <div className="flex items-center justify-center py-8">
          <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
            No data for selected range
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={testID}
      className="rounded-xl p-6 flex flex-col gap-4 transition-shadow hover:shadow-lg"
      style={{
        background: theme.colors.card.bg,
        border: `1px solid ${theme.colors.card.border}`,
        boxShadow: theme.shadow.card,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
          Calculator Usage
        </h3>
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{
            background: theme.iconColors.orange.bg,
            color: theme.iconColors.orange.icon,
          }}
        >
          <Calculator size={20} />
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4">
        <div data-testid={`${testID}-total-uses`}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: theme.colors.text.secondary }}>
            Total Uses
          </p>
          <p className="text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
            {uses.toLocaleString()}
          </p>
        </div>

        <div data-testid={`${testID}-unique-users`}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: theme.colors.text.secondary }}>
            Unique Users
          </p>
          <p className="text-2xl font-bold" style={{ color: theme.colors.brand.primary }}>
            {uniqueUsers.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Price Bucket Histogram */}
      <div>
        <p className="text-sm font-semibold mb-3" style={{ color: theme.colors.text.primary }}>
          Price Range Distribution
        </p>
        <div className="space-y-3" data-testid={`${testID}-histogram`}>
          {bucketData.map((bucket) => (
            <div key={bucket.key} data-testid={`${testID}-bucket-${bucket.key}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm" style={{ color: theme.colors.text.primary }}>
                  {bucket.label}
                </span>
                <span className="text-sm font-semibold" style={{ color: theme.colors.brand.primary }}>
                  {bucket.count}
                </span>
              </div>
              {/* Bar */}
              <div
                className="w-full h-2.5 rounded-full overflow-hidden"
                style={{ background: theme.colors.content.bg }}
              >
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${(bucket.count / maxBucketCount) * 100}%`,
                    background: theme.iconColors.orange.icon,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
