// FILE: p2p-kids-admin/src/components/education/OnboardingFunnelCard.tsx
// MODULE-18 V1 EDU-009: Onboarding funnel metrics card

'use client';

import React from 'react';
import { TrendingUp } from 'lucide-react';
import { theme } from '@/styles/theme';

interface OnboardingFunnelCardProps {
  started: number;
  completed: number;
  skipped: number;
  completionRate: number; // 0-1
  testID?: string;
}

export function OnboardingFunnelCard({
  started,
  completed,
  skipped,
  completionRate,
  testID = 'onboarding-funnel-card',
}: OnboardingFunnelCardProps) {
  const completionPercent = Math.round(completionRate * 100);
  const isLowCompletion = completionRate < 0.5;

  // Empty state
  if (started === 0 && completed === 0 && skipped === 0) {
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
          Onboarding Funnel
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
          Onboarding Funnel
        </h3>
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{
            background: theme.iconColors.purple.bg,
            color: theme.iconColors.purple.icon,
          }}
        >
          <TrendingUp size={20} />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div data-testid={`${testID}-started`}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: theme.colors.text.secondary }}>
            Started
          </p>
          <p className="text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
            {started}
          </p>
        </div>

        <div data-testid={`${testID}-completed`}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: theme.colors.text.secondary }}>
            Completed
          </p>
          <p className="text-2xl font-bold" style={{ color: theme.colors.brand.green }}>
            {completed}
          </p>
        </div>

        <div data-testid={`${testID}-skipped`}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: theme.colors.text.secondary }}>
            Skipped
          </p>
          <p className="text-2xl font-bold" style={{ color: theme.colors.text.muted }}>
            {skipped}
          </p>
        </div>
      </div>

      {/* Completion Rate */}
      <div
        data-testid={`${testID}-completion-rate`}
        className="p-4 rounded-lg"
        style={{
          background: isLowCompletion
            ? 'rgba(229, 57, 53, 0.1)'
            : 'rgba(76, 175, 80, 0.1)',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium" style={{ color: theme.colors.text.primary }}>
            Completion Rate
          </span>
          <span
            className="text-lg font-bold"
            style={{
              color: isLowCompletion ? '#E53935' : theme.colors.brand.green,
            }}
          >
            {completionPercent}%
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="w-full h-2 rounded-full overflow-hidden"
          style={{ background: theme.colors.content.bg }}
        >
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${completionPercent}%`,
              background: isLowCompletion ? '#E53935' : theme.colors.brand.green,
            }}
          />
        </div>

        {isLowCompletion && (
          <p className="text-xs mt-2" style={{ color: '#E53935' }}>
            ⚠️ Low completion rate - consider reviewing onboarding content
          </p>
        )}
      </div>
    </div>
  );
}
