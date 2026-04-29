'use client';

// FILE: p2p-kids-admin/src/app/categories/components/CategoryTable.tsx
// ADMIN-V3-004: Category table with DnD, inline edit, bulk actions
// Module: MODULE-12-ADMIN-V3-CATEGORIES

import { useEffect, useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CategoryRow } from './CategoryRow';
import { BulkActionsDropdown } from './BulkActionsDropdown';
import type { Category, CategoryReorderItem } from '../../../types/category';
import { reorderCategories, toggleCategoryActive, deleteCategory } from '../../../lib/categoryService';

interface CategoryTableProps {
  categories: Category[];
  onEdit: (category: Category) => void;
  onUpdate: () => void;
}

export function CategoryTable({ categories, onEdit, onUpdate }: CategoryTableProps) {
  const [localCategories, setLocalCategories] = useState(categories);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Keep table rows in sync with filtered categories from parent.
  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = localCategories.findIndex((c) => c.id === active.id);
    const newIndex = localCategories.findIndex((c) => c.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistic update
    const reordered = arrayMove(localCategories, oldIndex, newIndex);
    const reorderPayload: CategoryReorderItem[] = reordered.map((cat: Category, idx: number) => ({
      id: cat.id,
      display_order: idx + 1,
    }));

    setLocalCategories(reordered);
    setReorderError(null);

    try {
      await reorderCategories(reorderPayload);
      onUpdate(); // Refresh from server
    } catch (err: any) {
      console.error('Reorder failed:', err);
      setReorderError(err.message || 'Failed to reorder categories');
      // Rollback
      setLocalCategories(categories);
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === localCategories.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(localCategories.map((c) => c.id)));
    }
  };

  const handleToggleActive = async (category: Category) => {
    try {
      setProcessing(true);
      await toggleCategoryActive(category.id, !category.is_active);
      onUpdate();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle category status');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (category: Category) => {
    if (category.item_count > 0) {
      alert(`Cannot delete: ${category.item_count} items still assigned to this category.`);
      return;
    }

    if (!confirm(`Delete category "${category.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setProcessing(true);
      await deleteCategory(category.id);
      onUpdate();
    } catch (err: any) {
      alert(err.message || 'Failed to delete category');
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkActionComplete = () => {
    setSelectedIds(new Set());
    onUpdate();
  };

  if (localCategories.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <p className="text-gray-600">No categories match your filters.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Reorder Error */}
      {reorderError && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <p className="text-sm text-red-800">{reorderError}</p>
        </div>
      )}

      {/* Bulk Actions Header */}
      {selectedIds.size > 0 && (
        <div className="p-4 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-900">
            {selectedIds.size} categor{selectedIds.size === 1 ? 'y' : 'ies'} selected
          </span>
          <BulkActionsDropdown
            selectedCategories={localCategories.filter((c) => selectedIds.has(c.id))}
            onActionComplete={handleBulkActionComplete}
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="w-10 px-3 py-3"></th>
              <th scope="col" className="w-12 px-3 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.size === localCategories.length && localCategories.length > 0}
                  onChange={handleSelectAll}
                  data-testid="select-all-checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Icon
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Items
              </th>
              <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                SP Earn
              </th>
              <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                SP Spend
              </th>
              <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Active
              </th>
              <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={localCategories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <tbody className="bg-white divide-y divide-gray-200">
                {localCategories.map((category) => (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    selected={selectedIds.has(category.id)}
                    onToggleSelect={handleToggleSelect}
                    onEdit={onEdit}
                    onToggleActive={handleToggleActive}
                    onDelete={handleDelete}
                    disabled={processing}
                  />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>
    </div>
  );
}
