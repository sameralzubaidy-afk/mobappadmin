// FILE: p2p-kids-admin/src/components/education/AnalyticsDashboard.tsx
// MODULE-18 V1 EDU-009: Education analytics dashboard container

'use client';

import React from 'react';
import { DateRangePicker } from '../spconfig/DateRangePicker';
import { OnboardingFunnelCard } from './OnboardingFunnelCard';
import { HelpMetricsCard } from './HelpMetricsCard';
import { CalculatorUsageCard } from './CalculatorUsageCard';
import { useEducationAnalytics } from '../../hooks/useEducationAnalytics';
import { theme } from '@/styles/theme';

export function AnalyticsDashboard() {
  const {
    analytics,
    loading,
    error,
    selectedDays,
    setSelectedDays,
    refresh,
  } = useEducationAnalytics();

  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-h-[400px]"
        data-testid="analytics-dashboard-loading"
      >
        <p style={{ color: theme.colors.text.secondary }}>Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-xl p-6"
        style={{
          background: '#f8d7da',
          borderColor: '#f5c6cb',
          color: '#721c24',
          border: '1px solid',
        }}
        data-testid="analytics-dashboard-error"
      >
        <p className="font-medium mb-2">Failed to load analytics</p>
        <p className="text-sm mb-4">{error}</p>
        <button
          onClick={refresh}
          className="px-4 py-2 rounded-lg font-medium"
          style={{
            background: '#721c24',
            color: 'white',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div
        className="flex items-center justify-center min-h-[400px]"
        data-testid="analytics-dashboard-no-data"
      >
        <p style={{ color: theme.colors.text.secondary }}>No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="analytics-dashboard">
      {/* Header with Date Range Picker */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-1" style={{ color: theme.colors.text.primary }}>
            Education Analytics
          </h2>
          <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
            Engagement metrics for trading education content
          </p>
        </div>
        <DateRangePicker
          value={selectedDays}
          onChange={setSelectedDays}
          testIdPrefix="education-analytics"
        />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Onboarding Funnel */}
        <OnboardingFunnelCard
          started={analytics.onboarding.started}
          completed={analytics.onboarding.completed}
          skipped={analytics.onboarding.skipped}
          completionRate={analytics.onboarding.completionRate}
        />

        {/* Help Metrics */}
        <HelpMetricsCard
          totalViews={analytics.help.views}
          sectionExpansionsByType={analytics.help.sectionExpansionsByType}
        />

        {/* Calculator Usage */}
        <CalculatorUsageCard
          uses={analytics.calculator.uses}
          uniqueUsers={analytics.calculator.uniqueUsers}
          priceBucketHistogram={analytics.calculator.priceBucketHistogram}
        />
      </div>
    </div>
  );
}
