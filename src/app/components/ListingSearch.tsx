/**
 * File: p2p-kids-admin/src/app/components/ListingSearch.tsx
 * MODULE-04 LISTING-V2-006: Admin Tools for Listing Management
 * 
 * Features:
 * - Search listings by ID, seller ID, item name, status
 * - View seller subscription status audit (at creation vs current)
 * - Force-delete or pause listings with reason logging
 * - Display listing metrics
 */

'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface ListingSearchResult {
  id: string;
  title: string;
  price: number;
  accepts_swap_points: boolean;
  status: string;
  seller_id: string;
  eligible_for_starter_pack?: boolean;
  starter_pack_claimed?: boolean;
  approved_at?: string;
  seller?: { 
    name?: string;
    email?: string;
    subscription_status_at_creation?: string;
  };
  created_at: string;
  images?: { url: string; thumbnail_url?: string }[];
  seller_items_count?: number;
}

interface SearchFilters {
  query: string;
  status: 'all' | 'active' | 'pending' | 'sold' | 'draft' | 'deleted';
  spEligibleOnly: boolean;
  page: number;
}

export default function ListingSearch() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    status: 'all',
    spEligibleOnly: false,
    page: 1,
  });
  const [listings, setListings] = useState<ListingSearchResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedListing, setSelectedListing] = useState<ListingSearchResult | null>(null);
  const [adminAction, setAdminAction] = useState<'force_delete' | 'pause' | 'approve' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState('');
  
  const ITEMS_PER_PAGE = 20;

  React.useEffect(() => {
    handleSearch(false);
  }, [filters.page]);

  const handleSearch = async (resetPage = true) => {
    try {
      setLoading(true);
      const targetPage = resetPage ? 1 : filters.page;
      if (resetPage && filters.page !== 1) {
        setFilters({ ...filters, page: 1 });
        return; // handleSearch will be re-triggered by useEffect
      }
      
      const { data, error } = await supabase.rpc('admin_search_listings_v2', {
        p_query: filters.query,
        p_status: filters.status,
        p_sp_eligible: filters.spEligibleOnly,
        p_page: targetPage,
        p_items_per_page: ITEMS_PER_PAGE
      });

      if (error) {
        console.error('[ListingSearch] RPC Error:', error);
        alert('Failed to search listings');
        return;
      }

      setListings(data.listings || []);
      setTotalCount(data.total_count || 0);
    } catch (err) {
      console.error('[ListingSearch] Error searching listings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleForceDelete = async () => {
    if (!selectedListing || !actionReason.trim()) {
      alert('Please provide a reason for deletion');
      return;
    }

    try {
      setActionLoading(true);

      // Call RPC function to force delete with audit logging
      const { data, error } = await supabase.rpc('admin_force_delete_listing', {
        p_listing_id: selectedListing.id,
        p_reason: actionReason,
      });

      if (error) {
        console.error('[ListingSearch] Force delete error:', error);
        alert(`Failed to delete listing: ${error.message}`);
        return;
      }

      // Check if RPC response indicates failure (function returns JSONB with success flag)
      if (data && !data.success) {
        console.error('[ListingSearch] Force delete failed:', data.error);
        alert(`Failed to delete listing: ${data.error}`);
        return;
      }

      console.log('[ListingSearch] Force delete response:', data);
      alert('Listing force-deleted successfully');
      setSelectedListing(null);
      setAdminAction(null);
      setActionReason('');
      
      // Refresh search results
      setFilters(prev => ({ ...prev, page: 1 }));
      setTimeout(() => handleSearch(), 100);
    } catch (err) {
      console.error('[ListingSearch] Force delete exception:', err);
      alert(`Error deleting listing: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseListing = async () => {
    if (!selectedListing || !actionReason.trim()) {
      alert('Please provide a reason for pausing');
      return;
    }

    try {
      setActionLoading(true);

      // Call RPC function to pause with audit logging
      const { data, error } = await supabase.rpc('admin_pause_listing', {
        p_listing_id: selectedListing.id,
        p_reason: actionReason,
      });

      if (error) {
        console.error('[ListingSearch] Pause error:', error);
        alert(`Failed to pause listing: ${error.message}`);
        return;
      }

      // Check if RPC response indicates failure
      if (data && !data.success) {
        console.error('[ListingSearch] Pause failed:', data.error);
        alert(`Failed to pause listing: ${data.error}`);
        return;
      }

      console.log('[ListingSearch] Pause response:', data);
      alert('Listing paused successfully');
      setSelectedListing(null);
      setAdminAction(null);
      setActionReason('');
      
      // Refresh search results
      setFilters(prev => ({ ...prev, page: 1 }));
      setTimeout(() => handleSearch(), 100);
    } catch (err) {
      console.error('[ListingSearch] Pause exception:', err);
      alert(`Error pausing listing: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveListing = async () => {
    if (!selectedListing) {
      alert('No listing selected');
      return;
    }

    try {
      setActionLoading(true);

      // Get current user (admin)
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        alert('Failed to get admin user ID');
        return;
      }

      // Call RPC function to approve listing
      const { data, error } = await supabase.rpc('admin_approve_listing', {
        p_listing_id: selectedListing.id,
        p_admin_user_id: user.id,
        p_reason: actionReason || 'Admin approval via listing dashboard',
      });

      if (error) {
        console.error('[ListingSearch] Approval error:', error);
        alert(`Failed to approve listing: ${error.message}`);
        return;
      }

      // Check if RPC response indicates failure
      if (data && !data.success) {
        console.error('[ListingSearch] Approval failed:', data.error);
        alert(`Failed to approve listing: ${data.error}`);
        return;
      }

      console.log('[ListingSearch] Approval response:', data);
      setApprovalMessage(data.message || 'Listing approved successfully');
      alert(data.message || 'Listing approved successfully');
      
      setSelectedListing(null);
      setAdminAction(null);
      setActionReason('');
      setApprovalMessage('');
      
      // Refresh search results
      setFilters(prev => ({ ...prev, page: 1 }));
      setTimeout(() => handleSearch(), 100);
    } catch (err) {
      console.error('[ListingSearch] Approval exception:', err);
      alert(`Error approving listing: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-full mx-auto">
      <h1 className="text-3xl font-bold mb-6">📋 Listing Management</h1>

      {/* Search & Filter Controls */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Search & Filter</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* Query input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search by Item Name
            </label>
            <input
              type="text"
              value={filters.query}
              onChange={(e) => setFilters({ ...filters, query: e.target.value })}
              placeholder="e.g., Blue Backpack, Bicycle..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="active">Available</option>
              <option value="pending">Pending</option>
              <option value="sold">Sold</option>
              <option value="draft">Draft</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>

          {/* SP Filter */}
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.spEligibleOnly}
                onChange={(e) => setFilters({ ...filters, spEligibleOnly: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700">SP-Eligible Only</span>
            </label>
          </div>

          {/* Search button */}
          <div className="flex items-end">
            <button
              onClick={() => handleSearch(true)}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Listings Table */}
        <div className={selectedListing ? "lg:col-span-3" : "lg:col-span-4"}>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">
                Results ({totalCount}) 
                {totalCount > ITEMS_PER_PAGE && (
                  <span className="text-sm font-normal text-gray-600 ml-2">
                    Page {filters.page} of {Math.ceil(totalCount / ITEMS_PER_PAGE)}
                  </span>
                )}
              </h3>
            </div>

            {listings.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                No listings found. Try adjusting your search filters.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Item</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Price</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">SP</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Seller Email</th>                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Starter Pack</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Seller Items</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listings.map((listing) => (
                        <tr
                          key={listing.id}
                          className="border-b hover:bg-gray-50 cursor-pointer"
                          onClick={() => setSelectedListing(listing)}
                        >
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 truncate max-w-xs">
                            {listing.title}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">${listing.price.toFixed(2)}</td>
                          <td className="px-6 py-4 text-sm">
                            {listing.accepts_swap_points ? (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                ✓ Yes
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                listing.status === 'available'
                                  ? 'bg-green-100 text-green-800'
                                  : listing.status === 'pending'
                                    ? 'bg-blue-100 text-blue-800'
                                    : listing.status === 'sold'
                                    ? 'bg-gray-100 text-gray-800'
                                    : listing.status === 'draft'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
                            </span>
                          </td>                          <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-[200px]">
                            {listing.seller?.email || '—'}
                          </td>                          <td className="px-6 py-4 text-sm">
                            {listing.eligible_for_starter_pack ? (
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                                {listing.starter_pack_claimed ? '🎁 Claimed' : '🎁 Eligible'}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {listing.seller_items_count}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedListing(listing);
                              }}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalCount > ITEMS_PER_PAGE && (
                  <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {(filters.page - 1) * ITEMS_PER_PAGE + 1}-{Math.min(filters.page * ITEMS_PER_PAGE, totalCount)} of {totalCount}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                        disabled={filters.page === 1}
                        className="px-3 py-1 border rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                      >
                        ← Previous
                      </button>
                      <button
                        onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                        disabled={filters.page >= Math.ceil(totalCount / ITEMS_PER_PAGE)}
                        className="px-3 py-1 border rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Selected Listing Details & Actions */}
        {selectedListing && (
          <div className="bg-white rounded-lg shadow p-6 max-h-[800px] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">📌 Listing Details</h3>

            {/* Product Images */}
            {selectedListing.images && selectedListing.images.length > 0 ? (
              <div className="mb-6 border-b pb-6">
                <label className="text-sm font-medium text-gray-700 block mb-3">Product Images</label>
                <div className="grid grid-cols-2 gap-2">
                  {selectedListing.images.map((img, idx) => (
                    <div key={idx} className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ aspectRatio: '1/1' }}>
                      <img
                        src={img.thumbnail_url || img.url}
                        alt={`Product ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to full URL if thumbnail fails
                          e.currentTarget.src = img.url;
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-6 border-b pb-6">
                <label className="text-sm font-medium text-gray-700 block mb-3">Product Images</label>
                <div className="bg-gray-100 rounded-lg p-6 text-center text-gray-500">
                  No images uploaded
                </div>
              </div>
            )}

            <div className="space-y-3 mb-6">
              <div>
                <label className="text-sm font-medium text-gray-700">ID</label>
                <p className="text-sm text-gray-900 font-mono break-all">{selectedListing.id}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Title</label>
                <p className="text-sm text-gray-900">{selectedListing.title}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Price</label>
                <p className="text-sm text-gray-900">${selectedListing.price.toFixed(2)}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">SP Eligible</label>
                <p className="text-sm text-gray-900">{selectedListing.accepts_swap_points ? '✓ Yes' : '✗ No'}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <p className="text-sm text-gray-900 capitalize">{selectedListing.status}</p>
              </div>
              {selectedListing.eligible_for_starter_pack && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <label className="text-sm font-medium text-green-900">🎁 Starter Pack Eligible</label>
                  <p className="text-sm text-green-700 mt-1">
                    {selectedListing.starter_pack_claimed ? '✓ Claimed' : 'Pending claim - seller can earn SP when approved'}
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700">Created</label>
                <p className="text-sm text-gray-900">
                  {new Date(selectedListing.created_at).toLocaleString()}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Seller</label>
                <p className="text-sm text-gray-900">
                  {selectedListing.seller?.name || 'Unknown'} 
                  {selectedListing.seller_items_count !== undefined && (
                    <span className="text-gray-600 ml-2">
                      ({selectedListing.seller_items_count} active item{selectedListing.seller_items_count !== 1 ? 's' : ''})
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Admin Actions */}
            {!adminAction ? (
              <div className="space-y-2">
                {selectedListing.status === 'pending' && (
                  <button
                    onClick={() => setAdminAction('approve')}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
                  >
                    ✅ Approve Listing
                  </button>
                )}
                {selectedListing.status !== 'deleted' && (
                  <button
                    onClick={() => setAdminAction('pause')}
                    className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium text-sm"
                  >
                    ⏸ Pause Listing
                  </button>
                )}
                {selectedListing.status !== 'deleted' && (
                  <button
                    onClick={() => setAdminAction('force_delete')}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
                  >
                    🗑 Force Delete
                  </button>
                )}
                <button
                  onClick={() => setSelectedListing(null)}
                  className="w-full px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 font-medium text-sm"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-3 bg-red-50 p-4 rounded-lg border border-red-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {adminAction === 'approve' ? 'Admin Notes (optional):' : `Reason for ${adminAction === 'force_delete' ? 'deletion' : 'pausing'}:`}
                  </label>
                  <textarea
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder={adminAction === 'approve' ? 'e.g., Listing verified as appropriate' : 'Enter reason for admin action...'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <button
                    onClick={adminAction === 'approve' ? handleApproveListing : (adminAction === 'force_delete' ? handleForceDelete : handlePauseListing)}
                    disabled={actionLoading || (adminAction !== 'approve' && !actionReason.trim())}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-medium text-sm"
                  >
                    {actionLoading ? 'Processing...' : `Confirm ${adminAction === 'approve' ? 'Approval' : (adminAction === 'force_delete' ? 'Delete' : 'Pause')}`}
                  </button>
                  <button
                    onClick={() => {
                      setAdminAction(null);
                      setActionReason('');
                    }}
                    disabled={actionLoading}
                    className="w-full px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 disabled:bg-gray-400 font-medium text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
