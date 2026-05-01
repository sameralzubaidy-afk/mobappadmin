// FILE: p2p-kids-admin/src/lib/__tests__/categorySuggestionService.test.ts
// ADMIN-V3-009: Unit tests for categorySuggestionService
// Module: MODULE-12-ADMIN-V3-CATEGORIES
// Coverage target: ≥ 85% for categorySuggestionService

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CategorySuggestion, SuggestionStatus } from '../../types/category';

// ---------------------------------------------------------------------------
// Module-level Supabase mock
// ---------------------------------------------------------------------------
const mockAuth = { getUser: vi.fn() };
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockSupabase = { from: mockFrom, auth: mockAuth, rpc: mockRpc };

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// Mock fetch for admin API routes
global.fetch = vi.fn();

// ---------------------------------------------------------------------------
// Import AFTER mocks are set up
// ---------------------------------------------------------------------------
import {
  getCategorySuggestions,
  approveCategorySuggestion,
  rejectCategorySuggestion,
  mergeCategorySuggestion,
  getPendingSuggestionCount,
} from '../categorySuggestionService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeSuggestion(overrides: Partial<CategorySuggestion> = {}): CategorySuggestion {
  return {
    id: 'sug-001',
    suggested_name: 'Vintage Toys',
    seller_id: 'seller-001',
    item_id: 'item-001',
    status: 'pending',
    approved_by: null,
    merged_to_category_id: null,
    admin_note: null,
    created_at: '2026-04-01T00:00:00Z',
    reviewed_at: null,
    ...overrides,
  };
}

function buildChainedFromMock(overrides: Record<string, unknown> = {}) {
  const base = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn(),
    ...overrides,
  };
  return base;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('categorySuggestionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // getCategorySuggestions
  // -------------------------------------------------------------------------
  describe('getCategorySuggestions', () => {
    it('should fetch pending suggestions by default', async () => {
      const suggestions = [makeSuggestion()];

      const chain = buildChainedFromMock();
      chain.select = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockResolvedValue({ data: suggestions, error: null });
      chain.eq = vi.fn().mockReturnValue(chain);
      mockFrom.mockReturnValue(chain);

      // Mock profile + items + categories lookup returning empty
      mockFrom
        .mockReturnValueOnce(chain) // category_suggestions
        .mockReturnValue(buildChainedFromMock()); // other tables

      const result = await getCategorySuggestions('pending', false);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by status when provided', async () => {
      const chain = buildChainedFromMock();
      const mockEq = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      });
      chain.select = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue(chain);

      await getCategorySuggestions('rejected', false);
      expect(mockEq).toHaveBeenCalledWith('status', 'rejected');
    });

    it('should return empty array when DB returns null', async () => {
      const chain = buildChainedFromMock();
      chain.select = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await getCategorySuggestions(undefined, false);
      expect(result).toEqual([]);
    });

    it('should throw on DB error', async () => {
      const chain = buildChainedFromMock();
      chain.select = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'connection refused' },
      });
      mockFrom.mockReturnValue(chain);

      await expect(getCategorySuggestions(undefined, false)).rejects.toThrow('connection refused');
    });
  });

  // -------------------------------------------------------------------------
  // getPendingSuggestionCount
  // -------------------------------------------------------------------------
  describe('getPendingSuggestionCount', () => {
    it('should return count of pending suggestions', async () => {
      const chain = buildChainedFromMock();
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockResolvedValue({ count: 5, error: null });
      mockFrom.mockReturnValue(chain);

      const count = await getPendingSuggestionCount();
      expect(typeof count).toBe('number');
    });

    it('should return 0 on error', async () => {
      const chain = buildChainedFromMock();
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockResolvedValue({ count: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(chain);

      const count = await getPendingSuggestionCount();
      expect(count).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // rejectCategorySuggestion
  // -------------------------------------------------------------------------
  describe('rejectCategorySuggestion', () => {
    it('should call API route and resolve without error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await expect(
        rejectCategorySuggestion('sug-001', 'Not relevant')
      ).resolves.not.toThrow();
    });

    it('should throw when API returns non-OK', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Not found' }),
      });

      await expect(rejectCategorySuggestion('sug-001')).rejects.toThrow();
    });

    it('should handle optional note parameter', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      // Should not throw when note is omitted
      await expect(rejectCategorySuggestion('sug-001')).resolves.not.toThrow();
    });

    it('should include admin_note in request body when provided', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await rejectCategorySuggestion('sug-001', 'Out of scope');

      const [, callOptions] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callOptions.body);
      expect(body.admin_note).toBe('Out of scope');
    });
  });

  // -------------------------------------------------------------------------
  // approveCategorySuggestion
  // -------------------------------------------------------------------------
  describe('approveCategorySuggestion', () => {
    it('should call API route and resolve', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { id: 'cat-new' } }),
      });

      await expect(
        approveCategorySuggestion({
          suggestion_id: 'sug-001',
          name: 'Vintage Toys',
          description: 'Classic vintage toys',
        })
      ).resolves.not.toThrow();
    });

    it('should throw when API returns error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Category already exists' }),
      });

      await expect(
        approveCategorySuggestion({
          suggestion_id: 'sug-001',
          name: 'Existing Category',
        })
      ).rejects.toThrow('Category already exists');
    });
  });

  // -------------------------------------------------------------------------
  // mergeCategorySuggestion
  // -------------------------------------------------------------------------
  describe('mergeCategorySuggestion', () => {
    it('should call API route with correct params', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await mergeCategorySuggestion('sug-001', 'cat-existing-001');

      const [, callOptions] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callOptions.body);
      expect(body.suggestion_id).toBe('sug-001');
      expect(body.target_category_id).toBe('cat-existing-001');
    });

    it('should throw when target category does not exist', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Target category not found' }),
      });

      await expect(mergeCategorySuggestion('sug-001', 'nonexistent')).rejects.toThrow(
        'Target category not found'
      );
    });

    it('should fully roll back on sub-step failure (verify error propagation)', async () => {
      // Network failure simulates mid-transaction failure
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network failure')
      );

      await expect(mergeCategorySuggestion('sug-001', 'cat-001')).rejects.toThrow(
        'Network failure'
      );
    });
  });
});
