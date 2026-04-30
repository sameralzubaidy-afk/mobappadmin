// FILE: p2p-kids-admin/src/__tests__/components/spconfig/SPAnomalyAlerts.test.tsx
// Unit tests for SPAnomalyAlerts component

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SPAnomalyAlerts } from '@/components/spconfig/SPAnomalyAlerts';
import type { CategorySPAnalytics } from '@/types/category';

describe('SPAnomalyAlerts', () => {
  const mockOnCategoryClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockAnalytics = (): CategorySPAnalytics[] => [
    {
      category_id: 'cat-1',
      category_name: 'Electronics',
      velocity: 0.3,
      gap_percent: 15,
      avg_cash_per_trade: 45.5,
      anomaly_flags: ['hoarding', 'low_velocity'],
    },
    {
      category_id: 'cat-2',
      category_name: 'Toys',
      velocity: 2.5,
      gap_percent: 5,
      avg_cash_per_trade: 20.0,
      anomaly_flags: ['spending_spike'],
    },
    {
      category_id: 'cat-3',
      category_name: 'Books',
      velocity: 1.0,
      gap_percent: 3,
      avg_cash_per_trade: 10.0,
      anomaly_flags: [],
    },
  ];

  it('should show "All Categories Healthy" when no anomalies', () => {
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

    render(<SPAnomalyAlerts analytics={analytics} onCategoryClick={mockOnCategoryClick} />);

    expect(screen.getByTestId('sp-anomaly-none')).toBeInTheDocument();
    expect(screen.getByText('✓ All Categories Healthy')).toBeInTheDocument();
  });

  it('should display flagged categories count', () => {
    const analytics = createMockAnalytics();

    render(<SPAnomalyAlerts analytics={analytics} onCategoryClick={mockOnCategoryClick} />);

    expect(screen.getByText('2 Categories Flagged')).toBeInTheDocument();
  });

  it('should render all flagged categories with their anomalies', () => {
    const analytics = createMockAnalytics();

    render(<SPAnomalyAlerts analytics={analytics} onCategoryClick={mockOnCategoryClick} />);

    // Check Electronics category
    expect(screen.getByText('Electronics')).toBeInTheDocument();
    expect(screen.getByTestId('anomaly-flag-hoarding')).toBeInTheDocument();
    expect(screen.getByTestId('anomaly-flag-low_velocity')).toBeInTheDocument();

    // Check Toys category
    expect(screen.getByText('Toys')).toBeInTheDocument();
    expect(screen.getByTestId('anomaly-flag-spending_spike')).toBeInTheDocument();

    // Books should not appear (no anomalies)
    expect(screen.queryByText('Books')).not.toBeInTheDocument();
  });

  it('should display category metrics', () => {
    const analytics = createMockAnalytics();

    render(<SPAnomalyAlerts analytics={analytics} onCategoryClick={mockOnCategoryClick} />);

    const electronicsCard = screen.getByTestId('anomaly-card-cat-1');

    expect(electronicsCard).toHaveTextContent('Velocity:');
    expect(electronicsCard).toHaveTextContent('0.30');
    expect(electronicsCard).toHaveTextContent('Gap:');
    expect(electronicsCard).toHaveTextContent('15.0%');
    expect(electronicsCard).toHaveTextContent('Avg Cash:');
    expect(electronicsCard).toHaveTextContent('$45.50');
  });

  it('should call onCategoryClick when card is clicked', () => {
    const analytics = createMockAnalytics();

    render(<SPAnomalyAlerts analytics={analytics} onCategoryClick={mockOnCategoryClick} />);

    fireEvent.click(screen.getByTestId('anomaly-card-cat-1'));

    expect(mockOnCategoryClick).toHaveBeenCalledWith('cat-1');
    expect(mockOnCategoryClick).toHaveBeenCalledTimes(1);
  });

  it('should apply correct styling for each anomaly type', () => {
    const analytics = createMockAnalytics();

    render(<SPAnomalyAlerts analytics={analytics} onCategoryClick={mockOnCategoryClick} />);

    const hoardingFlag = screen.getByTestId('anomaly-flag-hoarding');
    const lowVelocityFlag = screen.getByTestId('anomaly-flag-low_velocity');
    const spendingSpikeFlag = screen.getByTestId('anomaly-flag-spending_spike');

    expect(hoardingFlag).toHaveClass('bg-yellow-50');
    expect(lowVelocityFlag).toHaveClass('bg-orange-50');
    expect(spendingSpikeFlag).toHaveClass('bg-red-50');
  });
});
