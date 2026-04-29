'use client';

// FILE: p2p-kids-admin/src/app/categories/components/MergeSuggestionModal.tsx
// ADMIN-V3-005: Merge suggestion modal (dropdown of existing categories)
// Module: MODULE-12-ADMIN-V3-CATEGORIES

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { CategorySuggestion, Category } from '../../../types/category';
import { getCategories } from '../../../lib/categoryService';
import { mergeCategorySuggestion } from '../../../lib/categorySuggestionService';

interface MergeSuggestionModalProps {
  suggestion: CategorySuggestion;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function MergeSuggestionModal({
  suggestion,
  onClose,
  onSuccess,
}: MergeSuggestionModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [adminNote, setAdminNote] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await getCategories(false); // Only active categories
      setCategories(data.filter((c) => c.is_active)); // Double-check active filter
    } catch (err: any) {
      console.error('Error loading categories:', err);
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCategoryId) {
      setError('Please select a category');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await mergeCategorySuggestion(
        suggestion.id,
        {
          target_category_id: selectedCategoryId,
          admin_note: adminNote.trim() || null,
        }
      );

      const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
      onSuccess(
        `Suggestion merged into "${selectedCategory?.name || 'category'}" successfully`
      );
      onClose();
    } catch (err: any) {
      console.error('Error merging suggestion:', err);
      setError(err.message || 'Failed to merge suggestion');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return; // Prevent closing while submitting
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleClose}
      data-testid="merge-modal-overlay"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-modal-title"
      >
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2
            id="merge-modal-title"
            className="text-xl font-semibold text-gray-900"
            data-testid="merge-modal-title"
          >
            Merge Into Existing Category
          </h2>
          <button
            onClick={handleClose}
            disabled={submitting}
            data-testid="merge-modal-close"
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} data-testid="merge-form">
          <div className="px-6 py-4 space-y-4">
            {/* Info Card */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Suggestion:</strong> {suggestion.suggested_name}
                <br />
                <strong>Item:</strong> {suggestion.item?.name || 'Unknown'}
                <br />
                This will reassign the item to the selected existing category.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div
                className="p-4 bg-red-50 border border-red-200 rounded-md"
                data-testid="merge-modal-error"
              >
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Category Dropdown */}
            <div>
              <label
                htmlFor="merge-category"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Select Existing Category <span className="text-red-500">*</span>
              </label>
              {loading ? (
                <div className="text-sm text-gray-500">Loading categories...</div>
              ) : categories.length === 0 ? (
                <div className="text-sm text-red-600">
                  No active categories available. Please create a category first.
                </div>
              ) : (
                <select
                  id="merge-category"
                  value={selectedCategoryId}
                  onChange={(e) => {
                    setSelectedCategoryId(e.target.value);
                    setError(null);
                  }}
                  data-testid="merge-category-select"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value="">-- Select a category --</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} ({category.item_count} items)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Admin Note */}
            <div>
              <label
                htmlFor="merge-note"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Admin Note (optional)
              </label>
              <textarea
                id="merge-note"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                data-testid="merge-note"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                maxLength={500}
                placeholder="Reason for merging (optional)"
              />
              <p className="mt-1 text-xs text-gray-500">{adminNote.length}/500 characters</p>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3 bg-gray-50">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              data-testid="merge-form-cancel"
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loading || !selectedCategoryId}
              data-testid="merge-form-submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Merging...' : 'Merge Suggestion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
