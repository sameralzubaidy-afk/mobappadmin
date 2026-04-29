'use client';

// FILE: p2p-kids-admin/src/app/categories/components/CategorySuggestionsList.tsx
// ADMIN-V3-005: Category Suggestions List with Approve/Merge/Reject actions
// Module: MODULE-12-ADMIN-V3-CATEGORIES

import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, CheckCircle, GitMerge, XCircle, X } from 'lucide-react';
import type { CategorySuggestion } from '../../../types/category';
import { getCategorySuggestions } from '../../../lib/categorySuggestionService';
import { ApproveSuggestionModal } from './ApproveSuggestionModal';
import { MergeSuggestionModal } from './MergeSuggestionModal';
import { RejectSuggestionModal } from './RejectSuggestionModal';

interface CategorySuggestionsListProps {
  onCountChange?: (count: number) => void;
  onActionSuccess?: () => void;
}

export function CategorySuggestionsList({
  onCountChange,
  onActionSuccess,
}: CategorySuggestionsListProps) {
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal state
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<CategorySuggestion | null>(null);

  const loadSuggestions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCategorySuggestions('pending', true);
      setSuggestions(data);
      onCountChange?.(data.length);
    } catch (err: any) {
      console.error('Error loading suggestions:', err);
      setError(err.message || 'Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const handleApproveClick = (suggestion: CategorySuggestion) => {
    setSelectedSuggestion(suggestion);
    setApproveModalOpen(true);
  };

  const handleMergeClick = (suggestion: CategorySuggestion) => {
    setSelectedSuggestion(suggestion);
    setMergeModalOpen(true);
  };

  const handleRejectClick = (suggestion: CategorySuggestion) => {
    setSelectedSuggestion(suggestion);
    setRejectModalOpen(true);
  };

  const handleActionSuccess = (message: string) => {
    setSuccessMessage(message);
    loadSuggestions(); // Refresh list
    onActionSuccess?.(); // Refresh parent category data
  };

  const formatDate = (isoDate: string): string => {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`;
      }
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    }

    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const successBanner = successMessage ? (
    <div
      className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md flex items-start justify-between gap-3"
      data-testid="suggestions-success"
    >
      <p className="text-sm text-green-800">{successMessage}</p>
      <button
        type="button"
        onClick={() => setSuccessMessage(null)}
        className="text-green-700 hover:text-green-900"
        aria-label="Dismiss success message"
      >
        <X size={16} />
      </button>
    </div>
  ) : null;

  if (loading) {
    return (
      <>
        {successBanner}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p className="text-gray-600" data-testid="suggestions-loading">
            Loading suggestions...
          </p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        {successBanner}
        <div
          className="bg-red-50 border border-red-200 rounded-md p-4"
          data-testid="suggestions-error"
        >
          <p className="text-sm text-red-800">{error}</p>
        </div>
      </>
    );
  }

  if (suggestions.length === 0) {
    return (
      <>
        {successBanner}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p className="text-gray-600" data-testid="suggestions-empty">
            No pending category suggestions. Suggestions appear when sellers select &ldquo;Other&rdquo; and
            provide a custom category name.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {successBanner}

      {/* Table */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200" data-testid="suggestions-table">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Suggested Name
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Item
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Seller
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Date
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {suggestions.map((suggestion) => (
                <tr
                  key={suggestion.id}
                  className="hover:bg-gray-50 transition-colors"
                  data-testid={`suggestion-row-${suggestion.id}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {suggestion.suggested_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {suggestion.item ? (
                      <a
                        href={`/items/${suggestion.item_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                        data-testid={`item-link-${suggestion.id}`}
                      >
                        <span className="max-w-xs truncate">{suggestion.item.name}</span>
                        <ExternalLink size={14} className="ml-1 flex-shrink-0" />
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {suggestion.seller ? (
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {suggestion.seller.full_name || 'Unknown'}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {suggestion.seller.email?.substring(0, 20)}
                          {(suggestion.seller.email?.length || 0) > 20 ? '...' : ''}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">{formatDate(suggestion.created_at)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleApproveClick(suggestion)}
                        data-testid={`approve-btn-${suggestion.id}`}
                        className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                        title="Approve and create new category"
                      >
                        <CheckCircle size={16} className="mr-1" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleMergeClick(suggestion)}
                        data-testid={`merge-btn-${suggestion.id}`}
                        className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        title="Merge into existing category"
                      >
                        <GitMerge size={16} className="mr-1" />
                        Merge
                      </button>
                      <button
                        onClick={() => handleRejectClick(suggestion)}
                        data-testid={`reject-btn-${suggestion.id}`}
                        className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                        title="Reject suggestion"
                      >
                        <XCircle size={16} className="mr-1" />
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {selectedSuggestion && (
        <>
          {approveModalOpen && (
            <ApproveSuggestionModal
              suggestion={selectedSuggestion}
              onClose={() => {
                setApproveModalOpen(false);
                setSelectedSuggestion(null);
              }}
              onSuccess={handleActionSuccess}
            />
          )}
          {mergeModalOpen && (
            <MergeSuggestionModal
              suggestion={selectedSuggestion}
              onClose={() => {
                setMergeModalOpen(false);
                setSelectedSuggestion(null);
              }}
              onSuccess={handleActionSuccess}
            />
          )}
          {rejectModalOpen && (
            <RejectSuggestionModal
              suggestion={selectedSuggestion}
              onClose={() => {
                setRejectModalOpen(false);
                setSelectedSuggestion(null);
              }}
              onSuccess={handleActionSuccess}
            />
          )}
        </>
      )}
    </>
  );
}
