// FILE: p2p-kids-admin/src/__tests__/components/education/HelpMetricsCard.test.tsx
// MODULE-18 V1 EDU-009: Unit tests for HelpMetricsCard

import React from 'react';
import { render, screen } from '@testing-library/react';
import { HelpMetricsCard } from '../../../components/education/HelpMetricsCard';

describe('HelpMetricsCard', () => {
  it('should render empty state when no data', () => {
    render(
      <HelpMetricsCard
        totalViews={0}
        sectionExpansionsByType={{}}
      />
    );

    expect(screen.getByText('Help Section Metrics')).toBeInTheDocument();
    expect(screen.getByText('No data for selected range')).toBeInTheDocument();
  });

  it('should render total views correctly', () => {
    render(
      <HelpMetricsCard
        totalViews={1250}
        sectionExpansionsByType={{ sp_earning: 50 }}
        testID="test-help"
      />
    );

    expect(screen.getByTestId('test-help-total-views')).toHaveTextContent('1,250');
  });

  it('should render top 5 sections sorted descending', () => {
    render(
      <HelpMetricsCard
        totalViews={500}
        sectionExpansionsByType={{
          sp_earning: 100,
          sp_spending: 80,
          sp_definition: 60,
          safety: 40,
          general: 20,
          example: 10,
        }}
        testID="test-help"
      />
    );

    const topSections = screen.getByTestId('test-help-top-sections');
    expect(topSections).toBeInTheDocument();

    // Should show top 5 only
    expect(screen.getByTestId('test-help-section-sp_earning')).toBeInTheDocument();
    expect(screen.getByTestId('test-help-section-sp_spending')).toBeInTheDocument();
    expect(screen.getByTestId('test-help-section-sp_definition')).toBeInTheDocument();
    expect(screen.getByTestId('test-help-section-safety')).toBeInTheDocument();
    expect(screen.getByTestId('test-help-section-general')).toBeInTheDocument();
    expect(screen.queryByTestId('test-help-section-example')).not.toBeInTheDocument();

    // Check values
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('should format section labels correctly', () => {
    render(
      <HelpMetricsCard
        totalViews={100}
        sectionExpansionsByType={{
          sp_earning: 50,
          sp_spending: 30,
          sp_definition: 20,
        }}
      />
    );

    expect(screen.getByText(/How to Earn SP/)).toBeInTheDocument();
    expect(screen.getByText(/How to Use SP/)).toBeInTheDocument();
    expect(screen.getByText(/SP Definition/)).toBeInTheDocument();
  });

  it('should handle empty expansions', () => {
    render(
      <HelpMetricsCard
        totalViews={100}
        sectionExpansionsByType={{}}
      />
    );

    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('No section expansions yet')).toBeInTheDocument();
  });

  it('should show only available sections', () => {
    render(
      <HelpMetricsCard
        totalViews={50}
        sectionExpansionsByType={{
          sp_earning: 30,
          safety: 20,
        }}
        testID="test-help"
      />
    );

    const topSections = screen.getByTestId('test-help-top-sections');
    const sectionElements = topSections.querySelectorAll('[data-testid^="test-help-section-"]');
    expect(sectionElements).toHaveLength(2);
  });
});
