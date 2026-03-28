// File: p2p-kids-admin/__tests__/components/ui/ChartCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChartCard } from '@/components/ui/ChartCard';

describe('ChartCard', () => {
  it('should render chart card with title', () => {
    render(
      <ChartCard title="Revenue Chart">
        <div data-testid="mock-chart">Chart Content</div>
      </ChartCard>
    );
    
    expect(screen.getByText('Revenue Chart')).toBeInTheDocument();
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument();
  });

  it('should render children content', () => {
    render(
      <ChartCard title="Test Chart">
        <div>Custom Chart Component</div>
      </ChartCard>
    );
    
    expect(screen.getByText('Custom Chart Component')).toBeInTheDocument();
  });

  it('should not show period filter by default', () => {
    const { container } = render(
      <ChartCard title="Test Chart">
        <div>Chart</div>
      </ChartCard>
    );
    
    expect(container.querySelector('button[class*="period"]')).toBeNull();
  });

  it('should show period filter when showPeriodFilter is true', () => {
    render(
      <ChartCard title="Test Chart" showPeriodFilter={true}>
        <div>Chart</div>
      </ChartCard>
    );
    
    expect(screen.getByText('This week')).toBeInTheDocument(); // Default period
  });

  it('should open period dropdown on filter button click', () => {
    render(
      <ChartCard title="Test Chart" showPeriodFilter={true}>
        <div>Chart</div>
      </ChartCard>
    );
    
    const filterButton = screen.getByText('This week');
    fireEvent.click(filterButton);
    
    // Dropdown options should appear
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('This month')).toBeInTheDocument();
    expect(screen.getByText('This year')).toBeInTheDocument();
  });

  it('should call onPeriodChange when period is selected', () => {
    const onPeriodChange = vi.fn();
    
    render(
      <ChartCard title="Test Chart" showPeriodFilter={true} onPeriodChange={onPeriodChange}>
        <div>Chart</div>
      </ChartCard>
    );
    
    // Open dropdown
    const filterButton = screen.getByText('This week');
    fireEvent.click(filterButton);
    
    // Click on 'This month'
    const monthOption = screen.getByText('This month');
    fireEvent.click(monthOption);
    
    expect(onPeriodChange).toHaveBeenCalledWith('This month');
  });

  it('should update selected period text after selection', () => {
    render(
      <ChartCard title="Test Chart" showPeriodFilter={true}>
        <div>Chart</div>
      </ChartCard>
    );
    
    // Open dropdown
    fireEvent.click(screen.getByText('This week'));
    
    // Select 'Today'
    fireEvent.click(screen.getByText('Today'));
    
    // Button text should update
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('should apply custom chart height', () => {
    const { container } = render(
      <ChartCard title="Test Chart" chartHeight={300}>
        <div>Chart</div>
      </ChartCard>
    );
    
    const chartContainer = container.querySelector('[style*="height"]');
    expect(chartContainer?.getAttribute('style')).toContain('300px');
  });

  it('should apply default chart height when not specified', () => {
    const { container } = render(
      <ChartCard title="Test Chart">
        <div>Chart</div>
      </ChartCard>
    );
    
    const chartContainer = container.querySelector('[style*="height"]');
    expect(chartContainer?.getAttribute('style')).toContain('220px'); // Default
  });

  it('should apply custom testID', () => {
    const { container } = render(
      <ChartCard title="Test Chart" testID="custom-chart-card">
        <div>Chart</div>
      </ChartCard>
    );
    
    const card = container.querySelector('[data-testid="custom-chart-card"]');
    expect(card).toBeTruthy();
  });
});
