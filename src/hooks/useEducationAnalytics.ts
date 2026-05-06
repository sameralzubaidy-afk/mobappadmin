// FILE: p2p-kids-admin/src/hooks/useEducationAnalytics.ts
// MODULE-18 V1 EDU-009: React hook for education analytics with date range state

'use client';

import { useState, useEffect, useCallback } from 'react';
import { getEducationAnalytics, type EducationAnalytics } from '../lib/educationAnalyticsService';

interface UseEducationAnalyticsReturn {
  analytics: EducationAnalytics | null;
  loading: boolean;
  error: string | null;
  selectedDays: number;
  setSelectedDays: (days: number) => void;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching education analytics with date range selection
 * Defaults to last 30 days
 */
export function useEducationAnalytics(): UseEducationAnalyticsReturn {
  const [selectedDays, setSelectedDays] = useState<number>(30);
  const [analytics, setAnalytics] = useState<EducationAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - selectedDays);

      const data = await getEducationAnalytics({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      setAnalytics(data);
    } catch (err: any) {
      console.error('[useEducationAnalytics] Fetch error:', err);
      setError(err.message || 'Failed to load analytics');
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [selectedDays]);

  // Fetch on mount and when selectedDays changes
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    analytics,
    loading,
    error,
    selectedDays,
    setSelectedDays,
    refresh: fetchAnalytics,
  };
}
