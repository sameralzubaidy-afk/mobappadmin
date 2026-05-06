'use client';

// FILE: p2p-kids-admin/src/app/education/components/ExampleTable.tsx
// MODULE-18 V1 EDU-008: Example Table Component
// Lists all examples with computed SP values

import { useState, useEffect, useCallback } from 'react';
import { Edit, Trash2, AlertCircle } from 'lucide-react';
import type { EducationExample } from '../../../types/education';
import { deleteExample, publishExample, unpublishExample } from '../../../lib/educationExampleService';
import { getCategories } from '../../../lib/categoryService';
import type { Category } from '../../../types/category';

interface ExampleTableProps {
  examples: EducationExample[];
  onEdit: (example: EducationExample) => void;
  onRefresh: () => void;
  onError: (message: string) => void;
}

interface ExampleWithSP extends EducationExample {
  categoryName: string;
  earnSP: number;
  maxUseSP: number;
  isBonus: boolean;
}

export function ExampleTable({ examples, onEdit, onRefresh, onError }: ExampleTableProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [enrichedExamples, setEnrichedExamples] = useState<ExampleWithSP[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deletingExample, setDeletingExample] = useState<EducationExample | null>(null);

  // Load categories on mount
  const loadCategories = useCallback(async () => {
    try {
      const data = await getCategories(true); // Include inactive for admin
      setCategories(data);
    } catch (error: any) {
      console.error('[ExampleTable] Load categories error:', error);
      onError('Failed to load categories');
    }
  }, [onError]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Enrich examples with SP calculations
  const enrichExamples = useCallback(() => {
    const enriched: ExampleWithSP[] = examples.map((example) => {
      const category = categories.find((c) => c.id === example.category_id);

      if (!category) {
        return {
          ...example,
          categoryName: 'Other',
          earnSP: 0,
          maxUseSP: 0,
          isBonus: false,
        };
      }

      const multiplier = parseFloat(String(category.sp_earning_multiplier));
      const cap = parseInt(String(category.sp_spending_cap_percent));
      const price = example.item_price;

      const earnSP = Math.round(price * multiplier);
      const maxUseSP = Math.floor((price * cap) / 100);
      const isBonus = multiplier > 1.10;

      return {
        ...example,
        categoryName: category.name,
        earnSP,
        maxUseSP,
        isBonus,
      };
    });

    setEnrichedExamples(enriched);
  }, [examples, categories]);

  useEffect(() => {
    enrichExamples();
  }, [enrichExamples]);

  const handleDelete = async (example: EducationExample) => {
    if (example.is_published) {
      onError('Cannot delete published examples. Unpublish first.');
      return;
    }

    if (!confirm(`Delete example "${example.item_name}"?`)) {
      return;
    }

    try {
      setActionLoading(example.id);
      await deleteExample(example.id);
      onRefresh();
    } catch (error: any) {
      console.error('[ExampleTable] Delete error:', error);
      onError(error.message || 'Failed to delete example');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublish = async (example: EducationExample) => {
    try {
      setActionLoading(example.id);
      await publishExample(example.id);
      onRefresh();
    } catch (error: any) {
      console.error('[ExampleTable] Publish error:', error);
      onError(error.message || 'Failed to publish example');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnpublish = async (example: EducationExample) => {
    try {
      setActionLoading(example.id);
      await unpublishExample(example.id);
      onRefresh();
    } catch (error: any) {
      console.error('[ExampleTable] Unpublish error:', error);
      onError(error.message || 'Failed to unpublish example');
    } finally {
      setActionLoading(null);
    }
  };

  if (examples.length === 0) {
    return (
      <div
        className="p-8 text-center rounded-lg border"
        style={{
          borderColor: 'var(--border-color)',
          background: 'var(--surface-bg)',
        }}
        data-testid="empty-examples"
      >
        <p style={{ color: 'var(--text-secondary)' }}>No examples yet. Click &quot;Add Example&quot; to create one.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
      <table className="w-full" data-testid="example-table">
        <thead style={{ background: 'var(--surface-bg)' }}>
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Item Name
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Price
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Category
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Earn SP
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Max Use SP
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Status
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {enrichedExamples.map((example, index) => (
            <tr
              key={example.id}
              data-testid={`example-row-${example.id}`}
              className="border-t"
              style={{
                borderColor: 'var(--border-color)',
                background: index % 2 === 0 ? 'white' : 'var(--surface-bg)',
              }}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {example.item_name}
                  </p>
                  {example.isBonus && (
                    <span className="text-xs">⭐</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                ${example.item_price.toFixed(2)}
              </td>
              <td className="px-4 py-3">
                <code className="text-xs px-2 py-1 rounded" style={{ background: 'var(--surface-bg)', color: 'var(--text-secondary)' }}>
                  {example.categoryName}
                </code>
              </td>
              <td className="px-4 py-3">
                <span className="font-medium" style={{ color: 'var(--brand-primary)' }}>
                  {example.earnSP} SP
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="font-medium" style={{ color: 'var(--brand-accent)' }}>
                  {example.maxUseSP} SP
                </span>
              </td>
              <td className="px-4 py-3">
                {example.is_published ? (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded"
                    style={{ background: '#d4edda', color: '#155724' }}
                    data-testid={`status-badge-${example.id}`}
                  >
                    Published
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded"
                    style={{ background: '#fff3cd', color: '#856404' }}
                    data-testid={`status-badge-${example.id}`}
                  >
                    Draft
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(example)}
                    disabled={actionLoading === example.id}
                    data-testid={`btn-edit-${example.id}`}
                    className="p-2 rounded hover:bg-gray-100 transition-colors"
                    title="Edit"
                  >
                    <Edit size={16} style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  {!example.is_published ? (
                    <>
                      <button
                        onClick={() => handlePublish(example)}
                        disabled={actionLoading === example.id}
                        data-testid={`btn-publish-${example.id}`}
                        className="px-3 py-1 text-sm font-medium rounded transition-colors"
                        style={{
                          background: 'var(--brand-primary)',
                          color: 'white',
                        }}
                      >
                        {actionLoading === example.id ? 'Publishing...' : 'Publish'}
                      </button>
                      <button
                        onClick={() => handleDelete(example)}
                        disabled={actionLoading === example.id}
                        data-testid={`btn-delete-${example.id}`}
                        className="p-2 rounded hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} style={{ color: '#dc3545' }} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleUnpublish(example)}
                      disabled={actionLoading === example.id}
                      data-testid={`btn-unpublish-${example.id}`}
                      className="px-3 py-1 text-sm font-medium rounded transition-colors border"
                      style={{
                        borderColor: '#dc3545',
                        color: '#dc3545',
                      }}
                    >
                      Unpublish
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
