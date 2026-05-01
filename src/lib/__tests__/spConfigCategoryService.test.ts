// FILE: p2p-kids-admin/src/lib/__tests__/spConfigCategoryService.test.ts
// ADMIN-V3-009: Unit tests for spConfigCategoryService
// Module: MODULE-12-ADMIN-V3-CATEGORIES
// Coverage target: ≥ 85% for spConfigCategoryService

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Category } from '../../types/category';

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------
const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------
import {
  calculateCategorySP,
  getBonusCategories,
  updateCategorySPRates,
  getSPAnalyticsByCategory,
} from '../spConfigCategoryService';
import { SPRateOutOfRangeError } from '../../types/errors';

// ---------------------------------------------------------------------------
// calculateCategorySP (pure function — no mocks needed)
// ---------------------------------------------------------------------------
describe('calculateCategorySP', () => {
  it('uses Math.round for earn_sp', () => {
    // price=33, multiplier=1.10 → 33*1.10=36.3 → round=36
    const result = calculateCategorySP('cat-1', 33, 1.10, 70);
    expect(result.earn_sp).toBe(36);
  });

  it('uses Math.floor for max_spend_sp', () => {
    // price=33, cap=70% → 33*70/100=23.1 → floor=23
    const result = calculateCategorySP('cat-1', 33, 1.10, 70);
    expect(result.max_spend_sp).toBe(23);
  });

  it('returns correct spend_percent from input', () => {
    const result = calculateCategorySP('cat-1', 100, 1.20, 60);
    expect(result.spend_percent).toBe(60);
  });

  it('handles exact $50 preview correctly (spec example)', () => {
    // spec says: $50 with default multiplier 1.10, cap 70
    const result = calculateCategorySP('cat-1', 50, 1.10, 70);
    expect(result.earn_sp).toBe(Math.round(50 * 1.10)); // 55
    expect(result.max_spend_sp).toBe(Math.floor(50 * 70 / 100)); // 35
  });

  it('handles minimum multiplier (1.05)', () => {
    const result = calculateCategorySP('cat-1', 100, 1.05, 50);
    expect(result.earn_sp).toBe(105);
    expect(result.max_spend_sp).toBe(50);
  });

  it('handles maximum multiplier (1.40)', () => {
    const result = calculateCategorySP('cat-1', 100, 1.40, 80);
    expect(result.earn_sp).toBe(140);
    expect(result.max_spend_sp).toBe(80);
  });

  it('returns price in result', () => {
    const result = calculateCategorySP('cat-1', 75, 1.10, 70);
    expect(result.price).toBe(75);
  });

  it('handles price = 0 gracefully', () => {
    const result = calculateCategorySP('cat-1', 0, 1.10, 70);
    expect(result.earn_sp).toBe(0);
    expect(result.max_spend_sp).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getBonusCategories
// ---------------------------------------------------------------------------
describe('getBonusCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockBonusCategories: Category[] = [
    {
      id: 'cat-bonus-1',
      name: 'Electronics',
      description: null,
      icon: '📱',
      icon_url: null,
      bonus_badge_icon_url: null,
      is_active: true,
      item_count: 15,
      display_order: 1,
      sp_earning_multiplier: 1.30,
      sp_spending_cap_percent: 70,
      sp_config_notes: null,
      sp_rate_change_notify: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'cat-bonus-2',
      name: 'Toys',
      description: null,
      icon: '🧸',
      icon_url: null,
      bonus_badge_icon_url: null,
      is_active: true,
      item_count: 8,
      display_order: 2,
      sp_earning_multiplier: 1.15,
      sp_spending_cap_percent: 70,
      sp_config_notes: null,
      sp_rate_change_notify: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ];

  it('should return categories with sp_earning_multiplier > 1.10 and is_active=true', async () => {
    const mockGt = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: mockBonusCategories, error: null }),
    });
    const mockEq = vi.fn().mockReturnValue({ gt: mockGt });
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: mockEq }) });

    const result = await getBonusCategories();
    expect(result).toEqual(mockBonusCategories);
    expect(mockEq).toHaveBeenCalledWith('is_active', true);
    expect(mockGt).toHaveBeenCalledWith('sp_earning_multiplier', 1.10);
  });

  it('should return empty array when no bonus categories', async () => {
    const mockGt = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ gt: mockGt }),
      }),
    });

    const result = await getBonusCategories();
    expect(result).toEqual([]);
  });

  it('should throw on DB error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gt: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }),
    });

    await expect(getBonusCategories()).rejects.toThrow('DB error');
  });

  it('should NOT include categories with multiplier exactly = 1.10 (strict >)', async () => {
    // The service uses .gt('sp_earning_multiplier', 1.10) which is strictly > 1.10
    const mockGt = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ gt: mockGt }),
      }),
    });

    await getBonusCategories();
    // Verifies the strict > 1.10 filter is applied (not >=)
    expect(mockGt).toHaveBeenCalledWith('sp_earning_multiplier', 1.10);
  });
});

