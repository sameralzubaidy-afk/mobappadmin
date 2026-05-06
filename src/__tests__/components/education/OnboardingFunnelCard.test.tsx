// FILE: p2p-kids-admin/src/__tests__/components/education/OnboardingFunnelCard.test.tsx
// MODULE-18 V1 EDU-009: Unit tests for OnboardingFunnelCard

import React from 'react';
import { render, screen } from '@testing-library/react';
import { OnboardingFunnelCard } from '../../../components/education/OnboardingFunnelCard';

describe('OnboardingFunnelCard', () => {
  it('should render empty state when no data', () => {
    render(
      <OnboardingFunnelCard
        started={0}
        completed={0}
        skipped={0}
        completionRate={0}
      />
    );

    expect(screen.getByText('Onboarding Funnel')).toBeInTheDocument();
    expect(screen.getByText('No data for selected range')).toBeInTheDocument();
  });

  it('should render metrics correctly', () => {
    render(
      <OnboardingFunnelCard
        started={100}
        completed={70}
        skipped={30}
        completionRate={0.7}
        testID="test-funnel"
      />
    );

    expect(screen.getByTestId('test-funnel-started')).toHaveTextContent('100');
    expect(screen.getByTestId('test-funnel-completed')).toHaveTextContent('70');
    expect(screen.getByTestId('test-funnel-skipped')).toHaveTextContent('30');
    expect(screen.getByTestId('test-funnel-completion-rate')).toHaveTextContent('70%');
  });

  it('should show green color when completion rate >= 50%', () => {
    render(
      <OnboardingFunnelCard
        started={100}
        completed={60}
        skipped={40}
        completionRate={0.6}
        testID="test-funnel"
      />
    );

    const rateCard = screen.getByTestId('test-funnel-completion-rate');
    expect(rateCard).toBeInTheDocument();
    expect(screen.queryByText(/⚠️ Low completion rate/)).not.toBeInTheDocument();
  });

  it('should show warning when completion rate < 50%', () => {
    render(
      <OnboardingFunnelCard
        started={100}
        completed={40}
        skipped={60}
        completionRate={0.4}
        testID="test-funnel"
      />
    );

    expect(screen.getByTestId('test-funnel-completion-rate')).toHaveTextContent('40%');
    expect(screen.getByText(/⚠️ Low completion rate/)).toBeInTheDocument();
  });

  it('should handle 100% completion rate', () => {
    render(
      <OnboardingFunnelCard
        started={50}
        completed={50}
        skipped={0}
        completionRate={1.0}
      />
    );

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.queryByText(/⚠️ Low completion rate/)).not.toBeInTheDocument();
  });

  it('should handle 0% completion rate', () => {
    render(
      <OnboardingFunnelCard
        started={50}
        completed={0}
        skipped={50}
        completionRate={0}
      />
    );

    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText(/⚠️ Low completion rate/)).toBeInTheDocument();
  });
});
