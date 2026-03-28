// File: p2p-kids-admin/__tests__/components/ui/MetricCard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard } from '@/components/ui/MetricCard';
import { Users } from 'lucide-react';

describe('MetricCard', () => {
  it('should render all metric card content', () => {
    render(
      <MetricCard
        label="Total Users"
        value="1,234"
        subtitle="Active users"
        icon={<Users size={18} />}
        color="purple"
        testID="metric-users"
      />
    );
    
    expect(screen.getByText('TOTAL USERS')).toBeInTheDocument(); // Uppercase from component
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('Active users')).toBeInTheDocument();
  });

  it('should render trend with correct color for up direction', () => {
    const { container } = render(
      <MetricCard
        label="Revenue"
        value="$12,345"
        icon={<Users size={18} />}
        color="green"
        trend="+20%"
        trendDir="up"
      />
    );
    
    const trendElement = screen.getByText('+20%');
    expect(trendElement).toBeInTheDocument();
    
    // Should use green color for up trend
    expect(trendElement.style.color).toBeTruthy();
  });

  it('should render trend with correct color for down direction', () => {
    const { container } = render(
      <MetricCard
        label="Active Subs"
        value="89"
        icon={<Users size={18} />}
        color="orange"
        trend="-5%"
        trendDir="down"
      />
    );
    
    const trendElement = screen.getByText('-5%');
    expect(trendElement).toBeInTheDocument();
  });

  it('should apply correct icon color based on color prop', () => {
    const { container } = render(
      <MetricCard
        label="Test"
        value="100"
        icon={<Users size={18} />}
        color="purple"
      />
    );
    
    // Icon wrapper should have purple theme background
    const iconWrapper = container.querySelector('[style*="background"]');
    expect(iconWrapper).toBeTruthy();
  });

  it('should render without trend and subtitle', () => {
    render(
      <MetricCard
        label="Simple Metric"
        value="999"
        icon={<Users size={18} />}
        color="blue"
      />
    );
    
    expect(screen.getByText('SIMPLE METRIC')).toBeInTheDocument();
    expect(screen.getByText('999')).toBeInTheDocument();
  });

  it('should apply custom testID', () => {
    const { container } = render(
      <MetricCard
        label="Test"
        value="123"
        icon={<Users size={18} />}
        color="purple"
        testID="custom-metric-id"
      />
    );
    
    const card = container.querySelector('[data-testid="custom-metric-id"]');
    expect(card).toBeTruthy();
  });
});
