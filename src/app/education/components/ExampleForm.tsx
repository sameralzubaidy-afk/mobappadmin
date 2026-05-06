'use client';

// FILE: p2p-kids-admin/src/app/education/components/ExampleForm.tsx
// MODULE-18 V1 EDU-008: Example Form Component
// Modal for creating/editing examples with category dropdown

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { EducationExample } from '../../../types/education';
import type { Category } from '../../../types/category';
import {
  createExample,
  updateExample,
} from '../../../lib/educationExampleService';
import { getCategories } from '../../../lib/categoryService';

interface ExampleFormProps {
  example: EducationExample | null; // null = create mode
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function ExampleForm({ example, onClose, onSuccess }: ExampleFormProps) {
  const isEditMode = example !== null;

  const [formData, setFormData] = useState({
    item_name: example?.item_name || '',
    item_price: example?.item_price || 0,
    category_id: example?.category_id || '',
    display_order: example?.display_order || 0,
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const data = await getCategories(true); // Include inactive for admin
      setCategories(data);
    } catch (error: any) {
      console.error('[ExampleForm] Load categories error:', error);
      setErrors({ categories: 'Failed to load categories' });
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Item name: required
    if (!formData.item_name || formData.item_name.trim().length === 0) {
      newErrors.item_name = 'Item name is required';
    }

    // Price: > 0 and <= 10000
    if (formData.item_price <= 0 || formData.item_price > 10000) {
      newErrors.item_price = 'Price must be between $0.01 and $10,000';
    }

    // Category: optional but must be valid if provided
    if (formData.category_id && !categories.find((c) => c.id === formData.category_id)) {
      newErrors.category_id = 'Invalid category selected';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);

      if (isEditMode) {
        await updateExample(example.id, {
          item_name: formData.item_name !== example.item_name ? formData.item_name : undefined,
          item_price: formData.item_price !== example.item_price ? formData.item_price : undefined,
          category_id: formData.category_id !== example.category_id ? formData.category_id : undefined,
          display_order: formData.display_order !== example.display_order ? formData.display_order : undefined,
        });
        onSuccess('Example updated successfully');
      } else {
        await createExample({
          item_name: formData.item_name,
          item_price: formData.item_price,
          category_id: formData.category_id || null,
          display_order: formData.display_order,
        });
        onSuccess('Example created successfully');
      }

      onClose();
    } catch (error: any) {
      console.error('[ExampleForm] Save error:', error);
      setErrors({ submit: error.message || 'Failed to save example' });
    } finally {
      setSubmitting(false);
    }
  };

  // Close modal on Esc key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Calculate preview SP values
  const selectedCategory = categories.find((c) => c.id === formData.category_id);
  const earnSP = selectedCategory
    ? Math.round(formData.item_price * parseFloat(String(selectedCategory.sp_earning_multiplier)))
    : 0;
  const maxUseSP = selectedCategory
    ? Math.floor((formData.item_price * parseInt(String(selectedCategory.sp_spending_cap_percent))) / 100)
    : 0;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="example-form-backdrop"
    >
      {/* Modal Content */}
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="example-form-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            {isEditMode ? 'Edit Example' : 'Create New Example'}
          </h2>
          <button
            onClick={onClose}
            data-testid="btn-close-example-form"
            className="p-2 rounded hover:bg-gray-100 transition-colors"
          >
            <X size={20} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Item Name */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.item_name}
              onChange={(e) => handleInputChange('item_name', e.target.value)}
              data-testid="input-example-item-name"
              className="w-full px-3 py-2 border rounded-lg"
              style={{ borderColor: errors.item_name ? '#dc3545' : 'var(--border-color)' }}
              placeholder="e.g., Nintendo Switch"
            />
            {errors.item_name && (
              <p className="text-xs mt-1" style={{ color: '#dc3545' }}>
                {errors.item_name}
              </p>
            )}
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              Price <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }}>
                $
              </span>
              <input
                type="number"
                value={formData.item_price}
                onChange={(e) => handleInputChange('item_price', parseFloat(e.target.value) || 0)}
                data-testid="input-example-price"
                className="w-full pl-8 pr-3 py-2 border rounded-lg"
                style={{ borderColor: errors.item_price ? '#dc3545' : 'var(--border-color)' }}
                min={0.01}
                max={10000}
                step={0.01}
                placeholder="25.99"
              />
            </div>
            {errors.item_price && (
              <p className="text-xs mt-1" style={{ color: '#dc3545' }}>
                {errors.item_price}
              </p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              Category (optional)
            </label>
            {loadingCategories ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading categories...</p>
            ) : (
              <select
                value={formData.category_id}
                onChange={(e) => handleInputChange('category_id', e.target.value)}
                data-testid="select-example-category"
                className="w-full px-3 py-2 border rounded-lg"
                style={{ borderColor: errors.category_id ? '#dc3545' : 'var(--border-color)' }}
              >
                <option value="">Other (no category)</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {parseFloat(String(category.sp_earning_multiplier)) > 1.10 && ' ⭐'}
                  </option>
                ))}
              </select>
            )}
            {errors.category_id && (
              <p className="text-xs mt-1" style={{ color: '#dc3545' }}>
                {errors.category_id}
              </p>
            )}
          </div>

          {/* SP Preview */}
          {formData.item_price > 0 && formData.category_id && (
            <div
              className="p-4 rounded-lg border"
              style={{ background: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
            >
              <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                SP Preview
              </p>
              <div className="flex gap-6">
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Seller Earns</p>
                  <p className="font-semibold" style={{ color: 'var(--brand-primary)' }}>{earnSP} SP</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Buyer Can Use</p>
                  <p className="font-semibold" style={{ color: 'var(--brand-accent)' }}>{maxUseSP} SP max</p>
                </div>
              </div>
            </div>
          )}

          {/* Display Order */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              Display Order
            </label>
            <input
              type="number"
              value={formData.display_order}
              onChange={(e) => handleInputChange('display_order', parseInt(e.target.value) || 0)}
              data-testid="input-example-display-order"
              className="w-full px-3 py-2 border rounded-lg"
              style={{ borderColor: 'var(--border-color)' }}
              min={0}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Lower numbers appear first
            </p>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div
              className="p-3 rounded-lg border"
              style={{ background: '#f8d7da', borderColor: '#f5c6cb', color: '#721c24' }}
              data-testid="form-error"
            >
              <p className="text-sm">{errors.submit}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              data-testid="btn-cancel-example"
              className="px-4 py-2 rounded-lg font-medium transition-colors"
              style={{
                background: 'var(--surface-bg)',
                color: 'var(--text-secondary)',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingCategories}
              data-testid="btn-save-example"
              className="px-4 py-2 rounded-lg font-medium transition-colors"
              style={{
                background: 'var(--brand-primary)',
                color: 'white',
              }}
            >
              {submitting ? 'Saving...' : 'Save Example'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
