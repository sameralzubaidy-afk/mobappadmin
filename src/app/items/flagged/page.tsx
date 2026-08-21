/**
 * File: p2p-kids-admin/src/app/items/flagged/page.tsx
 * MODULE-13 SAFETY-P003: Admin view for flagged/rejected items
 * 
 * Features:
 * - View items flagged by CPSC match or AI moderation
 * - View rejected items
 * - Update item status (approve → available, reject with reason)
 * - Add rejection reason
 * - Track appeal count
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '';

interface FlaggedItem {
  id: string;
  title: string;
  description: string | null;
  price: number;
  status: 'flagged' | 'rejected' | 'needs_edits';
  flagged_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  appeal_count: number;
  appeal_reason: string | null;
  appealed_at: string | null;
  seller_id: string;
  created_at: string;
  seller?: {
    id: string;
    name: string;
    email: string;
  };
}

type ModerationFilter = 'all' | 'flagged' | 'rejected' | 'needs_edits';

const statusClassMap: Record<FlaggedItem['status'], string> = {
  flagged: 'bg-yellow-100 text-yellow-800',
  rejected: 'bg-red-100 text-red-800',
  needs_edits: 'bg-orange-100 text-orange-800',
};

const formatStatusLabel = (status: string): string => {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const formatDateTime = (value: string | null): string => {
  if (!value) return 'N/A';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'N/A';

  return parsed.toLocaleString();
};

export default function FlaggedItemsPage() {
  const [items, setItems] = useState<FlaggedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ModerationFilter>('all');
  const [selectedItem, setSelectedItem] = useState<FlaggedItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('items')
        .select(`
          id,
          title,
          description,
          price,
          status,
          flagged_at,
          rejected_at,
          rejection_reason,
          appeal_count,
          appeal_reason,
          appealed_at,
          seller_id,
          created_at
        `);

      if (filter === 'flagged') {
        query = query.eq('status', 'flagged');
      } else if (filter === 'rejected') {
        query = query.eq('status', 'rejected');
      } else if (filter === 'needs_edits') {
        query = query.eq('status', 'needs_edits');
      } else {
        query = query.in('status', ['flagged', 'rejected', 'needs_edits']);
      }

      query = query.order('flagged_at', { ascending: false, nullsFirst: false });

      const { data, error } = await query;

      if (error) throw error;

      // Fetch seller details for each item
      const itemsWithSellers = await Promise.all(
        (data || []).map(async (item) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, name, email')
            .eq('user_id', item.seller_id)
            .single();

          const sellerName = profile?.name?.trim() || profile?.email?.trim() || `Seller ${item.seller_id.slice(0, 8)}`;
          const sellerEmail = profile?.email?.trim() || 'N/A';

          return {
            ...item,
            seller: {
              id: item.seller_id,
              name: sellerName,
              email: sellerEmail,
            },
          };
        })
      );

      setItems(itemsWithSellers);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching flagged items:', error);
      alert(`Failed to load items: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const readApiResponse = async (res: Response): Promise<any> => {
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      return res.json();
    }

    const text = await res.text();
    const preview = text.slice(0, 140).replace(/\s+/g, ' ').trim();
    throw new Error(`Unexpected API response (${res.status}): ${preview || 'empty response'}`);
  };

  const handleApprove = async (itemId: string) => {
    if (!confirm('Are you sure you want to approve this item and make it available?')) {
      return;
    }

    try {
      setSubmitting(true);
      // Identify the acting admin so approval metadata (approved_by) and the
      // audit log record who approved. Mirrors ListingSearch.handleApproveListing.
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        alert('Failed to get admin user ID. Please sign in again.');
        return;
      }

      const res = await fetch(`/api/admin/items/${itemId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({ status: 'available', admin_user_id: user.id }),
      });

      const json = await readApiResponse(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to approve item');
      }

      alert('Item approved successfully');
      fetchItems();
      setSelectedItem(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error approving item:', error);
      alert(`Failed to approve item: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (itemId: string) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    if (!confirm('Are you sure you want to reject this item?')) {
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/admin/items/${itemId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({
          status: 'rejected',
          rejection_reason: rejectionReason.trim(),
        }),
      });

      const json = await readApiResponse(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to reject item');
      }

      alert('Item rejected successfully');
      fetchItems();
      setSelectedItem(null);
      setRejectionReason('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error rejecting item:', error);
      alert(`Failed to reject item: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestEdits = async (itemId: string) => {
    if (!rejectionReason.trim()) {
      alert('Please provide details about what the seller should edit');
      return;
    }

    if (!confirm('Send this listing back to seller for edits?')) {
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/admin/items/${itemId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({
          status: 'needs_edits',
          rejection_reason: rejectionReason.trim(),
        }),
      });

      const json = await readApiResponse(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to request edits');
      }

      alert('Edit request sent to seller successfully');
      fetchItems();
      setSelectedItem(null);
      setRejectionReason('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error requesting edits:', error);
      alert(`Failed to request edits: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Moderation Queue</h1>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'flagged', 'needs_edits', 'rejected'] as const).map((f) => (
          <button
            data-testid={`flagged-filter-${f}`}
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {formatStatusLabel(f)}
          </button>
        ))}
      </div>

      {/* Items Table */}
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500">No items found</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full min-w-[1100px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-[200px] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="w-[130px] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item ID
                </th>
                <th className="w-[150px] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Seller
                </th>
                <th className="w-[100px] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="w-[140px] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Flagged Date
                </th>
                <th className="w-[75px] px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Appeals
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Latest Appeal Note
                </th>
                <th className="w-[100px] px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 align-top">
                    <div>
                      <div className="text-sm font-medium text-gray-900 line-clamp-2">{item.title}</div>
                      <div className="text-xs text-gray-500">${item.price.toFixed(2)}</div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="block break-all rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700">
                      {item.id}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="text-xs text-gray-900 font-medium">{item.seller?.name}</div>
                    <div className="text-xs text-gray-500 line-clamp-1">{item.seller?.email}</div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClassMap[item.status]}`}
                    >
                      {formatStatusLabel(item.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-gray-500 whitespace-nowrap">
                    {formatDateTime(item.flagged_at || item.created_at)}
                  </td>
                  <td className="px-3 py-2 align-top text-center text-xs text-gray-500">
                    {item.appeal_count}
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-gray-500">
                    {item.appeal_reason ? (
                      <p className="line-clamp-2">{item.appeal_reason}</p>
                    ) : (
                      <span className="text-gray-400">No seller appeal note</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-center">
                    <button
                      onClick={() => setSelectedItem(item)}
                      className="bg-blue-600 text-white px-3 py-1 text-sm rounded-lg hover:bg-blue-700 transition-colors"
                      data-testid={`review-item-${item.id}`}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-screen overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Review Item</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <p className="mt-1 text-gray-900">{selectedItem.title}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <p className="mt-1 text-gray-900">{selectedItem.description || 'N/A'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Price</label>
                <p className="mt-1 text-gray-900">${selectedItem.price.toFixed(2)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <p className="mt-1">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClassMap[selectedItem.status]}`}
                  >
                    {formatStatusLabel(selectedItem.status)}
                  </span>
                </p>
              </div>

              {selectedItem.rejection_reason && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Latest Admin Decision Note
                  </label>
                  <p className="mt-1 text-gray-900 bg-red-50 p-3 rounded">
                    {selectedItem.rejection_reason}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Appeals Submitted
                </label>
                <p className="mt-1 text-gray-900">{selectedItem.appeal_count}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Latest Seller Appeal Note</label>
                <p className="mt-1 text-gray-900 bg-blue-50 p-3 rounded whitespace-pre-wrap">
                  {selectedItem.appeal_reason || 'No appeal note submitted yet.'}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {selectedItem.appealed_at
                    ? `Appealed at: ${new Date(selectedItem.appealed_at).toLocaleString()}`
                    : 'Appeal timestamp not available'}
                </p>
              </div>
            </div>

            {/* Rejection Reason Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Decision Note (required for Reject and Request Edits)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                data-testid="flagged-rejection-reason-input"
                rows={3}
                className="w-full border border-gray-300 rounded-lg p-2"
                placeholder="Provide clear moderation feedback for seller..."
              />
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleApprove(selectedItem.id)}
                disabled={submitting}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50"
                data-testid="approve-item"
              >
                Approve & Make Available
              </button>
              <button
                onClick={() => handleRequestEdits(selectedItem.id)}
                disabled={submitting || !rejectionReason.trim()}
                className="flex-1 bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 disabled:opacity-50"
                data-testid="request-edits-item"
              >
                Request Edits
              </button>
              <button
                onClick={() => handleReject(selectedItem.id)}
                disabled={submitting || !rejectionReason.trim()}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50"
                data-testid="reject-item"
              >
                Reject
              </button>
              <button
                onClick={() => {
                  setSelectedItem(null);
                  setRejectionReason('');
                }}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                data-testid="close-review-modal"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
