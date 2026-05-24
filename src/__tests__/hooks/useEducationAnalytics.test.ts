// FILE: p2p-kids-admin/src/__tests__/hooks/useEducationAnalytics.test.ts
// MODULE-18 V1 EDU-009: Unit tests for useEducationAnalytics hook

import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useEducationAnalytics } from '../../hooks/useEducationAnalytics';
import { getEducationAnalytics } from '../../lib/educationAnalyticsService';

vi.mock('../../lib/educationAnalyticsService');

const mockGetEducationAnalytics = vi.mocked(getEducationAnalytics);

describe('useEducationAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state (30 days)', () => {
    mockGetEducationAnalytics.mockResolvedValue({
      onboarding: { started: 100, completed: 70, skipped: 30, completionRate: 0.7 },
      help: { views: 250, sectionExpansionsByType: {} },
      calculator: { uses: 150, uniqueUsers: 80, priceBucketHistogram: {} },
    });

    const { result } = renderHook(() => useEducationAnalytics());

    expect(result.current.selectedDays).toBe(30);
    expect(result.current.loading).toBe(true);
    expect(result.current.analytics).toBe(null);
  });

  it('should fetch analytics on mount', async () => {
    const mockAnalytics = {
      onboarding: { started: 100, completed: 70, skipped: 30, completionRate: 0.7 },
      help: { views: 250, sectionExpansionsByType: { sp_earning: 50 } },
      calculator: { uses: 150, uniqueUsers: 80, priceBucketHistogram: { '<10': 20 } },
    };

    mockGetEducationAnalytics.mockResolvedValue(mockAnalytics);

    const { result } = renderHook(() => useEducationAnalytics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.analytics).toEqual(mockAnalytics);
    expect(result.current.error).toBe(null);
  });

  it('should refetch when selectedDays changes', async () => {
    const mockAnalytics7 = {
      onboarding: { started: 50, completed: 30, skipped: 20, completionRate: 0.6 },
      help: { views: 100, sectionExpansionsByType: {} },
      calculator: { uses: 80, uniqueUsers: 40, priceBucketHistogram: {} },
    };

    const mockAnalytics30 = {
      onboarding: { started: 100, completed: 70, skipped: 30, completionRate: 0.7 },
      help: { views: 250, sectionExpansionsByType: {} },
      calculator: { uses: 150, uniqueUsers: 80, priceBucketHistogram: {} },
    };

    mockGetEducationAnalytics
      .mockResolvedValueOnce(mockAnalytics30)
      .mockResolvedValueOnce(mockAnalytics7);

    const { result, rerender } = renderHook(() => useEducationAnalytics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.analytics).toEqual(mockAnalytics30);

    // Change to 7 days
    result.current.setSelectedDays(7);

    await waitFor(() => {
      expect(mockGetEducationAnalytics).toHaveBeenCalledTimes(2);
    });

    expect(result.current.analytics).toEqual(mockAnalytics7);
  });

  it('should handle errors gracefully', async () => {
    const mockError = new Error('Network error');
    mockGetEducationAnalytics.mockRejectedValue(mockError);

    const { result } = renderHook(() => useEducationAnalytics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.analytics).toBe(null);
  });

  it('should allow manual refresh', async () => {
    const mockAnalytics = {
      onboarding: { started: 100, completed: 70, skipped: 30, completionRate: 0.7 },
      help: { views: 250, sectionExpansionsByType: {} },
      calculator: { uses: 150, uniqueUsers: 80, priceBucketHistogram: {} },
    };

    mockGetEducationAnalytics.mockResolvedValue(mockAnalytics);

    const { result } = renderHook(() => useEducationAnalytics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Trigger refresh
    await result.current.refresh();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetEducationAnalytics).toHaveBeenCalledTimes(2);
  });

  it('should calculate date range correctly for 7 days', async () => {
    mockGetEducationAnalytics.mockResolvedValue({
      onboarding: { started: 0, completed: 0, skipped: 0, completionRate: 0 },
      help: { views: 0, sectionExpansionsByType: {} },
      calculator: { uses: 0, uniqueUsers: 0, priceBucketHistogram: {} },
    });

    const { result } = renderHook(() => useEducationAnalytics());

    result.current.setSelectedDays(7);

    await waitFor(() => {
      expect(mockGetEducationAnalytics).toHaveBeenCalled();
    });

    const callArgs = mockGetEducationAnalytics.mock.calls[1][0];
    const startDate = new Date(callArgs.startDate);
    const endDate = new Date(callArgs.endDate);

    const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(daysDiff).toBe(7);
  });
});
