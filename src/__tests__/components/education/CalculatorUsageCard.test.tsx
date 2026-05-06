// FILE: p2p-kids-admin/src/__tests__/components/education/CalculatorUsageCard.test.tsx
// MODULE-18 V1 EDU-009: Unit tests for CalculatorUsageCard

import React from 'react';
import { render, screen } from '@testing-library/react';
import { CalculatorUsageCard } from '../../../components/education/CalculatorUsageCard';

describe('CalculatorUsageCard', () => {
  it('should render empty state when no data', () => {
    render(
      <CalculatorUsageCard
        uses={0}
        uniqueUsers={0}
        priceBucketHistogram={{}}
      />
    );

    expect(screen.getByText('Calculator Usage')).toBeInTheDocument();
    expect(screen.getByText('No data for selected range')).toBeInTheDocument();
  });

  it('should render usage metrics correctly', () => {
    render(
      <CalculatorUsageCard
        uses={350}
        uniqueUsers={180}
        priceBucketHistogram={{ '<10': 50, '10-50': 100, '50-100': 150, '>100': 50 }}
        testID="test-calc"
      />
    );

    expect(screen.getByTestId('test-calc-total-uses')).toHaveTextContent('350');
    expect(screen.getByTestId('test-calc-unique-users')).toHaveTextContent('180');
  });

  it('should render price buckets correctly', () => {
    const histogram = {
      '<10': 50,
      '10-50': 100,
      '50-100': 150,
      '>100': 50,
    };

    render(
      <CalculatorUsageCard
        uses={350}
        uniqueUsers={180}
        priceBucketHistogram={histogram}
        testID="test-calc"
      />
    );

    expect(screen.getByTestId('test-calc-bucket-<10')).toBeInTheDocument();
    expect(screen.getByTestId('test-calc-bucket-10-50')).toBeInTheDocument();
    expect(screen.getByTestId('test-calc-bucket-50-100')).toBeInTheDocument();
    expect(screen.getByTestId('test-calc-bucket->100')).toBeInTheDocument();

    // Check counts
    expect(screen.getAllByText('50')[0]).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('should format bucket labels correctly', () => {
    render(
      <CalculatorUsageCard
        uses={100}
        uniqueUsers={50}
        priceBucketHistogram={{ '<10': 10, '10-50': 20, '50-100': 30, '>100': 40 }}
      />
    );

    expect(screen.getByText('< $10')).toBeInTheDocument();
    expect(screen.getByText('$10-50')).toBeInTheDocument();
    expect(screen.getByText('$50-100')).toBeInTheDocument();
    expect(screen.getByText('> $100')).toBeInTheDocument();
  });

  it('should handle empty histogram', () => {
    render(
      <CalculatorUsageCard
        uses={100}
        uniqueUsers={50}
        priceBucketHistogram={{}}
        testID="test-calc"
      />
    );

    const histogram = screen.getByTestId('test-calc-histogram');
    expect(histogram).toBeInTheDocument();

    // All buckets should show 0
    expect(screen.getByTestId('test-calc-bucket-<10')).toHaveTextContent('0');
    expect(screen.getByTestId('test-calc-bucket-10-50')).toHaveTextContent('0');
  });

  it('should handle large numbers with formatting', () => {
    render(
      <CalculatorUsageCard
        uses={1500}
        uniqueUsers={850}
        priceBucketHistogram={{ '<10': 100 }}
        testID="test-calc"
      />
    );

    expect(screen.getByTestId('test-calc-total-uses')).toHaveTextContent('1,500');
    expect(screen.getByTestId('test-calc-unique-users')).toHaveTextContent('850');
  });

  it('should render all 4 price buckets', () => {
    render(
      <CalculatorUsageCard
        uses={100}
        uniqueUsers={50}
        priceBucketHistogram={{}}
        testID="test-calc"
      />
    );

    const histogram = screen.getByTestId('test-calc-histogram');
    const buckets = histogram.querySelectorAll('[data-testid^="test-calc-bucket-"]');
    expect(buckets).toHaveLength(4);
  });
});
