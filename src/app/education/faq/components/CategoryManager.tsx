'use client';

// FILE: p2p-kids-admin/src/app/education/faq/components/CategoryManager.tsx
// Panel for managing FAQ category chips: add, rename, delete, reorder.

import { useState } from 'react';
import { Plus, Edit2, Trash2, ChevronUp, ChevronDown, Check, X } from 'lucide-react';
import type { FaqCategory } from '../../../../types/faq';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from '../../../../lib/faqService';

interface CategoryManagerProps {
  categories: FaqCategory[];
  onRefresh: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export function CategoryManager({ categories, onRefresh, onError, onSuccess }: CategoryManagerProps) {
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await createCategory({ name: newName.trim(), sort_order: sorted.length + 1 });
      setNewName('');
      onSuccess(`Category "${newName.trim()}" added`);
      onRefresh();
    } catch (err: any) {
      onError(err.message ?? 'Failed to add category');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (cat: FaqCategory) => {
    setEditId(cat.id);
    setEditName(cat.name);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName('');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setLoadingId(id);
    try {
      await updateCategory(id, { name: editName.trim() });
      onSuccess('Category renamed');
      onRefresh();
      cancelEdit();
    } catch (err: any) {
      onError(err.message ?? 'Failed to rename');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (cat: FaqCategory) => {
    if (!confirm(`Delete category "${cat.name}"? This will fail if it has FAQ items.`)) return;
    setLoadingId(cat.id);
    try {
      await deleteCategory(cat.id);
      onSuccess(`Category "${cat.name}" deleted`);
      onRefresh();
    } catch (err: any) {
      onError(err.message ?? 'Failed to delete category');
    } finally {
      setLoadingId(null);
    }
  };

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    const idx = sorted.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const newOrder = [...sorted];
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];

    setLoadingId(id);
    try {
      await reorderCategories(newOrder.map((c) => c.id));
      onRefresh();
    } catch (err: any) {
      onError(err.message ?? 'Failed to reorder');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Category Chips</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          These appear as filter chips on the mobile Help screen. Each FAQ must belong to one.
        </p>
      </div>

      {/* Category list */}
      <ul className="divide-y divide-gray-100">
        {sorted.map((cat, idx) => {
          const isLoading = loadingId === cat.id;
          const isFirst = idx === 0;
          const isLast = idx === sorted.length - 1;

          return (
            <li
              key={cat.id}
              className={`flex items-center gap-3 px-5 py-3 ${isLoading ? 'opacity-50' : 'hover:bg-gray-50'}`}
            >
              {/* Up/Down */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => handleMove(cat.id, 'up')}
                  disabled={isFirst || isLoading}
                  className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed"
                  data-testid={`btn-faq-cat-up-${cat.id}`}
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => handleMove(cat.id, 'down')}
                  disabled={isLast || isLoading}
                  className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed"
                  data-testid={`btn-faq-cat-down-${cat.id}`}
                >
                  <ChevronDown size={14} />
                </button>
              </div>

              {/* Name / edit inline */}
              {editId === cat.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(cat.id);
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  className="flex-1 rounded border border-blue-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  data-testid={`faq-cat-rename-${cat.id}`}
                />
              ) : (
                <span className="flex-1 text-sm text-gray-800 font-medium">{cat.name}</span>
              )}

              {/* Chip preview */}
              <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                {cat.name}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {editId === cat.id ? (
                  <>
                    <button
                      onClick={() => handleSaveEdit(cat.id)}
                      disabled={isLoading}
                      className="p-1.5 rounded text-green-600 hover:bg-green-50"
                      title="Save"
                      data-testid={`btn-faq-cat-save-${cat.id}`}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-1.5 rounded text-gray-400 hover:bg-gray-100"
                      title="Cancel"
                      data-testid={`btn-faq-cat-cancel-${cat.id}`}
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(cat)}
                      disabled={isLoading}
                      className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Rename"
                      data-testid={`btn-faq-cat-edit-${cat.id}`}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      disabled={isLoading}
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete"
                      data-testid={`btn-faq-cat-delete-${cat.id}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Add new category */}
      <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name…"
            maxLength={50}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="faq-cat-new-name-input"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            data-testid="btn-faq-cat-add"
          >
            <Plus size={15} />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
