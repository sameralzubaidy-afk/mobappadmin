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

import { useState, useEffect } from 'react';
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
  status: 'flagged' | 'rejected';
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

export default function FlaggedItemsPage() {
  const [items, setItems] = useState<FlaggedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'flagged' | 'rejected'>('all');
  const [selectedItem, setSelectedItem] = useState<FlaggedItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [filter]);

  const fetchItems = async () => {
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
      } else {
        query = query.in('status', ['flagged', 'rejected']);
      }

      query = query.order('flagged_at', { ascending: false, nullsFirst: false });

      const { data, error } = await query;

      if (error) throw error;

      // Fetch seller details for each item
      const itemsWithSellers = await Promise.all(
        (data || []).map(async (item) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, name')
            .eq('user_id', item.seller_id)
            .single();

          return {
            ...item,
            seller: {
              id: item.seller_id,
              name: profile?.name || 'Unknown',
              email: 'N/A',
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
  };

  const handleApprove = async (itemId: string) => {
    if (!confirm('Are you sure you want to approve this item and make it available?')) {
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
        body: JSON.stringify({ status: 'available' }),
      });

      const json = await res.json();
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

      const json = await res.json();
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Flagged & Rejected Items</h1>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'flagged', 'rejected'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Items Table */}
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500">No items found</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Seller
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Appeals
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Latest Appeal Note
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{item.title}</div>
                      <div className="text-sm text-gray-500">${item.price.toFixed(2)}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{item.seller?.name}</div>
                    <div className="text-sm text-gray-500">{item.seller?.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        item.status === 'flagged'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.appeal_count}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                    {item.appeal_reason ? (
                      <p className="line-clamp-2">{item.appeal_reason}</p>
                    ) : (
                      <span className="text-gray-400">No seller appeal note</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => setSelectedItem(item)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
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
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      selectedItem.status === 'flagged'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {selectedItem.status}
                  </span>
                </p>
              </div>

              {selectedItem.rejection_reason && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Previous Rejection Reason
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
                Rejection Reason (required to reject)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg p-2"
                placeholder="Explain why this item is being rejected..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => handleApprove(selectedItem.id)}
                disabled={submitting}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Approve & Make Available
              </button>
              <button
                onClick={() => handleReject(selectedItem.id)}
                disabled={submitting || !rejectionReason.trim()}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50"
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
