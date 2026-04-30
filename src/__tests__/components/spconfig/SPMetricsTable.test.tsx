// FILE: p2p-kids-admin/src/__tests__/components/spconfig/SPMetricsTable.test.tsx
// Unit tests for SPMetricsTable component

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SPMetricsTable } from '@/components/spconfig/SPMetricsTable';
import type { CategorySPAnalytics } from '@/types/category';

describe('SPMetricsTable', () => {
  const mockOnRowClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockAnalytics = (): CategorySPAnalytics[] => [
    {
      category_id: 'cat-1',
      category_name: 'Electronics',
      velocity: 0.3,
      gap_percent: 15.5,
      avg_cash_per_trade: 45.75,
      anomaly_flags: ['hoarding', 'low_velocity'],
    },
    {
      category_id: 'cat-2',
      category_name: 'Toys',
      velocity: 2.5,
      gap_percent: 5.2,
      avg_cash_per_trade: 20.0,
      anomaly_flags: ['spending_spike'],
    },
    {
      category_id: 'cat-3',
      category_name: 'Books',
      velocity: 1.0,
      gap_percent: 3.1,
      avg_cash_per_trade: 10.5,
      anomaly_flags: [],
    },
  ];

  it('should show loading state', () => {
    render(<SPMetricsTable analytics={[]} onRowClick={mockOnRowClick} loading={true} />);

    expect(screen.getByTestId('sp-metrics-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading metrics...')).toBeInTheDocument();
  });

  it('should show empty state when no data', () => {
    render(<SPMetricsTable analytics={[]} onRowClick={mockOnRowClick} loading={false} />);

    expect(screen.getByTestId('sp-metrics-empty')).toBeInTheDocument();
    expect(screen.getByText(/No category data available/)).toBeInTheDocument();
  });

  it('should render table headers', () => {
    const analytics = createMockAnalytics();

    render(<SPMetricsTable analytics={analytics} onRowClick={mockOnRowClick} />);

    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Velocity')).toBeInTheDocument();
    expect(screen.getByText('Gap %')).toBeInTheDocument();
    expect(screen.getByText('Avg Cash / Trade')).toBeInTheDocument();
    expect(screen.getByText('Anomalies')).toBeInTheDocument();
  });

  it('should render all category rows', () => {
    const analytics = createMockAnalytics();

    render(<SPMetricsTable analytics={analytics} onRowClick={mockOnRowClick} />);

    expect(screen.getByText('Electronics')).toBeInTheDocument();
    expect(screen.getByText('Toys')).toBeInTheDocument();
    expect(screen.getByText('Books')).toBeInTheDocument();
  });

  it('should format metrics correctly', () => {
    const analytics = createMockAnalytics();

    render(<SPMetricsTable analytics={analytics} onRowClick={mockOnRowClick} />);

    // Velocity should show 2 decimals
    expect(screen.getByTestId('velocity-cat-1')).toHaveTextContent('0.30');
    expect(screen.getByTestId('velocity-cat-2')).toHaveTextContent('2.50');

    // Gap should show 1 decimal with %
    expect(screen.getByTestId('gap-cat-1')).toHaveTextContent('15.5%');
    expect(screen.getByTestId('gap-cat-2')).toHaveTextContent('5.2%');

    // Cash should show $ and 2 decimals
    expect(screen.getByTestId('avg-cash-cat-1')).toHaveTextContent('$45.75');
    expect(screen.getByTestId('avg-cash-cat-2')).toHaveTextContent('$20.00');
  });

  it('should highlight low velocity in orange', () => {
    const analytics = createMockAnalytics();

    render(<SPMetricsTable analytics={analytics} onRowClick={mockOnRowClick} />);

    const lowVelocityCell = screen.getByTestId('velocity-cat-1');
    expect(lowVelocityCell).toHaveClass('text-orange-600');
  });

  it('should highlight spending spike in red', () => {
    const analytics = createMockAnalytics();

    render(<SPMetricsTable analytics={analytics} onRowClick={mockOnRowClick} />);

    const spikeCell = screen.getByTestId('velocity-cat-2');
    expect(spikeCell).toHaveClass('text-red-600');
  });

  it('should highlight high gap in yellow', () => {
    const analytics = createMockAnalytics();

    render(<SPMetricsTable analytics={analytics} onRowClick={mockOnRowClick} />);

    const highGapCell = screen.getByTestId('gap-cat-1');
    expect(highGapCell).toHaveClass('text-yellow-600');
  });

  it('should render anomaly badges', () => {
    const analytics = createMockAnalytics();

    render(<SPMetricsTable analytics={analytics} onRowClick={mockOnRowClick} />);

    expect(screen.getByTestId('badge-hoarding-cat-1')).toBeInTheDocument();
    expect(screen.getByTestId('badge-low_velocity-cat-1')).toBeInTheDocument();
    expect(screen.getByTestId('badge-spending_spike-cat-2')).toBeInTheDocument();
  });

  it('should call onRowClick when row is clicked', () => {
    const analytics = createMockAnalytics();

    render(<SPMetricsTable analytics={analytics} onRowClick={mockOnRowClick} />);

    fireEvent.click(screen.getByTestId('sp-metrics-row-cat-1'));

    expect(mockOnRowClick).toHaveBeenCalledWith('cat-1');
    expect(mockOnRowClick).toHaveBeenCalledTimes(1);
  });

  it('should apply hover styles to rows', () => {
    const analytics = createMockAnalytics();

    render(<SPMetricsTable analytics={analytics} onRowClick={mockOnRowClick} />);

    const row = screen.getByTestId('sp-metrics-row-cat-1');
    expect(row).toHaveClass('hover:bg-gray-50');
    expect(row).toHaveClass('cursor-pointer');
  });
});
