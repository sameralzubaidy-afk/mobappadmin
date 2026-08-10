'use client';

// FILE: p2p-kids-admin/src/app/categories/components/CategoryForm.tsx
// ADMIN-V3-004: 3-tab category form modal (Basic Info / Icon & Badge / SP Config)
// Module: MODULE-12-ADMIN-V3-CATEGORIES

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '../../../types/category';
import {
  createCategory,
  updateCategory,
  uploadCategoryIcon,
  validateCategoryName,
  checkCategoryUniqueness,
  calculateCategorySPPreview,
} from '../../../lib/categoryService';

interface CategoryFormProps {
  category: Category | null; // null = create mode, non-null = edit mode
  onClose: () => void;
  onSuccess: (message: string) => void;
}

type FormTab = 'basic' | 'icon' | 'sp';

export function CategoryForm({ category, onClose, onSuccess }: CategoryFormProps) {
  const isEditMode = category !== null;

  const [activeTab, setActiveTab] = useState<FormTab>('basic');
  const [formData, setFormData] = useState({
    name: category?.name || '',
    description: category?.description || '',
    icon: category?.icon || '',
    icon_url: category?.icon_url || '',
    bonus_badge_icon_url: category?.bonus_badge_icon_url || '',
    is_active: category?.is_active ?? true,
    sp_earning_multiplier: category?.sp_earning_multiplier || 1.10,
    sp_spending_cap_percent: category?.sp_spending_cap_percent || 50,
    sp_redemption_cap: category?.sp_redemption_cap ?? null,
    sp_config_notes: category?.sp_config_notes || '',
    sp_rate_change_notify: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [nameCheckPending, setNameCheckPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [bonusBadgeFile, setBonusBadgeFile] = useState<File | null>(null);

  // Debounced uniqueness check
  useEffect(() => {
    if (!formData.name || formData.name === category?.name) {
      setErrors((prev) => ({ ...prev, name: '' }));
      return;
    }

    setNameCheckPending(true);
    const timer = setTimeout(async () => {
      const validation = validateCategoryName(formData.name);
      if (!validation.valid) {
        setErrors((prev) => ({ ...prev, name: validation.error! }));
        setNameCheckPending(false);
        return;
      }

      const { exists } = await checkCategoryUniqueness(formData.name, category?.id);
      if (exists) {
        setErrors((prev) => ({ ...prev, name: 'A category with this name already exists' }));
      } else {
        setErrors((prev) => ({ ...prev, name: '' }));
      }
      setNameCheckPending(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [formData.name, category?.id, category?.name]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (type: 'category' | 'bonus_badge', file: File | null) => {
    if (type === 'category') {
      setIconFile(file);
    } else {
      setBonusBadgeFile(file);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Basic tab
    if (!formData.name || formData.name.trim().length === 0) {
      newErrors.name = 'Name is required';
    }

    if (formData.description && formData.description.length > 200) {
      newErrors.description = 'Description must be 200 characters or less';
    }

    // SP config tab
    if (formData.sp_earning_multiplier < 1.05 || formData.sp_earning_multiplier > 1.40) {
      newErrors.sp_earning_multiplier = 'Must be between 1.05 and 1.40';
    }

    if (formData.sp_spending_cap_percent < 50 || formData.sp_spending_cap_percent > 80) {
      newErrors.sp_spending_cap_percent = 'Must be between 50 and 80';
    }

    if (
      formData.sp_redemption_cap !== null &&
      formData.sp_redemption_cap !== undefined &&
      (formData.sp_redemption_cap < 0 || formData.sp_redemption_cap > 1000)
    ) {
      newErrors.sp_redemption_cap = 'Must be between 0 and 1000, or empty for no absolute cap';
    }

    if (formData.sp_config_notes && formData.sp_config_notes.length > 500) {
      newErrors.sp_config_notes = 'Notes must be 500 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      setActiveTab('basic'); // Show errors on first tab
      return;
    }

    // Final guard before save: run the same name validation server check synchronously.
    // This keeps submit reliable even if the debounce timer is still running.
    const validation = validateCategoryName(formData.name);
    if (!validation.valid) {
      setErrors((prev) => ({ ...prev, name: validation.error || 'Invalid category name' }));
      setActiveTab('basic');
      return;
    }

    const { exists } = await checkCategoryUniqueness(formData.name, category?.id);
    if (exists) {
      setErrors((prev) => ({ ...prev, name: 'A category with this name already exists' }));
      setActiveTab('basic');
      return;
    }

    try {
      setSubmitting(true);
      let savedCategory: Category;
      let iconUploads = 0;

      if (isEditMode) {
        const updatePayload: UpdateCategoryInput = {
          name: formData.name !== category.name ? formData.name : undefined,
          description: formData.description !== category.description ? formData.description : undefined,
          icon: formData.icon !== category.icon ? formData.icon : undefined,
          icon_url: formData.icon_url !== category.icon_url ? formData.icon_url : undefined,
          bonus_badge_icon_url:
            formData.bonus_badge_icon_url !== category.bonus_badge_icon_url
              ? formData.bonus_badge_icon_url
              : undefined,
          is_active: formData.is_active !== category.is_active ? formData.is_active : undefined,
          sp_earning_multiplier:
            formData.sp_earning_multiplier !== category.sp_earning_multiplier
              ? formData.sp_earning_multiplier
              : undefined,
          sp_spending_cap_percent:
            formData.sp_spending_cap_percent !== category.sp_spending_cap_percent
              ? formData.sp_spending_cap_percent
              : undefined,
          sp_redemption_cap:
            formData.sp_redemption_cap !== category.sp_redemption_cap
              ? formData.sp_redemption_cap
              : undefined,
          sp_config_notes:
            formData.sp_config_notes !== category.sp_config_notes ? formData.sp_config_notes : undefined,
          sp_rate_change_notify: formData.sp_rate_change_notify || undefined,
        };

        const hasUpdate = Object.values(updatePayload).some((value) => value !== undefined);
        if (hasUpdate) {
          savedCategory = await updateCategory(category.id, updatePayload);
        } else {
          savedCategory = category;
        }
      } else {
        const createPayload: CreateCategoryInput = {
          name: formData.name,
          description: formData.description || null,
          icon: formData.icon || null,
          icon_url: formData.icon_url || null,
          bonus_badge_icon_url: formData.bonus_badge_icon_url || null,
          is_active: formData.is_active,
          sp_earning_multiplier: formData.sp_earning_multiplier,
          sp_spending_cap_percent: formData.sp_spending_cap_percent,
          sp_redemption_cap: formData.sp_redemption_cap ?? null,
          sp_config_notes: formData.sp_config_notes || null,
        };

        savedCategory = await createCategory(createPayload);
      }

      if (iconFile) {
        await uploadCategoryIcon(savedCategory.id, iconFile, 'category');
        iconUploads += 1;
      }

      if (bonusBadgeFile) {
        await uploadCategoryIcon(savedCategory.id, bonusBadgeFile, 'bonus_badge');
        iconUploads += 1;
      }

      if (isEditMode) {
        onSuccess(
          iconUploads > 0
            ? `Category updated successfully (${iconUploads} icon upload${iconUploads > 1 ? 's' : ''})`
            : 'Category updated successfully'
        );
      } else {
        onSuccess(
          iconUploads > 0
            ? `Category created successfully (${iconUploads} icon upload${iconUploads > 1 ? 's' : ''})`
            : 'Category created successfully'
        );
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  const previewData = calculateCategorySPPreview(
    formData.sp_earning_multiplier,
    formData.sp_spending_cap_percent,
    50 // $50 sample price
  );

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      data-testid="category-form-modal"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900" data-testid="form-title">
            {isEditMode ? 'Edit Category' : 'Create Category'}
          </h2>
          <button
            onClick={onClose}
            data-testid="close-btn"
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Form tabs">
            <button
              onClick={() => setActiveTab('basic')}
              data-testid="tab-basic"
              className={`${
                activeTab === 'basic'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Basic Info
            </button>
            <button
              onClick={() => setActiveTab('icon')}
              data-testid="tab-icon"
              className={`${
                activeTab === 'icon'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Icon & Badge
            </button>
            <button
              onClick={() => setActiveTab('sp')}
              data-testid="tab-sp"
              className={`${
                activeTab === 'sp'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              SP Config
            </button>
          </nav>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Category Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    data-testid="input-name"
                    className={`w-full px-4 py-2 border ${
                      errors.name ? 'border-red-500' : 'border-gray-300'
                    } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    placeholder="e.g., Books, Toys, Electronics"
                    maxLength={50}
                  />
                  {nameCheckPending && <p className="text-xs text-gray-500 mt-1">Checking availability...</p>}
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                  <p className="text-xs text-gray-500 mt-1">3–50 characters, letters, numbers, and spaces only</p>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    data-testid="input-description"
                    className={`w-full px-4 py-2 border ${
                      errors.description ? 'border-red-500' : 'border-gray-300'
                    } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    placeholder="Optional description (max 200 characters)"
                    rows={3}
                    maxLength={200}
                  />
                  {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
                  <p className="text-xs text-gray-500 mt-1">{formData.description.length}/200 characters</p>
                </div>

                <div className="flex items-center">
                  <input
                    id="is_active"
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => handleInputChange('is_active', e.target.checked)}
                    data-testid="input-active"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                    Active (visible to buyers)
                  </label>
                </div>
              </>
            )}

            {/* Icon & Badge Tab */}
            {activeTab === 'icon' && (
              <>
                <div>
                  <label htmlFor="icon" className="block text-sm font-medium text-gray-700 mb-2">
                    Icon (Emoji or Icon Name)
                  </label>
                  <input
                    id="icon"
                    type="text"
                    value={formData.icon}
                    onChange={(e) => handleInputChange('icon', e.target.value)}
                    data-testid="input-icon"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 📚 or book-icon"
                    maxLength={50}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter an emoji (📚) or icon library name (max 50 chars)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Custom Icon Upload</label>
                  <p className="text-xs text-gray-500 mb-2">
                    Upload a custom icon (PNG or SVG, max 500 KB, min 100×100 px)
                  </p>
                  <input
                    type="file"
                    accept=".png,.svg"
                    onChange={(e) => handleFileChange('category', e.target.files?.[0] || null)}
                    data-testid="input-custom-icon-file"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white"
                  />
                  {iconFile && <p className="text-xs text-green-700 mt-2">Selected: {iconFile.name}</p>}
                  {!iconFile && formData.icon_url && (
                    <p className="text-xs text-gray-500 mt-2">Custom icon already uploaded.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bonus Badge Icon Upload</label>
                  <p className="text-xs text-gray-500 mb-2">
                    Upload a custom bonus badge icon (shown when SP earning multiplier &gt; 1.10)
                  </p>
                  <input
                    type="file"
                    accept=".png,.svg"
                    onChange={(e) => handleFileChange('bonus_badge', e.target.files?.[0] || null)}
                    data-testid="input-bonus-badge-file"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white"
                  />
                  {bonusBadgeFile && (
                    <p className="text-xs text-green-700 mt-2">Selected: {bonusBadgeFile.name}</p>
                  )}
                  {!bonusBadgeFile && formData.bonus_badge_icon_url && (
                    <p className="text-xs text-gray-500 mt-2">Bonus badge icon already uploaded.</p>
                  )}
                  {!isEditMode && (iconFile || bonusBadgeFile) && (
                    <p className="text-xs text-gray-500 mt-2">
                      Selected files will upload automatically after category creation.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* SP Config Tab */}
            {activeTab === 'sp' && (
              <>
                <div>
                  <label htmlFor="sp_earning_multiplier" className="block text-sm font-medium text-gray-700 mb-2">
                    SP Earning Multiplier
                  </label>
                  <input
                    id="sp_earning_multiplier"
                    type="range"
                    min="1.05"
                    max="1.40"
                    step="0.01"
                    value={formData.sp_earning_multiplier}
                    onChange={(e) => handleInputChange('sp_earning_multiplier', parseFloat(e.target.value))}
                    data-testid="input-sp-earn"
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>1.05×</span>
                    <span className="font-semibold">{formData.sp_earning_multiplier.toFixed(2)}×</span>
                    <span>1.40×</span>
                  </div>
                  {errors.sp_earning_multiplier && (
                    <p className="text-xs text-red-500 mt-1">{errors.sp_earning_multiplier}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="sp_spending_cap_percent" className="block text-sm font-medium text-gray-700 mb-2">
                    SP Spending Cap (%)
                  </label>
                  <input
                    id="sp_spending_cap_percent"
                    type="range"
                    min="50"
                    max="80"
                    step="1"
                    value={formData.sp_spending_cap_percent}
                    onChange={(e) => handleInputChange('sp_spending_cap_percent', parseInt(e.target.value))}
                    data-testid="input-sp-spend"
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>50%</span>
                    <span className="font-semibold">{formData.sp_spending_cap_percent}%</span>
                    <span>80%</span>
                  </div>
                  {errors.sp_spending_cap_percent && (
                    <p className="text-xs text-red-500 mt-1">{errors.sp_spending_cap_percent}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="sp_redemption_cap" className="block text-sm font-medium text-gray-700 mb-2">
                    SP Redemption Cap (SP per item, optional)
                  </label>
                  <input
                    id="sp_redemption_cap"
                    type="number"
                    min="0"
                    max="1000"
                    value={formData.sp_redemption_cap ?? ''}
                    onChange={(e) =>
                      handleInputChange(
                        'sp_redemption_cap',
                        e.target.value === '' ? null : parseInt(e.target.value, 10)
                      )
                    }
                    placeholder="Leave empty for no absolute cap"
                    data-testid="input-sp-redemption-cap"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Absolute max SP a buyer can redeem per item in this category. The spend-cap %
                    above still applies; this only tightens it. Empty = no absolute cap.
                  </p>
                  {errors.sp_redemption_cap && (
                    <p className="text-xs text-red-500 mt-1">{errors.sp_redemption_cap}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="sp_config_notes" className="block text-sm font-medium text-gray-700 mb-2">
                    Strategy Notes
                  </label>
                  <textarea
                    id="sp_config_notes"
                    value={formData.sp_config_notes}
                    onChange={(e) => handleInputChange('sp_config_notes', e.target.value)}
                    data-testid="input-sp-notes"
                    className={`w-full px-4 py-2 border ${
                      errors.sp_config_notes ? 'border-red-500' : 'border-gray-300'
                    } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    placeholder="Optional admin notes (max 500 characters)"
                    rows={3}
                    maxLength={500}
                  />
                  {errors.sp_config_notes && <p className="text-xs text-red-500 mt-1">{errors.sp_config_notes}</p>}
                  <p className="text-xs text-gray-500 mt-1">{formData.sp_config_notes.length}/500 characters</p>
                </div>

                {isEditMode && (
                  <div className="flex items-center">
                    <input
                      id="sp_rate_change_notify"
                      type="checkbox"
                      checked={formData.sp_rate_change_notify}
                      onChange={(e) => handleInputChange('sp_rate_change_notify', e.target.checked)}
                      data-testid="input-notify"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="sp_rate_change_notify" className="ml-2 text-sm text-gray-700">
                      Notify users about rate change (in-app banner)
                    </label>
                  </div>
                )}

                {/* Live Preview */}
                <div className="bg-blue-50 p-4 rounded-md border border-blue-200" data-testid="sp-preview">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">Live Preview (for $50 item)</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Seller earns:</p>
                      <p className="text-lg font-bold text-green-600">{previewData.earn_sp} SP</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Buyer can use up to:</p>
                      <p className="text-lg font-bold text-blue-600">{previewData.max_spend_sp} SP</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Buyer always pays {100 - formData.sp_spending_cap_percent}% cash minimum + platform fee
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              data-testid="cancel-btn"
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !!errors.name}
              data-testid="submit-btn"
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : isEditMode ? 'Update Category' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
