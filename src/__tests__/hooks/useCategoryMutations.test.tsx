// FILE: p2p-kids-admin/src/__tests__/hooks/useCategoryMutations.test.tsx
// ADMIN-V3-009: Unit tests for useCategoryMutations hook
// Module: MODULE-12-ADMIN-V3-CATEGORIES

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock service functions
// ---------------------------------------------------------------------------
const mockCreateCategory = vi.fn();
const mockUpdateCategory = vi.fn();
const mockDeleteCategory = vi.fn();
const mockToggleCategoryActive = vi.fn();
const mockReorderCategories = vi.fn();

vi.mock('../../lib/categoryService', () => ({
  createCategory: (...args: unknown[]) => mockCreateCategory(...args),
  updateCategory: (...args: unknown[]) => mockUpdateCategory(...args),
  deleteCategory: (...args: unknown[]) => mockDeleteCategory(...args),
  toggleCategoryActive: (...args: unknown[]) => mockToggleCategoryActive(...args),
  reorderCategories: (...args: unknown[]) => mockReorderCategories(...args),
}));

import { useCategoryMutations } from '../../hooks/useCategoryMutations';
import type { Category } from '../../types/category';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const makeCategory = (overrides: Partial<Category> = {}): Category => ({
  id: 'cat-1',
  name: 'Books',
  description: null,
  icon: '📚',
  icon_url: null,
  bonus_badge_icon_url: null,
  is_active: true,
  item_count: 5,
  display_order: 1,
  sp_earning_multiplier: 1.10,
  sp_spending_cap_percent: 70,
  sp_config_notes: null,
  sp_rate_change_notify: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const mockCategories: Category[] = [
  makeCategory({ id: 'cat-1', name: 'Books', display_order: 1 }),
  makeCategory({ id: 'cat-2', name: 'Toys', display_order: 2 }),
  makeCategory({ id: 'cat-3', name: 'Clothes', display_order: 3 }),
];

describe('useCategoryMutations', () => {
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Reorder — optimistic update
  // -------------------------------------------------------------------------
  describe('reorder', () => {
    it('should optimistically reorder local categories before RPC resolves', async () => {
      mockReorderCategories.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useCategoryMutations(mockCategories, mockOnSuccess)
      );

      const reordered = [
        mockCategories[2], // Clothes first
        mockCategories[0], // Books second
        mockCategories[1], // Toys third
      ];

      await act(async () => {
        await result.current.reorder(reordered);
      });

      expect(result.current.localCategories[0].name).toBe('Clothes');
      expect(result.current.localCategories[1].name).toBe('Books');
      expect(result.current.localCategories[2].name).toBe('Toys');
    });

    it('should pass display_order payload to reorderCategories RPC', async () => {
      mockReorderCategories.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useCategoryMutations(mockCategories, mockOnSuccess)
      );

      const reordered = [mockCategories[1], mockCategories[0], mockCategories[2]];

      await act(async () => {
        await result.current.reorder(reordered);
      });

      expect(mockReorderCategories).toHaveBeenCalledWith([
        { id: 'cat-2', display_order: 1 },
        { id: 'cat-1', display_order: 2 },
        { id: 'cat-3', display_order: 3 },
      ]);
    });

    it('should roll back to snapshot on RPC failure', async () => {
      mockReorderCategories.mockRejectedValue(new Error('RPC error'));

      const { result } = renderHook(() =>
        useCategoryMutations(mockCategories, mockOnSuccess)
      );

      const originalOrder = [...result.current.localCategories];
      const reordered = [mockCategories[2], mockCategories[0], mockCategories[1]];

      await act(async () => {
        try {
          await result.current.reorder(reordered);
        } catch {
          // Expected error
        }
      });

      // Should be rolled back to original order
      expect(result.current.localCategories.map((c) => c.id)).toEqual(
        originalOrder.map((c) => c.id)
      );
    });

    it('should set status=error on reorder failure', async () => {
      mockReorderCategories.mockRejectedValue(new Error('Unauthorized'));

      const { result } = renderHook(() =>
        useCategoryMutations(mockCategories, mockOnSuccess)
      );

      await act(async () => {
        try {
          await result.current.reorder([...mockCategories].reverse());
        } catch {
          // Expected
        }
      });

      expect(result.current.mutation.status).toBe('error');
      expect(result.current.mutation.error).toBe('Unauthorized');
    });

    it('should set status=success after successful reorder', async () => {
      mockReorderCategories.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useCategoryMutations(mockCategories, mockOnSuccess)
      );

      await act(async () => {
        await result.current.reorder([...mockCategories]);
      });

      expect(result.current.mutation.status).toBe('success');
      expect(result.current.mutation.error).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------
  describe('create', () => {
    it('should call createCategory and invoke onSuccess', async () => {
      mockCreateCategory.mockResolvedValue({ id: 'cat-new', name: 'Art' });

      const { result } = renderHook(() =>
        useCategoryMutations(mockCategories, mockOnSuccess)
      );

      await act(async () => {
        await result.current.create({ name: 'Art' });
      });

      expect(mockCreateCategory).toHaveBeenCalledWith({ name: 'Art' });
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('should set status=error when create fails', async () => {
      mockCreateCategory.mockRejectedValue(new Error('Duplicate name'));

      const { result } = renderHook(() =>
        useCategoryMutations(mockCategories, mockOnSuccess)
      );

      await act(async () => {
        try {
          await result.current.create({ name: 'Books' });
        } catch {
          // Expected
        }
      });

      expect(result.current.mutation.status).toBe('error');
      expect(result.current.mutation.error).toBe('Duplicate name');
    });
  });

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------
  describe('update', () => {
    it('should call updateCategory with id and input', async () => {
      mockUpdateCategory.mockResolvedValue({ id: 'cat-1', name: 'Updated Books' });

      const { result } = renderHook(() =>
        useCategoryMutations(mockCategories, mockOnSuccess)
      );

      await act(async () => {
        await result.current.update('cat-1', { name: 'Updated Books' });
      });

      expect(mockUpdateCategory).toHaveBeenCalledWith('cat-1', { name: 'Updated Books' });
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------
  describe('remove', () => {
    it('should call deleteCategory and invoke onSuccess', async () => {
      mockDeleteCategory.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useCategoryMutations(mockCategories, mockOnSuccess)
      );

      await act(async () => {
        await result.current.remove('cat-1');
      });

      expect(mockDeleteCategory).toHaveBeenCalledWith('cat-1');
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('should set error when delete fails', async () => {
      mockDeleteCategory.mockRejectedValue(new Error('Category not empty'));

      const { result } = renderHook(() =>
        useCategoryMutations(mockCategories, mockOnSuccess)
      );

      await act(async () => {
        try {
          await result.current.remove('cat-1');
        } catch {
          // Expected
        }
      });

      expect(result.current.mutation.status).toBe('error');
    });
  });

  // -------------------------------------------------------------------------
  // Toggle active
  // -------------------------------------------------------------------------
  describe('toggleActive', () => {
    it('should call toggleCategoryActive with id and current state', async () => {
      mockToggleCategoryActive.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useCategoryMutations(mockCategories, mockOnSuccess)
      );

      await act(async () => {
        await result.current.toggleActive('cat-1', true);
      });

      expect(mockToggleCategoryActive).toHaveBeenCalledWith('cat-1', true);
    });
  });
});
