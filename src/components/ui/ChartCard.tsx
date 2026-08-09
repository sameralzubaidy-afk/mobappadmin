// File: p2p-kids-admin/src/components/ui/ChartCard.tsx
'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { theme } from '@/styles/theme';

type Period = 'Today' | 'This week' | 'This month' | 'This year';
const PERIODS: Period[] = ['Today', 'This week', 'This month', 'This year'];

interface ChartCardProps {
  title:             string;
  /** Show a period dropdown next to the title */
  showPeriodFilter?: boolean;
  onPeriodChange?:  (period: Period) => void;
  /** Height of the chart container in px (default 220) */
  chartHeight?:      number;
  children:          React.ReactNode;
  className?:        string;
  testID?:           string;
}

export function ChartCard({
  title,
  showPeriodFilter = false,
  onPeriodChange,
  chartHeight = 220,
  children,
  className = '',
  testID,
}: ChartCardProps) {
  const [period, setPeriod]   = useState<Period>('This week');
  const [open,   setOpen]     = useState(false);

  function selectPeriod(p: Period) {
    setPeriod(p);
    setOpen(false);
    onPeriodChange?.(p);
  }

  return (
    <div
      data-testid={testID}
      className={`rounded-2xl p-6 flex flex-col gap-4 transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)] ${className}`}
      style={{
        background: theme.colors.card.bg,
        border:     `1px solid ${theme.colors.card.border}`,
        boxShadow:  theme.shadow.card,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
          {title}
        </h3>
        {showPeriodFilter && (
          <div className="relative">
            <button
              onClick={() => setOpen(!open)}
              data-testid={`${testID}-period-filter`}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={{
                background: theme.colors.content.bg,
                color:      theme.colors.text.secondary,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = theme.colors.card.border;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = theme.colors.content.bg;
              }}
            >
              {period}
              <ChevronDown size={14} />
            </button>
            {open && (
              <div
                className="absolute right-0 mt-1 rounded-lg shadow-lg z-10 py-1"
                style={{
                  background: theme.colors.card.bg,
                  border:     `1px solid ${theme.colors.card.border}`,
                  minWidth:   '140px',
                }}
              >
                {PERIODS.map((p) => (
                  <button
                    key={p}
                    onClick={() => selectPeriod(p)}
                    className="w-full text-left px-4 py-2 text-sm transition-colors"
                    style={{
                      color:      p === period ? theme.colors.brand.primary : theme.colors.text.secondary,
                      background: p === period ? theme.colors.content.bg : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (p !== period) {
                        e.currentTarget.style.background = theme.colors.content.bg;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (p !== period) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chart container */}
      <div style={{ height: `${chartHeight}px` }}>
        {children}
      </div>
    </div>
  );
}
