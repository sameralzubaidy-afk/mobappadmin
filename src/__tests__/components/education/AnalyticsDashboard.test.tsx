// FILE: p2p-kids-admin/src/__tests__/components/education/AnalyticsDashboard.test.tsx
// MODULE-18 V1 EDU-009: Unit tests for AnalyticsDashboard

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { AnalyticsDashboard } from '../../../components/education/AnalyticsDashboard';
import { useEducationAnalytics } from '../../../hooks/useEducationAnalytics';

vi.mock('../../../hooks/useEducationAnalytics');

const mockUseEducationAnalytics = vi.mocked(useEducationAnalytics);

describe('AnalyticsDashboard', () => {
  const mockAnalytics = {
    onboarding: {
      started: 100,
      completed: 70,
      skipped: 30,
      completionRate: 0.7,
    },
    help: {
      views: 250,
      sectionExpansionsByType: {
        sp_earning: 80,
        sp_spending: 60,
        sp_definition: 50,
      },
    },
    calculator: {
      uses: 150,
      uniqueUsers: 80,
      priceBucketHistogram: {
        '<10': 30,
        '10-50': 50,
        '50-100': 40,
        '>100': 30,
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state', () => {
    mockUseEducationAnalytics.mockReturnValue({
      analytics: null,
      loading: true,
      error: null,
      selectedDays: 30,
      setSelectedDays: vi.fn(),
      refresh: vi.fn(),
    });

    render(<AnalyticsDashboard />);

    expect(screen.getByTestId('analytics-dashboard-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading analytics...')).toBeInTheDocument();
  });

  it('should render error state with retry button', async () => {
    const mockRefresh = vi.fn();
    mockUseEducationAnalytics.mockReturnValue({
      analytics: null,
      loading: false,
      error: 'Network error',
      selectedDays: 30,
      setSelectedDays: vi.fn(),
      refresh: mockRefresh,
    });

    render(<AnalyticsDashboard />);

    expect(screen.getByTestId('analytics-dashboard-error')).toBeInTheDocument();
    expect(screen.getByText('Failed to load analytics')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();

    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('should render no data state', () => {
    mockUseEducationAnalytics.mockReturnValue({
      analytics: null,
      loading: false,
      error: null,
      selectedDays: 30,
      setSelectedDays: vi.fn(),
      refresh: vi.fn(),
    });

    render(<AnalyticsDashboard />);

    expect(screen.getByTestId('analytics-dashboard-no-data')).toBeInTheDocument();
    expect(screen.getByText('No analytics data available')).toBeInTheDocument();
  });

  it('should render dashboard with all metrics', () => {
    mockUseEducationAnalytics.mockReturnValue({
      analytics: mockAnalytics,
      loading: false,
      error: null,
      selectedDays: 30,
      setSelectedDays: vi.fn(),
      refresh: vi.fn(),
    });

    render(<AnalyticsDashboard />);

    expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument();
    expect(screen.getByText('Education Analytics')).toBeInTheDocument();

    // Check all cards are present
    expect(screen.getByTestId('onboarding-funnel-card')).toBeInTheDocument();
    expect(screen.getByTestId('help-metrics-card')).toBeInTheDocument();
    expect(screen.getByTestId('calculator-usage-card')).toBeInTheDocument();
  });

  it('should render DateRangePicker with correct value', () => {
    mockUseEducationAnalytics.mockReturnValue({
      analytics: mockAnalytics,
      loading: false,
      error: null,
      selectedDays: 30,
      setSelectedDays: vi.fn(),
      refresh: vi.fn(),
    });

    render(<AnalyticsDashboard />);

    expect(screen.getByTestId('education-analytics-picker')).toBeInTheDocument();
    expect(screen.getByTestId('education-analytics-30')).toBeInTheDocument();
  });

  it('should call setSelectedDays when date range changes', async () => {
    const mockSetSelectedDays = vi.fn();
    mockUseEducationAnalytics.mockReturnValue({
      analytics: mockAnalytics,
      loading: false,
      error: null,
      selectedDays: 30,
      setSelectedDays: mockSetSelectedDays,
      refresh: vi.fn(),
    });

    render(<AnalyticsDashboard />);

    const sevenDayButton = screen.getByTestId('education-analytics-7');
    fireEvent.click(sevenDayButton);

    expect(mockSetSelectedDays).toHaveBeenCalledWith(7);
  });

  it('should display header and subtitle', () => {
    mockUseEducationAnalytics.mockReturnValue({
      analytics: mockAnalytics,
      loading: false,
      error: null,
      selectedDays: 30,
      setSelectedDays: vi.fn(),
      refresh: vi.fn(),
    });

    render(<AnalyticsDashboard />);

    expect(screen.getByText('Education Analytics')).toBeInTheDocument();
    expect(screen.getByText('Engagement metrics for trading education content')).toBeInTheDocument();
  });

  it('should render metrics in grid layout', () => {
    mockUseEducationAnalytics.mockReturnValue({
      analytics: mockAnalytics,
      loading: false,
      error: null,
      selectedDays: 30,
      setSelectedDays: vi.fn(),
      refresh: vi.fn(),
    });

    render(<AnalyticsDashboard />);

    const dashboard = screen.getByTestId('analytics-dashboard');
    const grid = dashboard.querySelector('.grid');
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveClass('grid-cols-1', 'lg:grid-cols-2');
  });
});
