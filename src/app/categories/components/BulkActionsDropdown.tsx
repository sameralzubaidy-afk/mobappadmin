'use client';

// FILE: p2p-kids-admin/src/app/categories/components/BulkActionsDropdown.tsx
// ADMIN-V3-004: Bulk actions dropdown (Activate/Deactivate/Delete/Export)
// Module: MODULE-12-ADMIN-V3-CATEGORIES

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Category } from '../../../types/category';
import { toggleCategoryActive, deleteCategory } from '../../../lib/categoryService';

interface BulkActionsDropdownProps {
  selectedCategories: Category[];
  onActionComplete: () => void;
}

export function BulkActionsDropdown({ selectedCategories, onActionComplete }: BulkActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const canDelete = selectedCategories.every((c) => c.item_count === 0);
  const hasNonEmpty = selectedCategories.some((c) => c.item_count > 0);

  const handleActivate = async () => {
    if (!confirm(`Activate ${selectedCategories.length} categories?`)) return;

    try {
      setProcessing(true);
      for (const category of selectedCategories) {
        if (!category.is_active) {
          await toggleCategoryActive(category.id, true);
        }
      }
      setIsOpen(false);
      onActionComplete();
    } catch (err: any) {
      alert(err.message || 'Failed to activate categories');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeactivate = async () => {
    const nonEmptyCount = selectedCategories.filter((c) => c.item_count > 0).length;
    const message =
      nonEmptyCount > 0
        ? `Deactivate ${selectedCategories.length} categories? ${nonEmptyCount} have items and will be hidden from search.`
        : `Deactivate ${selectedCategories.length} categories?`;

    if (!confirm(message)) return;

    try {
      setProcessing(true);
      for (const category of selectedCategories) {
        if (category.is_active && category.name.toLowerCase() !== 'other') {
          await toggleCategoryActive(category.id, false);
        }
      }
      setIsOpen(false);
      onActionComplete();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate categories');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete) {
      alert('Cannot delete: Some categories have items. Please reassign or delete items first.');
      return;
    }

    if (!confirm(`Delete ${selectedCategories.length} categories? This action cannot be undone.`)) {
      return;
    }

    try {
      setProcessing(true);
      for (const category of selectedCategories) {
        await deleteCategory(category.id);
      }
      setIsOpen(false);
      onActionComplete();
    } catch (err: any) {
      alert(err.message || 'Failed to delete categories');
    } finally {
      setProcessing(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'id',
      'name',
      'description',
      'is_active',
      'item_count',
      'display_order',
      'sp_earning_multiplier',
      'sp_spending_cap_percent',
      'created_at',
    ];

    const rows = selectedCategories.map((c) => [
      c.id,
      `"${c.name.replace(/"/g, '""')}"`,
      c.description ? `"${c.description.replace(/"/g, '""')}"` : '',
      c.is_active,
      c.item_count,
      c.display_order,
      c.sp_earning_multiplier,
      c.sp_spending_cap_percent,
      c.created_at,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `categories-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={processing}
        data-testid="bulk-actions-btn"
        className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center disabled:opacity-50"
      >
        Bulk Actions
        <ChevronDown size={16} className="ml-2" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-10"
          data-testid="bulk-actions-menu"
        >
          <div className="py-1">
            <button
              onClick={handleActivate}
              data-testid="bulk-activate"
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Activate
            </button>
            <button
              onClick={handleDeactivate}
              data-testid="bulk-deactivate"
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Deactivate
              {hasNonEmpty && <span className="text-xs text-gray-500 ml-2">(hides items)</span>}
            </button>
            <button
              onClick={handleDelete}
              disabled={!canDelete}
              data-testid="bulk-delete"
              className={`block w-full text-left px-4 py-2 text-sm ${
                canDelete ? 'text-red-600 hover:bg-red-50' : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              Delete
              {!canDelete && <span className="text-xs text-gray-500 ml-2">(some have items)</span>}
            </button>
            <hr className="my-1" />
            <button
              onClick={handleExportCSV}
              data-testid="bulk-export"
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Export CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