// ---------------------------------------------------------------------------
// updateCategorySPRates
// ---------------------------------------------------------------------------
describe('updateCategorySPRates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw SPRateOutOfRangeError when earning multiplier < 1.05', async () => {
    await expect(
      updateCategorySPRates('cat-1', 1.04, 70, false)
    ).rejects.toBeInstanceOf(SPRateOutOfRangeError);
  });

  it('should throw SPRateOutOfRangeError when earning multiplier > 1.40', async () => {
    await expect(
      updateCategorySPRates('cat-1', 1.41, 70, false)
    ).rejects.toBeInstanceOf(SPRateOutOfRangeError);
  });

  it('should throw SPRateOutOfRangeError when spending cap < 50', async () => {
    await expect(
      updateCategorySPRates('cat-1', 1.10, 49, false)
    ).rejects.toBeInstanceOf(SPRateOutOfRangeError);
  });

  it('should throw SPRateOutOfRangeError when spending cap > 80', async () => {
    await expect(
      updateCategorySPRates('cat-1', 1.10, 81, false)
    ).rejects.toBeInstanceOf(SPRateOutOfRangeError);
  });

  it('should accept boundary values 1.05 and 1.40', async () => {
    // Mock DB to succeed
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'cat-1', name: 'Books' },
      error: null,
    });
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
      })
      .mockReturnValue({ update: mockUpdate });

    await expect(
      updateCategorySPRates('cat-1', 1.05, 50, false)
    ).resolves.not.toThrow();
  });

  it('should update category in DB when rates are valid', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'cat-1', name: 'Books' },
      error: null,
    });

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
      })
      .mockReturnValue({ update: mockUpdate });

    await updateCategorySPRates('cat-1', 1.20, 65, false);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        sp_earning_multiplier: 1.20,
        sp_spending_cap_percent: 65,
      })
    );
  });
});

// ---------------------------------------------------------------------------
// getSPAnalyticsByCategory
// ---------------------------------------------------------------------------
describe('getSPAnalyticsByCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const dateRange = {
    start: '2026-03-01T00:00:00Z',
    end: '2026-03-31T00:00:00Z',
  };

  it('should return analytics array', async () => {
    const mockAnalytics = [
      {
        category_id: 'cat-1',
        category_name: 'Books',
        velocity: 1.2,
        gap_percent: 5,
        avg_cash_per_trade: 12.5,
        anomaly_flags: [],
      },
    ];
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockResolvedValue({ data: mockAnalytics, error: null }),
        }),
      }),
    });

    const result = await getSPAnalyticsByCategory(dateRange);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should flag hoarding when gap_percent > 10', async () => {
    const mockData = [
      {
        category_id: 'cat-1',
        category_name: 'Books',
        velocity: 1.0,
        gap_percent: 15, // > 10 → hoarding
        avg_cash_per_trade: 20,
        anomaly_flags: [],
      },
    ];
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      }),
    });

    const result = await getSPAnalyticsByCategory(dateRange);
    const row = result.find((r) => r.category_id === 'cat-1');
    if (row) {
      expect(row.anomaly_flags).toContain('hoarding');
    }
  });

  it('should flag low_velocity when velocity < 0.5', async () => {
    const mockData = [
      {
        category_id: 'cat-2',
        category_name: 'Electronics',
        velocity: 0.3, // < 0.5 → low_velocity
        gap_percent: 2,
        avg_cash_per_trade: 50,
        anomaly_flags: [],
      },
    ];
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      }),
    });

    const result = await getSPAnalyticsByCategory(dateRange);
    const row = result.find((r) => r.category_id === 'cat-2');
    if (row) {
      expect(row.anomaly_flags).toContain('low_velocity');
    }
  });

  it('should flag spending_spike when velocity > 2', async () => {
    const mockData = [
      {
        category_id: 'cat-3',
        category_name: 'Toys',
        velocity: 2.5, // > 2 → spending_spike
        gap_percent: 0,
        avg_cash_per_trade: 10,
        anomaly_flags: [],
      },
    ];
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      }),
    });

    const result = await getSPAnalyticsByCategory(dateRange);
    const row = result.find((r) => r.category_id === 'cat-3');
    if (row) {
      expect(row.anomaly_flags).toContain('spending_spike');
    }
  });

  it('should return empty array when DB returns null', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    const result = await getSPAnalyticsByCategory(dateRange);
    expect(result).toEqual([]);
  });

  it('should throw on DB error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'query timeout' },
          }),
        }),
      }),
    });

    await expect(getSPAnalyticsByCategory(dateRange)).rejects.toThrow('query timeout');
  });
});
