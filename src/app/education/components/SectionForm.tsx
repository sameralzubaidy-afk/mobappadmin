'use client';

// FILE: p2p-kids-admin/src/app/education/components/SectionForm.tsx
// MODULE-18 V1 EDU-008: Section Form Component
// Modal for creating/editing sections with Save Draft / Preview / Publish actions

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { EducationSection, SectionType } from '../../../types/education';
import {
  createSection,
  updateSection,
} from '../../../lib/educationContentService';
import { MobilePreview } from './MobilePreview';

interface SectionFormProps {
  section: EducationSection | null; // null = create mode
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const SECTION_TYPES: { value: SectionType; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'sp_definition', label: 'SP Definition' },
  { value: 'sp_earning', label: 'SP Earning' },
  { value: 'sp_spending', label: 'SP Spending' },
  { value: 'safety', label: 'Safety' },
  { value: 'example', label: 'Example' },
];

export function SectionForm({ section, onClose, onSuccess }: SectionFormProps) {
  const isEditMode = section !== null;

  const [formData, setFormData] = useState({
    title: section?.title || '',
    body: section?.body || '',
    image_url: section?.image_url || '',
    section_type: section?.section_type || ('general' as SectionType),
    display_order: section?.display_order || 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Title: 3-100 chars
    if (formData.title.length < 3 || formData.title.length > 100) {
      newErrors.title = 'Title must be 3-100 characters';
    }

    // Body: 10-2000 chars
    if (formData.body.length < 10 || formData.body.length > 2000) {
      newErrors.body = 'Body must be 10-2000 characters';
    }

    // Image URL: ≤ 500 chars (if provided)
    if (formData.image_url && formData.image_url.length > 500) {
      newErrors.image_url = 'Image URL must be ≤ 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);

      if (isEditMode) {
        await updateSection(section.id, {
          title: formData.title !== section.title ? formData.title : undefined,
          body: formData.body !== section.body ? formData.body : undefined,
          image_url: formData.image_url !== section.image_url ? formData.image_url : undefined,
          display_order: formData.display_order !== section.display_order ? formData.display_order : undefined,
        });
        onSuccess('Section updated successfully');
      } else {
        await createSection(formData);
        onSuccess('Section created as draft');
      }

      onClose();
    } catch (error: any) {
      console.error('[SectionForm] Save error:', error);
      setErrors({ submit: error.message || 'Failed to save section' });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreview = () => {
    if (!validateForm()) {
      return;
    }
    setShowPreview(true);
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

  const previewSection: EducationSection = {
    id: section?.id || 'preview',
    title: formData.title,
    body: formData.body,
    image_url: formData.image_url || null,
    section_type: formData.section_type,
    display_order: formData.display_order,
    is_published: false,
    published_at: null,
    published_by: null,
    created_at: section?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <>
      {/* Modal Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
        data-testid="section-form-backdrop"
      >
        {/* Modal Content */}
        <div
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          data-testid="section-form-modal"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {isEditMode ? 'Edit Section' : 'Create New Section'}
            </h2>
            <button
              onClick={onClose}
              data-testid="btn-close-section-form"
              className="p-2 rounded hover:bg-gray-100 transition-colors"
            >
              <X size={20} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSaveDraft} className="p-6 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                data-testid="input-section-title"
                className="w-full px-3 py-2 border rounded-lg"
                style={{ borderColor: errors.title ? '#dc3545' : 'var(--border-color)' }}
                maxLength={100}
                placeholder="Enter section title"
              />
              <div className="flex justify-between mt-1">
                <p className="text-xs" style={{ color: errors.title ? '#dc3545' : 'var(--text-secondary)' }}>
                  {errors.title || '3-100 characters'}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {formData.title.length}/100
                </p>
              </div>
            </div>

            {/* Body */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                Body <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.body}
                onChange={(e) => handleInputChange('body', e.target.value)}
                data-testid="input-section-body"
                className="w-full px-3 py-2 border rounded-lg"
                style={{ borderColor: errors.body ? '#dc3545' : 'var(--border-color)' }}
                rows={8}
                maxLength={2000}
                placeholder="Enter section body (plain text only, newlines preserved)"
              />
              <div className="flex justify-between mt-1">
                <p className="text-xs" style={{ color: errors.body ? '#dc3545' : 'var(--text-secondary)' }}>
                  {errors.body || '10-2000 characters'}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {formData.body.length}/2000
                </p>
              </div>
            </div>

            {/* Image URL */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                Image URL (optional)
              </label>
              <input
                type="text"
                value={formData.image_url}
                onChange={(e) => handleInputChange('image_url', e.target.value)}
                data-testid="input-section-image-url"
                className="w-full px-3 py-2 border rounded-lg"
                style={{ borderColor: errors.image_url ? '#dc3545' : 'var(--border-color)' }}
                maxLength={500}
                placeholder="https://..."
              />
              <p className="text-xs mt-1" style={{ color: errors.image_url ? '#dc3545' : 'var(--text-secondary)' }}>
                {errors.image_url || 'Supabase Storage public URL only'}
              </p>
            </div>

            {/* Section Type */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                Section Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.section_type}
                onChange={(e) => handleInputChange('section_type', e.target.value as SectionType)}
                data-testid="select-section-type"
                className="w-full px-3 py-2 border rounded-lg"
                style={{ borderColor: 'var(--border-color)' }}
                disabled={isEditMode} // Cannot change type after creation
              >
                {SECTION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Display Order */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                Display Order
              </label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) => handleInputChange('display_order', parseInt(e.target.value) || 0)}
                data-testid="input-section-display-order"
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
                data-testid="btn-cancel-section"
                className="px-4 py-2 rounded-lg font-medium transition-colors"
                style={{
                  background: 'var(--surface-bg)',
                  color: 'var(--text-secondary)',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePreview}
                disabled={submitting}
                data-testid="btn-preview-section"
                className="px-4 py-2 rounded-lg font-medium transition-colors border"
                style={{
                  borderColor: 'var(--brand-primary)',
                  color: 'var(--brand-primary)',
                }}
              >
                Preview
              </button>
              <button
                type="submit"
                disabled={submitting}
                data-testid="btn-save-section"
                className="px-4 py-2 rounded-lg font-medium transition-colors"
                style={{
                  background: 'var(--brand-primary)',
                  color: 'white',
                }}
              >
                {submitting ? 'Saving...' : 'Save Draft'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <MobilePreview
          section={previewSection}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}
