// File: p2p-kids-admin/src/components/health/HealthStatusStrip.tsx
// Admin dashboard — system health strip.
//
// A thin, always-visible row of compact status indicators below the dashboard
// page title (and above the embedded Action Center). Each indicator is a
// colored dot + short label + value; the dot color is derived from
// configurable thresholds (admin_config, category 'health') — see
// src/lib/healthStatus.ts. Clicking an indicator navigates to its detail page.
//
// Visual spec (docx/old/design-system.md):
//   - single-row flex layout, Neutral 100 background (#F5F5F5)
//   - 12px border radius, 16px padding
//   - 8px dots in Success 500 (#4CAF50) / Warning 500 (#FFA726) / Error 500 (#E53935)
//   - labels Body Small (12px) Neutral 700 (#4D4D4D)

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  deriveHealthStatus,
  HEALTH_INDICATOR_META,
  type HealthIndicatorData,
  type HealthStatus,
} from '@/lib/healthStatus';

const DOT_COLORS: Record<HealthStatus, string> = {
  healthy: 'var(--success-500)', // Success 500
  warning: 'var(--warning-500)', // Warning 500
  critical: 'var(--error-500)', // Error 500
};

const LABEL_COLOR = 'var(--text-secondary)'; // Neutral 700 (Body Small)
const MUTED_COLOR = 'var(--text-muted)'; // Neutral 500

const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '';

export default function HealthStatusStrip() {
  const [indicators, setIndicators] = useState<HealthIndicatorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/health', {
        headers: { 'x-admin-secret': adminSecret },
        cache: 'no-store',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to load health (${res.status})`);
      }
      const json = await res.json();
      setIndicators(json.data?.indicators ?? []);
    } catch (err: any) {
      setError(err.message ?? 'We couldn\u2019t load system health.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Loading state — keep the strip's footprint so the layout doesn't jump.
  if (loading) {
    return (
      <div
        data-testid="health-strip"
        className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl px-4 py-4"
        style={{ background: 'var(--neutral-100)' }}
      >
        <span className="text-xs" style={{ color: MUTED_COLOR }}>
          Loading system health…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="health-strip"
        className="flex flex-wrap items-center gap-x-3 rounded-xl px-4 py-4"
        style={{ background: 'var(--neutral-100)' }}
      >
        <span className="text-xs" style={{ color: 'var(--error-500)' }}>
          We couldn&apos;t load system health.
        </span>
        <button
          onClick={load}
          className="text-xs font-medium underline"
          style={{ color: 'var(--text-secondary)' }}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="health-strip"
      className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl px-4 py-4"
      style={{ background: 'var(--neutral-100)' }}
    >
      {HEALTH_INDICATOR_META.map((meta) => {
        const data = indicators.find((i) => i.id === meta.id);
        if (!data) return null;
        const status = deriveHealthStatus(data.value, data.thresholds, meta.direction);
        return (
          <Link
            key={meta.id}
            href={meta.href}
            data-testid={`health-indicator-${meta.id}`}
            className="flex items-center gap-2 hover:opacity-80"
            title={data.detail || meta.label}
          >
            <span
              aria-hidden
              className="inline-block rounded-full"
              style={{
                width: 8,
                height: 8,
                background: DOT_COLORS[status],
              }}
            />
            <span className="text-xs" style={{ color: LABEL_COLOR }}>
              {meta.label}
            </span>
            <span className="text-xs font-semibold" style={{ color: LABEL_COLOR }}>
              {data.display}
            </span>
          </Link>
        );
      })}

      {/* If the RPC returned no data at all, render nothing extra (empty strip). */}
      {indicators.length === 0 && !loading && !error && (
        <span className="text-xs" style={{ color: MUTED_COLOR }}>
          No health data available.
        </span>
      )}
    </div>
  );
}
