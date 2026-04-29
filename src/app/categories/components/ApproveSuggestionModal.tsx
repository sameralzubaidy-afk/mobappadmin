'use client';

// FILE: p2p-kids-admin/src/app/categories/components/ApproveSuggestionModal.tsx
// ADMIN-V3-005: Approve suggestion modal (re-uses CategoryForm)
// Module: MODULE-12-ADMIN-V3-CATEGORIES

import { useState } from 'react';
import { X } from 'lucide-react';
import type { CategorySuggestion, CreateCategoryInput } from '../../../types/category';
import { approveCategorySuggestion } from '../../../lib/categorySuggestionService';
import { CategoryForm } from './CategoryForm';

interface ApproveSuggestionModalProps {
  suggestion: CategorySuggestion;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function ApproveSuggestionModal({
  suggestion,
  onClose,
  onSuccess,
}: ApproveSuggestionModalProps) {
  const [showForm, setShowForm] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFormSuccess = async (categoryData: CreateCategoryInput) => {
    try {
      setSubmitting(true);
      setError(null);

      await approveCategorySuggestion(
        suggestion.id,
        {
          categoryData,
          reassignItem: true, // Always reassign the item to the new category
        }
      );

      onSuccess(
        `Category "${categoryData.name}" created and item reassigned successfully`
      );
      onClose();
    } catch (err: any) {
      console.error('Error approving suggestion:', err);
      setError(err.message || 'Failed to approve suggestion');
      setSubmitting(false);
    }
  };

  const handleFormClose = () => {
    if (submitting) return; // Prevent closing while submitting
    onClose();
  };

  // Prepare pre-filled category data
  const preFillData = {
    name: suggestion.suggested_name,
    description: null,
    icon: null,
    icon_url: null,
    bonus_badge_icon_url: null,
    is_active: true, // Default to active
    sp_earning_multiplier: 1.10, // Default
    sp_spending_cap_percent: 70, // Default
    sp_config_notes: null,
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleFormClose}
      data-testid="approve-modal-overlay"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="approve-modal-title"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2
              id="approve-modal-title"
              className="text-xl font-semibold text-gray-900"
              data-testid="approve-modal-title"
            >
              Approve Category Suggestion
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Review and customize the category before approval. The item will be automatically
              reassigned to the new category.
            </p>
          </div>
          <button
            onClick={handleFormClose}
            disabled={submitting}
            data-testid="approve-modal-close"
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div
            className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md"
            data-testid="approve-modal-error"
          >
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Info Card */}
        <div className="mx-6 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>Suggestion from:</strong>{' '}
            {suggestion.seller?.full_name || suggestion.seller?.email || 'Unknown'}
            <br />
            <strong>Item:</strong> {suggestion.item?.name || 'Unknown'} (ID: {suggestion.item_id}
            )
            <br />
            <strong>Suggested name:</strong> {suggestion.suggested_name}
          </p>
        </div>

        {/* Embedded CategoryForm */}
        {showForm && (
          <div className="p-6">
            <CategoryFormWrapper
              preFillData={preFillData}
              onSubmit={handleFormSuccess}
              onCancel={handleFormClose}
              submitting={submitting}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Wrapper component that uses CategoryForm's internal logic but custom submit
interface CategoryFormWrapperProps {
  preFillData: CreateCategoryInput;
  onSubmit: (data: CreateCategoryInput) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}

function CategoryFormWrapper({
  preFillData,
  onSubmit,
  onCancel,
  submitting,
}: CategoryFormWrapperProps) {
  const [formData, setFormData] = useState<CreateCategoryInput>(preFillData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: keyof CreateCategoryInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name.trim().length === 0) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length < 3 || formData.name.length > 50) {
      newErrors.name = 'Name must be 3-50 characters';
    } else if (!/^[A-Za-z0-9 ]{3,50}$/.test(formData.name)) {
      newErrors.name = 'Name can only contain letters, numbers, and spaces';
    }

    if (formData.description && formData.description.length > 200) {
      newErrors.description = 'Description must be 200 characters or less';
    }

    if (
      formData.sp_earning_multiplier &&
      (formData.sp_earning_multiplier < 1.05 || formData.sp_earning_multiplier > 1.4)
    ) {
      newErrors.sp_earning_multiplier = 'Must be between 1.05 and 1.40';
    }

    if (
      formData.sp_spending_cap_percent &&
      (formData.sp_spending_cap_percent < 50 || formData.sp_spending_cap_percent > 80)
    ) {
      newErrors.sp_spending_cap_percent = 'Must be between 50 and 80';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} data-testid="approve-form">
      {/* Basic Info Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Category Details</h3>

        {/* Name */}
        <div>
          <label
            htmlFor="category-name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="category-name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            data-testid="approve-form-name"
            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 ${
              errors.name
                ? 'border-red-300 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
            maxLength={50}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600" data-testid="name-error">
              {errors.name}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="category-description"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Description (optional)
          </label>
          <textarea
            id="category-description"
            value={formData.description || ''}
            onChange={(e) => handleInputChange('description', e.target.value)}
            data-testid="approve-form-description"
            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 ${
              errors.description
                ? 'border-red-300 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
            rows={3}
            maxLength={200}
          />
          <p className="mt-1 text-xs text-gray-500">
            {(formData.description || '').length}/200 characters
          </p>
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description}</p>
          )}
        </div>

        {/* Active Toggle */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="category-active"
            checked={formData.is_active ?? true}
            onChange={(e) => handleInputChange('is_active', e.target.checked)}
            data-testid="approve-form-active"
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="category-active" className="ml-2 text-sm text-gray-700">
            Active (visible to buyers)
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          data-testid="approve-form-cancel"
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          data-testid="approve-form-submit"
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Approve & Create Category'}
        </button>
      </div>
    </form>
  );
}
