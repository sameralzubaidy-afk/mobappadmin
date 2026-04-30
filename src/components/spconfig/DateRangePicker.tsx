// FILE: p2p-kids-admin/src/components/spconfig/DateRangePicker.tsx
// ADMIN-V3-006: Reusable date range picker component

'use client';

import React from 'react';

interface DateRangePickerProps {
  /** Current selected days (7, 30, or 90) */
  value: number;
  /** Callback when selection changes */
  onChange: (days: number) => void;
  /** Optional test ID prefix */
  testIdPrefix?: string;
}

/**
 * Date range picker with 7 / 30 / 90 day buttons
 * Defaults to 30 days
 */
export function DateRangePicker({
  value,
  onChange,
  testIdPrefix = 'date-range',
}: DateRangePickerProps) {
  const ranges = [
    { days: 7, label: 'Last 7 Days' },
    { days: 30, label: 'Last 30 Days' },
    { days: 90, label: 'Last 90 Days' },
  ];

  return (
    <div className="flex gap-2" data-testid={`${testIdPrefix}-picker`}>
      {ranges.map(({ days, label }) => (
        <button
          key={days}
          onClick={() => onChange(days)}
          className={`px-4 py-2 rounded-lg transition ${
            value === days
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          data-testid={`${testIdPrefix}-${days}`}
          aria-label={label}
          aria-pressed={value === days}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
