'use client';

// FILE: p2p-kids-admin/src/app/education/faq/components/FAQTable.tsx
// Table displaying all FAQ items with order controls, status toggle, edit & delete.

import { useState } from 'react';
import { Edit2, Trash2, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';
import type { FaqItem, FaqCategory } from '../../../../types/faq';
import { toggleFaqStatus, deleteFaqItem, moveFaqItem } from '../../../../lib/faqService';

interface FAQTableProps {
  items: FaqItem[];
  categories: FaqCategory[];
  onEdit: (item: FaqItem) => void;
  onRefresh: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export function FAQTable({ items, categories, onEdit, onRefresh, onError, onSuccess }: FAQTableProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? '—';

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    setLoadingId(id);
    try {
      await moveFaqItem(items, id, direction);
      onRefresh();
    } catch (err: any) {
      onError(err.message ?? 'Failed to reorder');
    } finally {
      setLoadingId(null);
    }
  };

  const handleToggleStatus = async (item: FaqItem) => {
    setLoadingId(item.id);
    try {
      await toggleFaqStatus(item.id, item.status);
      const next = item.status === 'published' ? 'draft' : 'published';
      onSuccess(`FAQ set to ${next}`);
      onRefresh();
    } catch (err: any) {
      onError(err.message ?? 'Failed to update status');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (item: FaqItem) => {
    if (!confirm(`Delete "${item.question}"? This cannot be undone.`)) return;
    setLoadingId(item.id);
    try {
      await deleteFaqItem(item.id);
      onSuccess('FAQ deleted');
      onRefresh();
    } catch (err: any) {
      onError(err.message ?? 'Failed to delete');
    } finally {
      setLoadingId(null);
    }
  };

  if (sorted.length === 0) {
    return (
      <div className="p-8 text-center rounded-lg border border-gray-200 bg-white">
        <p className="text-gray-500">No FAQ items yet. Click &quot;Add Question&quot; to create one.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="px-4 py-3 text-left w-10">#</th>
            <th className="px-4 py-3 text-left">Question</th>
            <th className="px-4 py-3 text-left w-36">Category</th>
            <th className="px-4 py-3 text-center w-28">Status</th>
            <th className="px-4 py-3 text-center w-24">Order</th>
            <th className="px-4 py-3 text-center w-28">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {sorted.map((item, idx) => {
            const isLoading = loadingId === item.id;
            const isFirst = idx === 0;
            const isLast = idx === sorted.length - 1;
            return (
              <tr key={item.id} className={isLoading ? 'opacity-50' : 'hover:bg-gray-50'}>
                {/* Row number */}
                <td className="px-4 py-3 text-gray-400 font-mono">{idx + 1}</td>

                {/* Question */}
                <td className="px-4 py-3 max-w-xs">
                  <p className="font-medium text-gray-900 truncate">{item.question}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{item.answer}</p>
                </td>

                {/* Category */}
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                    {categoryName(item.category_id)}
                  </span>
                </td>

                {/* Status toggle */}
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggleStatus(item)}
                    disabled={isLoading}
                    title={item.status === 'published' ? 'Click to unpublish' : 'Click to publish'}
                    data-testid={`btn-faq-toggle-status-${item.id}`}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      item.status === 'published'
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                    }`}
                  >
                    {item.status === 'published' ? (
                      <><Eye size={11} /> Published</>
                    ) : (
                      <><EyeOff size={11} /> Draft</>
                    )}
                  </button>
                </td>

                {/* Up / Down */}
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => handleMove(item.id, 'up')}
                      disabled={isFirst || isLoading}
                      className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                      data-testid={`btn-faq-move-up-${item.id}`}
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      onClick={() => handleMove(item.id, 'down')}
                      disabled={isLast || isLoading}
                      className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                      data-testid={`btn-faq-move-down-${item.id}`}
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                </td>

                {/* Edit / Delete */}
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onEdit(item)}
                      disabled={isLoading}
                      className="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Edit"
                      data-testid={`btn-faq-edit-${item.id}`}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={isLoading}
                      className="p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete"
                      data-testid={`btn-faq-delete-${item.id}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
