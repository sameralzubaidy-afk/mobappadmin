// File: p2p-kids-admin/src/components/spconfig/SPFlowPanel.tsx
// Module: SP Economy Hub — Tab 2 (Flow)
// Purpose: Per-category velocity / gap / cash-flow + anomaly flags.
//          Wraps the existing <SPAnalyticsDashboard> + <DateRangePicker>
//          components and the canonical getSPAnalyticsByCategory service so
//          this is NOT a parallel implementation.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DateRangePicker } from './DateRangePicker';
import { SPAnalyticsDashboard } from './SPAnalyticsDashboard';
import { getSPAnalyticsByCategory } from '@/lib/spConfigCategoryService';
import type { CategorySPAnalytics } from '@/types/category';

export function SPFlowPanel() {
  const router = useRouter();
  const [dateRange, setDateRange] = useState<number>(30);
  const [analytics, setAnalytics] = useState<CategorySPAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - dateRange);
        const data = await getSPAnalyticsByCategory({
          start: start.toISOString(),
          end: end.toISOString(),
        });
        if (!cancelled) setAnalytics(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load category SP analytics',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dateRange]);

  const handleCategoryClick = (categoryId: string) => {
    router.push(`/categories?edit=${categoryId}&tab=sp-config`);
  };

  const handleExportCSV = () => {
    if (analytics.length === 0) {
      alert('No data to export');
      return;
    }
    const headers = [
      'Category ID',
      'Category Name',
      'Velocity',
      'Gap %',
      'Avg Cash Per Trade',
      'Anomaly Flags',
    ];
    const rows = analytics.map((cat) => [
      cat.category_id,
      cat.category_name,
      cat.velocity.toFixed(2),
      cat.gap_percent.toFixed(1),
      cat.avg_cash_per_trade.toFixed(2),
      cat.anomaly_flags.join('; '),
    ]);
    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((cell) =>
            typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell,
          )
          .join(','),
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sp-flow-${dateRange}days-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div data-testid="sp-flow-panel" className="space-y-4">
      <DateRangePicker
        value={dateRange}
        onChange={setDateRange}
        testIdPrefix="sp-flow-date-range"
      />

      {error && (
        <div
          className="rounded-md border border-red-200 bg-red-50 p-4"
          data-testid="sp-flow-error"
        >
          <div className="text-red-800 font-medium">Error loading flow analytics</div>
          <div className="text-red-600 text-sm mt-1">{error}</div>
        </div>
      )}

      <SPAnalyticsDashboard
        analytics={analytics}
        onCategoryClick={handleCategoryClick}
        onExportCSV={handleExportCSV}
        loading={loading}
        dateRange={dateRange}
      />
    </div>
  );
}

export default SPFlowPanel;
