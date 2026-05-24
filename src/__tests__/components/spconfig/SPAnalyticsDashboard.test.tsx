// FILE: p2p-kids-admin/src/__tests__/components/spconfig/SPAnalyticsDashboard.test.tsx
// Unit tests for SPAnalyticsDashboard component

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { SPAnalyticsDashboard } from '@/components/spconfig/SPAnalyticsDashboard';
import type { CategorySPAnalytics } from '@/types/category';

// Mock child components
vi.mock('@/components/spconfig/SPMetricsTable', () => ({
  SPMetricsTable: ({ analytics, onRowClick, loading }: any) => (
    <div data-testid="mock-metrics-table">
      {loading && <div>Loading Table</div>}
      {!loading && analytics.length === 0 && <div>Empty Table</div>}
      {!loading &&
        analytics.map((cat: any) => (
          <div key={cat.category_id} onClick={() => onRowClick(cat.category_id)}>
            {cat.category_name}
          </div>
        ))}
    </div>
  ),
}));

vi.mock('@/components/spconfig/SPAnomalyAlerts', () => ({
  SPAnomalyAlerts: ({ analytics, onCategoryClick }: any) => {
    void analytics;
    void onCategoryClick;
    return <div data-testid="mock-anomaly-alerts" />;
  },
}));

describe('SPAnalyticsDashboard', () => {
  const mockOnCategoryClick = vi.fn();
  const mockOnExportCSV = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockAnalytics = (): CategorySPAnalytics[] => [
    {
      category_id: 'cat-1',
      category_name: 'Electronics',
      velocity: 0.3,
      gap_percent: 15,
      avg_cash_per_trade: 45.5,
      anomaly_flags: ['hoarding'],
    },
    {
      category_id: 'cat-2',
      category_name: 'Toys',
      velocity: 1.0,
      gap_percent: 5,
      avg_cash_per_trade: 20.0,
      anomaly_flags: [],
    },
  ];

  it('should render header with category count', () => {
    const analytics = createMockAnalytics();

    render(
      <SPAnalyticsDashboard
        analytics={analytics}
        onCategoryClick={mockOnCategoryClick}
        onExportCSV={mockOnExportCSV}
        dateRange={30}
      />
    );

    expect(screen.getByText('Category SP Metrics')).toBeInTheDocument();
    expect(screen.getByText(/Last 30 days · 2 categories/)).toBeInTheDocument();
  });

  it('should show flagged count in summary', () => {
    const analytics = createMockAnalytics();

    render(
      <SPAnalyticsDashboard
        analytics={analytics}
        onCategoryClick={mockOnCategoryClick}
        onExportCSV={mockOnExportCSV}
        dateRange={30}
      />
    );

    expect(screen.getByText(/1 flagged/)).toBeInTheDocument();
  });

  it('should not show flagged count when none exist', () => {
    const analytics: CategorySPAnalytics[] = [
      {
        category_id: 'cat-1',
        category_name: 'Books',
        velocity: 1.0,
        gap_percent: 3,
        avg_cash_per_trade: 10.0,
        anomaly_flags: [],
      },
    ];

    render(
      <SPAnalyticsDashboard
        analytics={analytics}
        onCategoryClick={mockOnCategoryClick}
        onExportCSV={mockOnExportCSV}
        dateRange={30}
      />
    );

    expect(screen.queryByText(/flagged/)).not.toBeInTheDocument();
  });

  it('should render Export CSV button', () => {
    const analytics = createMockAnalytics();

    render(
      <SPAnalyticsDashboard
        analytics={analytics}
        onCategoryClick={mockOnCategoryClick}
        onExportCSV={mockOnExportCSV}
        dateRange={30}
      />
    );

    const exportButton = screen.getByTestId('export-csv-button');
    expect(exportButton).toBeInTheDocument();
    expect(exportButton).toHaveTextContent('Export CSV');
  });

  it('should call onExportCSV when Export button is clicked', () => {
    const analytics = createMockAnalytics();

    render(
      <SPAnalyticsDashboard
        analytics={analytics}
        onCategoryClick={mockOnCategoryClick}
        onExportCSV={mockOnExportCSV}
        dateRange={30}
      />
    );

    fireEvent.click(screen.getByTestId('export-csv-button'));

    expect(mockOnExportCSV).toHaveBeenCalledTimes(1);
  });

  it('should render anomaly alerts panel when data exists', () => {
    const analytics = createMockAnalytics();

    render(
      <SPAnalyticsDashboard
        analytics={analytics}
        onCategoryClick={mockOnCategoryClick}
        onExportCSV={mockOnExportCSV}
        dateRange={30}
      />
    );

    expect(screen.getByTestId('mock-anomaly-alerts')).toBeInTheDocument();
  });

  it('should not render anomaly alerts when loading', () => {
    const analytics = createMockAnalytics();

    render(
      <SPAnalyticsDashboard
        analytics={analytics}
        onCategoryClick={mockOnCategoryClick}
        onExportCSV={mockOnExportCSV}
        dateRange={30}
        loading={true}
      />
    );

    expect(screen.queryByTestId('mock-anomaly-alerts')).not.toBeInTheDocument();
  });

  it('should render metrics table', () => {
    const analytics = createMockAnalytics();

    render(
      <SPAnalyticsDashboard
        analytics={analytics}
        onCategoryClick={mockOnCategoryClick}
        onExportCSV={mockOnExportCSV}
        dateRange={30}
      />
    );

    expect(screen.getByTestId('mock-metrics-table')).toBeInTheDocument();
  });

  it('should pass loading state to metrics table', () => {
    render(
      <SPAnalyticsDashboard
        analytics={[]}
        onCategoryClick={mockOnCategoryClick}
        onExportCSV={mockOnExportCSV}
        dateRange={30}
        loading={true}
      />
    );

    expect(screen.getByText('Loading Table')).toBeInTheDocument();
  });
});
