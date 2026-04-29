'use client';

// FILE: p2p-kids-admin/src/app/categories/components/RejectSuggestionModal.tsx
// ADMIN-V3-005: Reject suggestion modal (note field optional, 500 char)
// Module: MODULE-12-ADMIN-V3-CATEGORIES

import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import type { CategorySuggestion } from '../../../types/category';
import { rejectCategorySuggestion } from '../../../lib/categorySuggestionService';

interface RejectSuggestionModalProps {
  suggestion: CategorySuggestion;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function RejectSuggestionModal({
  suggestion,
  onClose,
  onSuccess,
}: RejectSuggestionModalProps) {
  const [adminNote, setAdminNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      setError(null);

      await rejectCategorySuggestion(
        suggestion.id,
        {
          admin_note: adminNote.trim() || null,
        }
      );

      onSuccess(`Suggestion "${suggestion.suggested_name}" rejected successfully`);
      onClose();
    } catch (err: any) {
      console.error('Error rejecting suggestion:', err);
      setError(err.message || 'Failed to reject suggestion');
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
      data-testid="reject-modal-overlay"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-modal-title"
      >
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2
            id="reject-modal-title"
            className="text-xl font-semibold text-gray-900"
            data-testid="reject-modal-title"
          >
            Reject Category Suggestion
          </h2>
          <button
            onClick={handleClose}
            disabled={submitting}
            data-testid="reject-modal-close"
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} data-testid="reject-form">
          <div className="px-6 py-4 space-y-4">
            {/* Warning Card */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">
                  You are about to reject this category suggestion.
                </p>
                <p className="mt-1">
                  The item will remain in its current category. This action cannot be undone.
                </p>
              </div>
            </div>

            {/* Info Card */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
              <p className="text-sm text-gray-800">
                <strong>Suggestion:</strong> {suggestion.suggested_name}
                <br />
                <strong>From:</strong>{' '}
                {suggestion.seller?.full_name || suggestion.seller?.email || 'Unknown'}
                <br />
                <strong>Item:</strong> {suggestion.item?.name || 'Unknown'}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div
                className="p-4 bg-red-50 border border-red-200 rounded-md"
                data-testid="reject-modal-error"
              >
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Admin Note */}
            <div>
              <label
                htmlFor="reject-note"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Admin Note (optional)
              </label>
              <textarea
                id="reject-note"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                data-testid="reject-note"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={4}
                maxLength={500}
                placeholder="Reason for rejection (optional, visible to internal team only)"
              />
              <p className="mt-1 text-xs text-gray-500">{adminNote.length}/500 characters</p>
            </div>

            <p className="text-xs text-gray-500">
              💡 <strong>Tip:</strong> Leave a note to help track common rejection reasons and
              improve seller guidance.
            </p>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3 bg-gray-50">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              data-testid="reject-form-cancel"
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              data-testid="reject-form-submit"
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Rejecting...' : 'Reject Suggestion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
