// FILE: p2p-kids-admin/src/lib/__tests__/categoryService.test.ts
// ADMIN-V3-009: Unit tests for categoryService
// Module: MODULE-12-ADMIN-V3-CATEGORIES

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateCategoryName,
  checkCategoryUniqueness,
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryActive,
  reorderCategories,
  calculateCategorySPPreview,
  getBonusCategories,
} from '../categoryService';
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '../../types/category';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

describe('categoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateCategoryName', () => {
    it('should reject empty names', () => {
      const result = validateCategoryName('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject names < 3 characters', () => {
      const result = validateCategoryName('ab');
      expect(result.valid).toBe(false);
    });

    it('should reject names > 50 characters', () => {
      const result = validateCategoryName('a'.repeat(51));
      expect(result.valid).toBe(false);
    });

    it('should reject names with special characters', () => {
      const result = validateCategoryName('Books & Toys');
      expect(result.valid).toBe(false);
    });

    it('should accept valid names', () => {
      const result = validateCategoryName('Books');
      expect(result.valid).toBe(true);
    });

    it('should accept names with spaces', () => {
      const result = validateCategoryName('Kids Books');
      expect(result.valid).toBe(true);
    });
  });

  describe('checkCategoryUniqueness', () => {
    it('should return exists=false when no match found', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const result = await checkCategoryUniqueness('New Category');
      expect(result.exists).toBe(false);
    });

    it('should return exists=true with existingId when match found', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'abc-123', name: 'Books' },
              error: null,
            }),
          }),
        }),
      });

      const result = await checkCategoryUniqueness('books');
      expect(result.exists).toBe(true);
      expect(result.existingId).toBe('abc-123');
    });

    it('should exclude specified ID when checking uniqueness', async () => {
      const mockNeq = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            neq: mockNeq,
          }),
        }),
      });

      await checkCategoryUniqueness('Books', 'exclude-id-123');
      expect(mockNeq).toHaveBeenCalledWith('id', 'exclude-id-123');
    });
  });

  describe('getCategories', () => {
    const mockCategories: Category[] = [
      {
        id: 'cat-1',
        name: 'Books',
        description: null,
        icon: '📚',
        icon_url: null,
        bonus_badge_icon_url: null,
        is_active: true,
        item_count: 10,
        display_order: 1,
        sp_earning_multiplier: 1.10,
        sp_spending_cap_percent: 70,
        sp_config_notes: null,
        sp_rate_change_notify: false,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    it('should fetch all categories including inactive by default', async () => {
      const mockOrder = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockCategories, error: null }),
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: mockOrder,
        }),
      });

      const result = await getCategories();
      expect(result).toEqual(mockCategories);
    });

    it('should filter by is_active=true when includeInactive=false', async () => {
      const mockEq = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockCategories, error: null }),
        }),
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: mockEq,
        }),
      });

      await getCategories(false);
      expect(mockEq).toHaveBeenCalledWith('is_active', true);
    });
  });

  describe('createCategory', () => {
    it('should throw error if name validation fails', async () => {
      const input: CreateCategoryInput = {
        name: 'ab', // Too short
        description: 'Test',
      };

      await expect(createCategory(input)).rejects.toThrow();
    });

    it('should throw DuplicateNameError if name already exists', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'existing-id', name: 'Books' },
              error: null,
            }),
          }),
        }),
      });

      const input: CreateCategoryInput = {
        name: 'Books',
      };

      await expect(createCategory(input)).rejects.toThrow('already exists');
    });

    it('should throw SPRateOutOfRangeError if earning multiplier out of bounds', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const input: CreateCategoryInput = {
        name: 'Books',
        sp_earning_multiplier: 1.50, // Out of range
      };

      await expect(createCategory(input)).rejects.toThrow('must be between');
    });

    it('should throw SPRateOutOfRangeError if spending cap out of bounds', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const input: CreateCategoryInput = {
        name: 'Books',
        sp_spending_cap_percent: 90, // Out of range
      };

      await expect(createCategory(input)).rejects.toThrow('must be between');
    });
  });

  describe('deleteCategory', () => {
    it('should throw CategoryNotEmptyError if item_count > 0', async () => {
      const mockCategory: Category = {
        id: 'cat-1',
        name: 'Books',
        description: null,
        icon: null,
        icon_url: null,
        bonus_badge_icon_url: null,
        is_active: true,
        item_count: 5, // Non-zero
        display_order: 1,
        sp_earning_multiplier: 1.10,
        sp_spending_cap_percent: 70,
        sp_config_notes: null,
        sp_rate_change_notify: false,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockCategory, error: null }),
          }),
        }),
      });

      await expect(deleteCategory('cat-1')).rejects.toThrow('5 items');
    });

    it('should throw error when trying to delete "Other" category', async () => {
      const mockCategory: Category = {
        id: 'cat-other',
        name: 'Other',
        description: null,
        icon: null,
        icon_url: null,
        bonus_badge_icon_url: null,
        is_active: true,
        item_count: 0,
        display_order: 999,
        sp_earning_multiplier: 1.10,
        sp_spending_cap_percent: 70,
        sp_config_notes: null,
        sp_rate_change_notify: false,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockCategory, error: null }),
          }),
        }),
      });

      await expect(deleteCategory('cat-other')).rejects.toThrow('Other');
    });
  });

  describe('toggleCategoryActive', () => {
    it('should throw error when trying to deactivate "Other" category', async () => {
      const mockCategory: Category = {
        id: 'cat-other',
        name: 'Other',
        description: null,
        icon: null,
        icon_url: null,
        bonus_badge_icon_url: null,
        is_active: true,
        item_count: 0,
        display_order: 999,
        sp_earning_multiplier: 1.10,
        sp_spending_cap_percent: 70,
        sp_config_notes: null,
        sp_rate_change_notify: false,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockCategory, error: null }),
          }),
        }),
      });

      await expect(toggleCategoryActive('cat-other', false)).rejects.toThrow('Other');
    });
  });

  describe('reorderCategories', () => {
    it('should call reorder RPC with p_category_orders payload', async () => {
      const payload = [{ id: 'cat-1', display_order: 1 }];
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await reorderCategories(payload);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('reorder_categories', {
        p_category_orders: payload,
      });
    });

    it('should map admin role error to user-friendly message', async () => {
      mockSupabase.rpc.mockResolvedValue({
        error: { message: 'Unauthorized: Admin role required' },
      });

      await expect(reorderCategories([{ id: 'cat-1', display_order: 1 }])).rejects.toThrow(
        'Admin role required to reorder categories'
      );
    });
  });

  describe('calculateCategorySPPreview', () => {
    it('should round earn_sp to nearest integer', () => {
      const result = calculateCategorySPPreview(1.15, 70, 50);
      expect(result.earn_sp).toBe(57); // Math.floor(50 * 1.15) = 57
    });

    it('should floor max_spend_sp', () => {
      const result = calculateCategorySPPreview(1.10, 70, 50);
      expect(result.max_spend_sp).toBe(35); // Math.floor(50 * 0.70) = 35
    });

    it('should calculate correctly for $100 item with 1.20× earn and 75% cap', () => {
      const result = calculateCategorySPPreview(1.20, 75, 100);
      expect(result.earn_sp).toBe(120); // Math.round(100 * 1.20)
      expect(result.max_spend_sp).toBe(75); // Math.floor(100 * 0.75)
      expect(result.spend_percent).toBe(75);
    });
  });

  describe('getBonusCategories', () => {
    it('should filter categories with sp_earning_multiplier > 1.10', async () => {
      const mockGt = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: mockGt,
          }),
        }),
      });

      await getBonusCategories();
      expect(mockGt).toHaveBeenCalledWith('sp_earning_multiplier', 1.10);
    });
  });
});
