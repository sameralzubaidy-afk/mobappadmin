// FILE: p2p-kids-admin/src/components/education/HelpMetricsCard.tsx
// MODULE-18 V1 EDU-009: Help section metrics card

'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';
import { theme } from '@/styles/theme';

interface HelpMetricsCardProps {
  totalViews: number;
  sectionExpansionsByType: Record<string, number>;
  testID?: string;
}

export function HelpMetricsCard({
  totalViews,
  sectionExpansionsByType,
  testID = 'help-metrics-card',
}: HelpMetricsCardProps) {
  // Sort sections by expansion count descending, take top 5
  const topSections = Object.entries(sectionExpansionsByType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([sectionType, count]) => ({
      type: sectionType,
      count,
      label: formatSectionLabel(sectionType),
    }));

  const maxCount = topSections[0]?.count || 1;

  // Empty state
  if (totalViews === 0 && topSections.length === 0) {
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
          Help Section Metrics
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
          Help Section Metrics
        </h3>
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{
            background: theme.iconColors.blue.bg,
            color: theme.iconColors.blue.icon,
          }}
        >
          <HelpCircle size={20} />
        </div>
      </div>

      {/* Total Views */}
      <div data-testid={`${testID}-total-views`}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: theme.colors.text.secondary }}>
          Total Views
        </p>
        <p className="text-3xl font-bold" style={{ color: theme.colors.text.primary }}>
          {totalViews.toLocaleString()}
        </p>
      </div>

      {/* Top Expanded Sections */}
      <div>
        <p className="text-sm font-semibold mb-3" style={{ color: theme.colors.text.primary }}>
          Top 5 Expanded Sections
        </p>
        {topSections.length === 0 ? (
          <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
            No section expansions yet
          </p>
        ) : (
          <div className="space-y-3" data-testid={`${testID}-top-sections`}>
            {topSections.map((section, index) => (
              <div key={section.type} data-testid={`${testID}-section-${section.type}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm" style={{ color: theme.colors.text.primary }}>
                    {index + 1}. {section.label}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: theme.colors.brand.primary }}>
                    {section.count}
                  </span>
                </div>
                {/* Bar */}
                <div
                  className="w-full h-2 rounded-full overflow-hidden"
                  style={{ background: theme.colors.content.bg }}
                >
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${(section.count / maxCount) * 100}%`,
                      background: theme.colors.brand.primary,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatSectionLabel(sectionType: string): string {
  const labels: Record<string, string> = {
    general: 'General',
    sp_definition: 'SP Definition',
    sp_earning: 'How to Earn SP',
    sp_spending: 'How to Use SP',
    safety: 'Safety & Trust',
    example: 'Example Scenarios',
  };
  return labels[sectionType] || sectionType;
}
