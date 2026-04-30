// FILE: p2p-kids-admin/src/__tests__/components/spconfig/DateRangePicker.test.tsx
// Unit tests for DateRangePicker component

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateRangePicker } from '@/components/spconfig/DateRangePicker';

describe('DateRangePicker', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all three date range buttons', () => {
    render(<DateRangePicker value={30} onChange={mockOnChange} />);

    expect(screen.getByText('Last 7 Days')).toBeInTheDocument();
    expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
    expect(screen.getByText('Last 90 Days')).toBeInTheDocument();
  });

  it('should highlight the selected range', () => {
    render(<DateRangePicker value={30} onChange={mockOnChange} />);

    const button30 = screen.getByTestId('date-range-30');
    const button7 = screen.getByTestId('date-range-7');

    expect(button30).toHaveClass('bg-blue-600');
    expect(button7).toHaveClass('bg-gray-100');
  });

  it('should call onChange when a button is clicked', () => {
    render(<DateRangePicker value={30} onChange={mockOnChange} />);

    fireEvent.click(screen.getByTestId('date-range-7'));

    expect(mockOnChange).toHaveBeenCalledWith(7);
    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });

  it('should have proper ARIA attributes', () => {
    render(<DateRangePicker value={30} onChange={mockOnChange} />);

    const button30 = screen.getByTestId('date-range-30');

    expect(button30).toHaveAttribute('aria-label', 'Last 30 Days');
    expect(button30).toHaveAttribute('aria-pressed', 'true');
  });

  it('should use custom test ID prefix when provided', () => {
    render(<DateRangePicker value={30} onChange={mockOnChange} testIdPrefix="custom" />);

    expect(screen.getByTestId('custom-picker')).toBeInTheDocument();
    expect(screen.getByTestId('custom-30')).toBeInTheDocument();
  });
});
