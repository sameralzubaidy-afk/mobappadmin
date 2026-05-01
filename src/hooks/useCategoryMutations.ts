// FILE: p2p-kids-admin/src/hooks/useCategoryMutations.ts
// ADMIN-V3-008: React Query mutations for category management
// Module: MODULE-12-ADMIN-V3-CATEGORIES
// Provides optimistic reorder with rollback

'use client';

import { useState, useCallback } from 'react';
import type { Category, CategoryReorderItem } from '../types/category';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryActive,
  reorderCategories,
} from '../lib/categoryService';
import type { CreateCategoryInput, UpdateCategoryInput } from '../types/category';

export type MutationStatus = 'idle' | 'loading' | 'error' | 'success';

interface MutationState {
  status: MutationStatus;
  error: string | null;
}

/**
 * Optimistic reorder state kept locally; rolled back on RPC failure.
 */
export function useCategoryMutations(
  initialCategories: Category[],
  onSuccess: () => void
) {
  const [localCategories, setLocalCategories] = useState<Category[]>(initialCategories);
  const [reorderSnapshot, setReorderSnapshot] = useState<Category[] | null>(null);
  const [mutation, setMutation] = useState<MutationState>({ status: 'idle', error: null });

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------
  const create = useCallback(
    async (input: CreateCategoryInput) => {
      setMutation({ status: 'loading', error: null });
      try {
        await createCategory(input);
        setMutation({ status: 'success', error: null });
        onSuccess();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Create failed';
        setMutation({ status: 'error', error: message });
        throw err;
      }
    },
    [onSuccess]
  );

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------
  const update = useCallback(
    async (id: string, input: UpdateCategoryInput) => {
      setMutation({ status: 'loading', error: null });
      try {
        await updateCategory(id, input);
        setMutation({ status: 'success', error: null });
        onSuccess();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Update failed';
        setMutation({ status: 'error', error: message });
        throw err;
      }
    },
    [onSuccess]
  );

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------
  const remove = useCallback(
    async (id: string) => {
      setMutation({ status: 'loading', error: null });
      try {
        await deleteCategory(id);
        setMutation({ status: 'success', error: null });
        onSuccess();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Delete failed';
        setMutation({ status: 'error', error: message });
        throw err;
      }
    },
    [onSuccess]
  );

  // -------------------------------------------------------------------------
  // Toggle active
  // -------------------------------------------------------------------------
  const toggleActive = useCallback(
    async (id: string, currentIsActive: boolean) => {
      setMutation({ status: 'loading', error: null });
      try {
        await toggleCategoryActive(id, currentIsActive);
        setMutation({ status: 'success', error: null });
        onSuccess();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Toggle failed';
        setMutation({ status: 'error', error: message });
        throw err;
      }
    },
    [onSuccess]
  );

  // -------------------------------------------------------------------------
  // Reorder — optimistic with rollback
  // -------------------------------------------------------------------------
  const reorder = useCallback(
    async (reordered: Category[]) => {
      // Take snapshot for rollback
      const snapshot = [...localCategories];
      setReorderSnapshot(snapshot);

      // Optimistic update
      setLocalCategories(reordered);
      setMutation({ status: 'loading', error: null });

      const payload: CategoryReorderItem[] = reordered.map((cat, idx) => ({
        id: cat.id,
        display_order: idx + 1,
      }));

      try {
        await reorderCategories(payload);
        setMutation({ status: 'success', error: null });
        setReorderSnapshot(null);
      } catch (err: unknown) {
        // Rollback
        setLocalCategories(snapshot);
        const message = err instanceof Error ? err.message : 'Reorder failed';
        setMutation({ status: 'error', error: message });
        throw err;
      }
    },
    [localCategories]
  );

  return {
    localCategories,
    setLocalCategories,
    reorderSnapshot,
    mutation,
    create,
    update,
    remove,
    toggleActive,
    reorder,
  };
}
