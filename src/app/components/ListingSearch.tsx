/**
 * File: p2p-kids-admin/src/app/components/ListingSearch.tsx
 * MODULE-04 LISTING-V2-006: Admin Tools for Listing Management
 * 
 * Features:
 * - Search listings by item name, seller email, status, and category
 * - View seller subscription status audit (at creation vs current)
 * - Force-delete or pause listings with reason logging
 * - Display listing metrics
 */

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '';

interface ListingSearchResult {
  id: string;
  title: string;
  price: number;
  accepts_swap_points: boolean;
  status: string;
  seller_id: string;
  category_id?: string | null;
  category_name?: string | null;
  requested_category_name?: string | null;
  is_custom_category?: boolean;
  eligible_for_starter_pack?: boolean;
  starter_pack_claimed?: boolean;
  approved_at?: string;
  // Item detail fields
  description?: string | null;
  condition?: string | null;
  brand?: string | null;
  color?: string[] | null;
  age_group?: string | null;
  gender?: string | null;
  seller?: { 
    name?: string;
    email?: string;
    subscription_status_at_creation?: string;
  };
  created_at: string;
  images?: { url: string; thumbnail_url?: string }[];
  seller_items_count?: number;
}

const getSellerEmail = (listing: ListingSearchResult): string => {
  if (typeof listing.seller?.email === 'string') {
    return listing.seller.email;
  }

  const listingWithLegacyEmail = listing as ListingSearchResult & {
    seller_email?: string;
    email?: string;
  };

  if (typeof listingWithLegacyEmail.seller_email === 'string') {
    return listingWithLegacyEmail.seller_email;
  }

  if (typeof listingWithLegacyEmail.email === 'string') {
    return listingWithLegacyEmail.email;
  }

  return '';
};

interface SearchFilters {
  query: string;
  sellerEmail: string;
  category: string;
  status:
    | 'all'
    | 'active'
    | 'pending'
    | 'needs_edits'
    | 'rejected'
    | 'flagged'
    | 'sold'
    | 'paused'
    | 'draft'
    | 'deleted';
  spEligibleOnly: boolean;
  page: number;
}

const formatStatusLabel = (status: string): string => {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const getStatusBadgeClass = (status: string): string => {
  if (status === 'available') return 'bg-green-100 text-green-800';
  if (status === 'pending') return 'bg-blue-100 text-blue-800';
  if (status === 'flagged') return 'bg-yellow-100 text-yellow-800';
  if (status === 'needs_edits') return 'bg-orange-100 text-orange-800';
  if (status === 'rejected') return 'bg-red-100 text-red-800';
  if (status === 'sold') return 'bg-gray-100 text-gray-800';
  if (status === 'paused') return 'bg-gray-200 text-gray-700';
  if (status === 'draft') return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
};

// Returns the display label for the category column
const getListingCategoryLabel = (listing: ListingSearchResult): string => {
  return listing.category_name || 'Uncategorized';
};

// Show an amber indicator whenever category is "Other" OR a custom name was submitted
const isOtherCategory = (listing: ListingSearchResult): boolean => {
  return (
    listing.category_name?.toLowerCase() === 'other' ||
    (listing.is_custom_category ?? false)
  );
};

export default function ListingSearch() {
  const supabase = useMemo(
    () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  // DEV-TASK-108 (Y08): read the ?q= deep-link param reactively (see the
  // deep-link effect below) so palette / "View all listings" navigations that
  // change q while this page is mounted re-run the search.
  const searchParams = useSearchParams();
  const urlQ = searchParams?.get('q') ?? '';

  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    sellerEmail: '',
    category: 'all',
    status: 'all',
    spEligibleOnly: false,
    page: 1,
  });
  const [listings, setListings] = useState<ListingSearchResult[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  // DEV-TASK-112 item 9: an active search/filter means the visible rows are a
  // page window of a (possibly larger) matching set, so the Results header
  // discloses the page scope instead of implying the number is the full set.
  const isFilterActive =
    filters.query.trim() !== '' ||
    filters.sellerEmail.trim() !== '' ||
    filters.category !== 'all' ||
    filters.status !== 'all' ||
    filters.spEligibleOnly;
  const [loading, setLoading] = useState(false);
  const [selectedListingIds, setSelectedListingIds] = useState<Set<string>>(new Set());
  const [selectedListing, setSelectedListing] = useState<ListingSearchResult | null>(null);
  const [adminAction, setAdminAction] = useState<
    'force_delete' | 'pause' | 'approve' | 'unpause' | 'request_edits' | 'reject' | null
  >(null);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState('');

  // R8 (2026-08-09): AI image-moderation gate status for the selected listing.
  const [moderationGate, setModerationGate] = useState<{
    status: string;
    enforced: boolean;
    total_images?: number;
    approved?: number;
    flagged?: number;
    pending?: number;
  } | null>(null);
  const [moderationGateLoading, setModerationGateLoading] = useState(false);

  // R8: select a listing and fetch its image-moderation gate status.
  const handleSelectListing = async (listing: ListingSearchResult) => {
    setSelectedListing(listing);
    setAdminAction(null);
    setActionReason('');
    setModerationGate(null);
    try {
      setModerationGateLoading(true);
      const { data, error } = await supabase.rpc('get_listing_moderation_gate', {
        p_listing_id: listing.id,
      });
      if (!error && data) {
        setModerationGate(data as typeof moderationGate);
      }
    } catch {
      setModerationGate(null);
    } finally {
      setModerationGateLoading(false);
    }
  };
  
  const ITEMS_PER_PAGE = 20;

  // Skip the initial (empty-query) mount search when a ?q= deep link is present
  // (the deep-link effect below runs the search that matters).
  const skipInitialSearchRef = useRef<boolean | null>(null);
  if (skipInitialSearchRef.current === null) {
    skipInitialSearchRef.current = !!urlQ;
  }

  React.useEffect(() => {
    if (skipInitialSearchRef.current) {
      skipInitialSearchRef.current = false;
      return;
    }
    handleSearch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page]);

  // Command palette / "View all listings" deep link (?q=): prefill the query
  // and run the search. DEV-TASK-108 (Y08): the palette navigates to
  // /listings?...q= — sometimes while this page is ALREADY mounted (same route,
  // new query). The old mount-only ([]) effect never re-ran for a new q, so the
  // page kept showing stale/unfiltered results (e.g. all listings instead of
  // the clicked one). Keying off the live search param fixes that. The query is
  // passed explicitly (not read from the filters closure) so it can never race
  // with the setFilters below.
  React.useEffect(() => {
    if (!urlQ) return;
    setFilters((prev) => ({ ...prev, query: urlQ, page: 1 }));
    void handleSearch(true, urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQ]);

  React.useEffect(() => {
    const loadCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('name')
          .order('name', { ascending: true });

        if (error) {
          console.warn('[ListingSearch] Failed to load categories:', error);
          return;
        }

        const categoryNames = (data || [])
          .map((row) => row.name)
          .filter((name): name is string => typeof name === 'string' && name.trim().length > 0);

        setCategories(categoryNames);
      } catch (err) {
        console.warn('[ListingSearch] Failed to load categories:', err);
      }
    };

    void loadCategories();
  }, [supabase]);

  const isRpcSignatureMismatch = (error: {
    code?: string;
    message?: string;
    details?: string;
  } | null): boolean => {
    if (!error) return false;

    const errorText = `${error.code || ''} ${error.message || ''} ${error.details || ''}`.toLowerCase();

    return (
      error.code === 'PGRST202' ||
      errorText.includes('could not find the function') ||
      errorText.includes('schema cache')
    );
  };

  const handleSearch = async (resetPage = true, overrideQuery?: string) => {
    try {
      setLoading(true);
      const targetPage = resetPage ? 1 : filters.page;
      const normalizedQuery = (overrideQuery ?? filters.query).trim();
      const normalizedSellerEmail = filters.sellerEmail.trim();
      const normalizedCategory = filters.category.trim();

      if (resetPage && filters.page !== 1) {
        setFilters({ ...filters, page: 1 });
        return; // handleSearch will be re-triggered by useEffect
      }
      
      let rpcData: { listings?: ListingSearchResult[]; total_count?: number } | null = null;
      let rpcError: { code?: string; message?: string; details?: string } | null = null;
      let usedLegacySignature = false;

      const primaryResult = await supabase.rpc('admin_search_listings_v2', {
        p_query: normalizedQuery,
        p_status: filters.status,
        p_sp_eligible: filters.spEligibleOnly,
        p_page: targetPage,
        p_items_per_page: ITEMS_PER_PAGE,
        p_category: normalizedCategory,
        p_seller_email: normalizedSellerEmail,
      });

      rpcData = primaryResult.data as { listings?: ListingSearchResult[]; total_count?: number } | null;
      rpcError = primaryResult.error;

      // Backward compatibility: older deployments still expose the legacy function signature
      // without p_category/p_seller_email, which returns 404/PGRST202.
      if (rpcError && isRpcSignatureMismatch(rpcError)) {
        console.warn('[ListingSearch] New RPC signature unavailable, falling back to legacy signature.');

        const legacyResult = await supabase.rpc('admin_search_listings_v2', {
          p_query: normalizedQuery,
          p_status: filters.status,
          p_sp_eligible: filters.spEligibleOnly,
          p_page: targetPage,
          p_items_per_page: ITEMS_PER_PAGE,
        });

        rpcData = legacyResult.data as { listings?: ListingSearchResult[]; total_count?: number } | null;
        rpcError = legacyResult.error;
        usedLegacySignature = true;
      }

      if (rpcError) {
        console.error('[ListingSearch] RPC Error:', rpcError);
        alert('Failed to search listings');
        return;
      }

      let nextListings = rpcData?.listings || [];
      let nextTotalCount = rpcData?.total_count || 0;

      // If we are on a legacy backend, emulate new filters client-side.
      if (usedLegacySignature) {
        if (normalizedCategory !== 'all') {
          const requestedCategory = normalizedCategory.toLowerCase();
          nextListings = nextListings.filter((listing) => {
            const listingCategory = (listing.category_name || '').trim().toLowerCase();
            if (requestedCategory === 'uncategorized') {
              return listingCategory === '';
            }
            return listingCategory === requestedCategory;
          });
        }

        if (normalizedSellerEmail) {
          const requestedEmail = normalizedSellerEmail.toLowerCase();
          nextListings = nextListings.filter((listing) =>
            getSellerEmail(listing).toLowerCase().includes(requestedEmail)
          );
        }

        if (normalizedCategory !== 'all' || normalizedSellerEmail) {
          nextTotalCount = nextListings.length;
        }
      }

      setListings(nextListings);
      setTotalCount(nextTotalCount);

      // Keep selection only for items still visible on current page.
      const visibleIds = new Set(nextListings.map((listing: ListingSearchResult) => listing.id));
      setSelectedListingIds((prev) => {
        const next = new Set<string>();
        prev.forEach((id) => {
          if (visibleIds.has(id)) {
            next.add(id);
          }
        });
        return next;
      });
    } catch (err) {
      console.error('[ListingSearch] Error searching listings:', err);
    } finally {
      setLoading(false);
    }
  };

  // Latest-filters ref so post-action auto-refreshes read the CURRENT filter
  // state instead of a stale closure from when the action started. Fixes the
  // approve→status-filter race where the 100ms refresh re-ran the pre-action
  // (e.g. "pending") filter and clobbered a filter change made in the meantime.
  const latestFiltersRef = useRef(filters);
  useEffect(() => {
    latestFiltersRef.current = filters;
  }, [filters]);

  // Latest-handleSearch ref so the post-action timeout never invokes a stale
  // closure. Assigned during render (read-only from the timeout handler) per the
  // React "latest value" ref pattern — avoids an effect keyed on `handleSearch`,
  // which is recreated every render and would otherwise trip exhaustive-deps.
  const handleSearchRef = useRef(handleSearch);
  handleSearchRef.current = handleSearch;

  // Refresh the queue after a mutation (approve/delete/pause/reject), honoring
  // the CURRENT filter selection rather than blindly re-running the pre-action
  // filter. When the page is already 1, the `filters.page` effect won't fire,
  // so re-run the search explicitly (via the refs, so it sees the latest state).
  const refreshListingsAfterAction = () => {
    const current = latestFiltersRef.current;
    setFilters({ ...current, page: 1 });
    if (current.page === 1) {
      handleSearchRef.current(true);
    }
  };

  const toggleListingSelection = (listingId: string) => {
    setSelectedListingIds((prev) => {
      const next = new Set(prev);
      if (next.has(listingId)) {
        next.delete(listingId);
      } else {
        next.add(listingId);
      }
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedListingIds((prev) => {
      const visibleIds = listings.map((listing) => listing.id);
      const areAllVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));

      if (areAllVisibleSelected) {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      }

      const next = new Set(prev);
      visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectedVisibleCount = listings.filter((listing) => selectedListingIds.has(listing.id)).length;
  const areAllVisibleSelected = listings.length > 0 && selectedVisibleCount === listings.length;

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
      
      // Refresh search results — read the LATEST filters (not the stale closure)
      // so a filter change made while the action modal was open isn't clobbered.
      setTimeout(refreshListingsAfterAction, 100);
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
      
      // Refresh search results — read the LATEST filters (not the stale closure)
      // so a filter change made while the action modal was open isn't clobbered.
      setTimeout(refreshListingsAfterAction, 100);
    } catch (err) {
      console.error('[ListingSearch] Pause exception:', err);
      alert(`Error pausing listing: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // QA Task 31-M finding 1 (P2): a paused listing had no UI path back to
  // available — only Force Delete (or a DB reset). This restores availability
  // via the LIGHTER admin_unpause_listing RPC (paused → available + audit row),
  // NOT admin_approve_listing — so no duplicate "Listing Approved" notification
  // and no starter-pack re-check/eligibility side effects.
  const handleUnpauseListing = async () => {
    if (!selectedListing) {
      alert('No listing selected');
      return;
    }

    try {
      setActionLoading(true);

      const { data, error } = await supabase.rpc('admin_unpause_listing', {
        p_listing_id: selectedListing.id,
        p_reason: actionReason?.trim() || 'Resumed via listing dashboard',
      });

      if (error) {
        console.error('[ListingSearch] Resume error:', error);
        alert(`Failed to resume listing: ${error.message}`);
        return;
      }

      // Check if RPC response indicates failure
      if (data && !data.success) {
        console.error('[ListingSearch] Resume failed:', data.error);
        alert(`Failed to resume listing: ${data.error}`);
        return;
      }

      console.log('[ListingSearch] Resume response:', data);
      alert('Listing resumed and is available again');
      setSelectedListing(null);
      setAdminAction(null);
      setActionReason('');

      // Refresh search results — read the LATEST filters (not the stale closure)
      // so a filter change made while the action modal was open isn't clobbered.
      setTimeout(refreshListingsAfterAction, 100);
    } catch (err) {
      console.error('[ListingSearch] Resume exception:', err);
      alert(`Error resuming listing: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
        // R8: map image-moderation gate errors to clear, actionable copy.
        const code = data.code;
        let reason = data.error;
        if (code === 'MODERATION_BLOCKED_FLAGGED') {
          reason =
            'Blocked by AI moderation: one or more images were flagged. Reject the listing or ask the seller to replace the flagged image.';
        } else if (code === 'MODERATION_IN_PROGRESS') {
          reason =
            "Blocked by AI moderation: this listing's images are still being reviewed. Try again shortly.";
        }
        alert(`Failed to approve listing: ${reason}`);
        return;
      }

      console.log('[ListingSearch] Approval response:', data);
      setApprovalMessage(data.message || 'Listing approved successfully');
      alert(data.message || 'Listing approved successfully');
      
      setSelectedListing(null);
      setAdminAction(null);
      setActionReason('');
      setApprovalMessage('');
      
      // Refresh search results — read the LATEST filters (not the stale closure)
      // so a filter change made while the action modal was open isn't clobbered.
      setTimeout(refreshListingsAfterAction, 100);
    } catch (err) {
      console.error('[ListingSearch] Approval exception:', err);
      alert(`Error approving listing: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const readApiResponse = async (res: Response): Promise<any> => {
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      return res.json();
    }

    const text = await res.text();
    const preview = text.slice(0, 140).replace(/\s+/g, ' ').trim();
    throw new Error(`Unexpected API response (${res.status}): ${preview || 'empty response'}`);
  };

  React.useEffect(() => {
    const hydrateRequestedCategoryName = async () => {
      if (!selectedListing) return;

      const shouldHydrate =
        !selectedListing.requested_category_name?.trim() &&
        selectedListing.category_name?.toLowerCase() === 'other';

      if (!shouldHydrate) return;

      try {
        const res = await fetch(`/api/admin/items/${selectedListing.id}/details`, {
          method: 'GET',
          headers: {
            'x-admin-secret': adminSecret,
          },
        });

        const json = await readApiResponse(res);
        if (!res.ok || !json?.success) return;

        const requestedCategoryName: string | null =
          typeof json?.data?.requested_category_name === 'string'
            ? json.data.requested_category_name.trim() || null
            : null;

        if (!requestedCategoryName) return;

        setSelectedListing((prev) =>
          prev && prev.id === selectedListing.id
            ? {
                ...prev,
                requested_category_name: requestedCategoryName,
                is_custom_category: true,
              }
            : prev
        );

        setListings((prev) =>
          prev.map((listing) =>
            listing.id === selectedListing.id
              ? {
                  ...listing,
                  requested_category_name: requestedCategoryName,
                  is_custom_category: true,
                }
              : listing
          )
        );
      } catch (err) {
        console.warn('[ListingSearch] Failed to hydrate requested category name:', err);
      }
    };

    hydrateRequestedCategoryName();
  }, [selectedListing]);

  const handleModerationStatusUpdate = async (status: 'rejected' | 'needs_edits') => {
    if (!selectedListing) {
      alert('No listing selected');
      return;
    }

    if (!actionReason.trim()) {
      alert(
        status === 'rejected'
          ? 'Please provide a rejection reason'
          : 'Please provide details about what the seller should edit'
      );
      return;
    }

    if (
      !confirm(
        status === 'rejected'
          ? 'Are you sure you want to reject this listing?'
          : 'Send this listing back to seller for edits?'
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);

      const res = await fetch(`/api/admin/items/${selectedListing.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({
          status,
          rejection_reason: actionReason.trim(),
        }),
      });

      const json = await readApiResponse(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Failed to ${status === 'rejected' ? 'reject' : 'request edits'}`);
      }

      alert(status === 'rejected' ? 'Listing rejected successfully' : 'Edit request sent to seller successfully');
      setSelectedListing(null);
      setAdminAction(null);
      setActionReason('');

      // Refresh search results — read the LATEST filters (not the stale closure)
      // so a filter change made while the action modal was open isn't clobbered.
      setTimeout(refreshListingsAfterAction, 100);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ListingSearch] Moderation status update error:', err);
      alert(`Failed moderation action: ${message}`);
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

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
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
              data-testid="listings-search-input"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Seller email input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seller Email
            </label>
            <input
              type="text"
              value={filters.sellerEmail}
              onChange={(e) => setFilters({ ...filters, sellerEmail: e.target.value })}
              placeholder="e.g., seller@example.com"
              data-testid="listings-seller-email-input"
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
              onChange={(e) => setFilters({ ...filters, status: e.target.value as SearchFilters['status'] })}
              data-testid="listings-status-select"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="active">Available</option>
              <option value="pending">Pending</option>
              <option value="needs_edits">Needs Edits</option>
              <option value="rejected">Rejected</option>
              <option value="flagged">Flagged</option>
              <option value="sold">Sold</option>
              <option value="paused">Paused</option>
              <option value="draft">Draft</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>

          {/* Category filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              data-testid="listings-category-select"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="uncategorized">Uncategorized</option>
              {categories.map((categoryName) => (
                <option key={categoryName} value={categoryName}>
                  {categoryName}
                </option>
              ))}
            </select>
          </div>

          {/* SP Filter */}
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.spEligibleOnly}
                onChange={(e) => setFilters({ ...filters, spEligibleOnly: e.target.checked })}
                data-testid="listings-sp-eligible-checkbox"
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
              data-testid="btn-listings-search"
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="grid grid-cols-1 gap-6">
        {/* Listings Table */}
        <div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">
                {isFilterActive ? (
                  <>
                    Results ({listings.length} on this page) of {totalCount}{' '}
                    matching
                  </>
                ) : (
                  <>Results ({totalCount})</>
                )}
                {totalCount > ITEMS_PER_PAGE && (
                  <span className="text-sm font-normal text-gray-600 ml-2">
                    Page {filters.page} of {Math.ceil(totalCount / ITEMS_PER_PAGE)}
                  </span>
                )}
              </h3>
              {selectedVisibleCount > 0 && (
                <div className="mt-1 flex items-center gap-3">
                  <p className="text-sm text-blue-700">
                    Selected on this page: {selectedVisibleCount}
                  </p>
                  <button
                    onClick={() => setSelectedListingIds(new Set())}
                    data-testid="btn-listings-clear-selection"
                    className="text-xs text-blue-700 hover:text-blue-900 underline"
                  >
                    Clear selection
                  </button>
                </div>
              )}
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
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          <input
                            type="checkbox"
                            checked={areAllVisibleSelected}
                            onChange={toggleSelectAllVisible}
                            aria-label="Select all listings on this page"
                            data-testid="listings-select-all"
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Item</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Category</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Price</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">SP</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Seller Email</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Starter Pack</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Seller Items</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listings.map((listing) => (
                        <tr
                          key={listing.id}
                          data-testid={`listings-row-${listing.id}`}
                          className={`border-b hover:bg-gray-50 ${selectedListingIds.has(listing.id) ? 'bg-blue-50/40' : ''}`}
                          onClick={() => handleSelectListing(listing)}
                        >
                          <td className="px-4 py-4 text-sm">
                            <input
                              type="checkbox"
                              checked={selectedListingIds.has(listing.id)}
                              onChange={() => toggleListingSelection(listing.id)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Select ${listing.title}`}
                              data-testid={`listings-row-${listing.id}-select`}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 truncate max-w-xs">
                            {listing.title}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex flex-col gap-1">
                              <span className="text-gray-800">{getListingCategoryLabel(listing)}</span>
                              {isOtherCategory(listing) && (
                                <span className="inline-flex w-fit px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                  {listing.requested_category_name?.trim()
                                    ? `Suggested: ${listing.requested_category_name.trim()}`
                                    : 'Needs Category'}
                                </span>
                              )}
                            </div>
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
                              className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeClass(
                                listing.status
                              )}`}
                            >
                              {formatStatusLabel(listing.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-[200px]">
                            {listing.seller?.email || '—'}
                          </td>
                          <td className="px-6 py-4 text-sm">
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
                            <div className="flex flex-col gap-1">
                              <Link
                                href={`/items/${listing.id}`}
                                data-testid={`listings-view-${listing.id}`}
                                className="text-blue-600 hover:text-blue-800 font-medium"
                              >
                                View
                              </Link>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectListing(listing);
                                }}
                                data-testid={`btn-listings-actions-${listing.id}`}
                                className="text-emerald-600 hover:text-emerald-800 font-medium text-left"
                              >
                                Actions
                              </button>
                            </div>
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
                        data-testid="btn-listings-prev"
                        className="px-3 py-1 border rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                      >
                        ← Previous
                      </button>
                      <button
                        onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                        disabled={filters.page >= Math.ceil(totalCount / ITEMS_PER_PAGE)}
                        data-testid="btn-listings-next"
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

        {/* Selected Listing Details & Actions (Popup Modal) */}
        {selectedListing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="listings-details-modal">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 relative">
              <button
                onClick={() => {
                  setSelectedListing(null);
                  setAdminAction(null);
                  setActionReason('');
                }}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-xl"
                aria-label="Close listing details"
                data-testid="listings-modal-close"
              >
                ×
              </button>

              <h3 className="text-lg font-semibold mb-4 pr-8">📌 Listing Details</h3>

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
                <label className="text-sm font-medium text-gray-700">Category</label>
                <p className="text-sm text-gray-900">{getListingCategoryLabel(selectedListing)}</p>
                {isOtherCategory(selectedListing) && (
                  <div className="mt-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded">
                    {selectedListing.requested_category_name?.trim() ? (
                      <p className="text-xs text-amber-800">
                        <span className="font-semibold">User suggested:</span>{' '}
                        {selectedListing.requested_category_name.trim()}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700">
                        User selected &ldquo;Other&rdquo; — no custom name provided.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Requested Category Name</label>
                <p className="text-sm text-gray-900">
                  {selectedListing.requested_category_name?.trim() || '—'}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Description</label>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">
                  {selectedListing.description?.trim() || '—'}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Condition</label>
                <p className="text-sm text-gray-900 capitalize">
                  {selectedListing.condition
                    ? selectedListing.condition.replace(/_/g, ' ')
                    : '—'}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Brand</label>
                <p className="text-sm text-gray-900">
                  {selectedListing.brand?.trim() || '—'}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Color(s)</label>
                {selectedListing.color && selectedListing.color.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedListing.color.map((c) => (
                      <span key={c} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full capitalize">{c}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">—</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Age Group</label>
                <p className="text-sm text-gray-900">
                  {selectedListing.age_group || '—'}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Gender</label>
                <p className="text-sm text-gray-900 capitalize">
                  {selectedListing.gender || '—'}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">SP Eligible</label>
                <p className="text-sm text-gray-900">{selectedListing.accepts_swap_points ? '✓ Yes' : '✗ No'}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <p className="text-sm text-gray-900">{formatStatusLabel(selectedListing.status)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">AI Image Moderation</label>
                <p className="text-sm text-gray-900">
                  {moderationGateLoading ? (
                    <span className="text-gray-500">Checking…</span>
                  ) : moderationGate ? (
                    <span
                      className={
                        moderationGate.status === 'ok'
                          ? 'text-green-700'
                          : moderationGate.status === 'flagged'
                          ? 'text-red-700'
                          : moderationGate.status === 'pending'
                          ? 'text-amber-700'
                          : 'text-gray-700'
                      }
                    >
                      {moderationGate.status === 'ok'
                        ? `✅ Approved (${moderationGate.approved ?? 0}/${moderationGate.total_images ?? 0} images)`
                        : moderationGate.status === 'flagged'
                        ? `⛔ Flagged (${moderationGate.flagged ?? 0} image(s) block approval)`
                        : moderationGate.status === 'pending'
                        ? `⏳ Reviewing images (${moderationGate.pending ?? 0} pending)`
                        : '🚫 Disabled by admin config'}
                    </span>
                  ) : (
                    <span className="text-gray-500">Unavailable</span>
                  )}
                </p>
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
                    data-testid={`btn-approve-${selectedListing.id}`}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
                  >
                    ✅ Approve Listing
                  </button>
                )}
                {selectedListing.status === 'paused' && (
                  <button
                    onClick={() => setAdminAction('unpause')}
                    data-testid={`btn-resume-${selectedListing.id}`}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
                  >
                    ▶️ Resume / Make Available
                  </button>
                )}
                {(selectedListing.status === 'pending' || selectedListing.status === 'flagged') && (
                  <button
                    onClick={() => setAdminAction('request_edits')}
                    data-testid={`btn-request-edits-${selectedListing.id}`}
                    className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium text-sm"
                  >
                    ✍️ Request Edits
                  </button>
                )}
                {(selectedListing.status === 'pending' || selectedListing.status === 'flagged') && (
                  <button
                    onClick={() => setAdminAction('reject')}
                    data-testid={`btn-reject-${selectedListing.id}`}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
                  >
                    ⛔ Reject Listing
                  </button>
                )}
                {selectedListing.status !== 'deleted' && selectedListing.status !== 'paused' && (
                  <button
                    onClick={() => setAdminAction('pause')}
                    data-testid={`btn-pause-${selectedListing.id}`}
                    className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium text-sm"
                  >
                    ⏸ Pause Listing
                  </button>
                )}
                {selectedListing.status !== 'deleted' && (
                  <button
                    onClick={() => setAdminAction('force_delete')}
                    data-testid={`btn-force-delete-${selectedListing.id}`}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
                  >
                    🗑 Force Delete
                  </button>
                )}
                <button
                  onClick={() => setSelectedListing(null)}
                  data-testid="btn-listings-close"
                  className="w-full px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 font-medium text-sm"
                >
                  Close
                </button>
                </div>
              ) : (
                <div className="space-y-3 bg-red-50 p-4 rounded-lg border border-red-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {adminAction === 'approve'
                      ? 'Admin Notes (optional):'
                      : adminAction === 'unpause'
                        ? 'Reason for resuming (optional):'
                        : adminAction === 'request_edits'
                          ? 'Decision Note (required for Request Edits):'
                          : adminAction === 'reject'
                            ? 'Decision Note (required for Reject):'
                            : `Reason for ${adminAction === 'force_delete' ? 'deletion' : 'pausing'}:`}
                  </label>
                  <textarea
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder={
                      adminAction === 'approve'
                        ? 'e.g., Listing verified as appropriate'
                        : adminAction === 'unpause'
                          ? 'Optional note for the audit log (e.g., restored by mistake)...'
                          : adminAction === 'request_edits'
                            ? 'Provide clear edits required for seller...'
                            : adminAction === 'reject'
                              ? 'Provide clear rejection reason for seller...'
                              : 'Enter reason for admin action...'
                    }
                    data-testid="listings-reason-input"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <button
                    onClick={
                      adminAction === 'approve'
                        ? handleApproveListing
                        : adminAction === 'force_delete'
                          ? handleForceDelete
                          : adminAction === 'pause'
                            ? handlePauseListing
                            : adminAction === 'unpause'
                              ? handleUnpauseListing
                              : adminAction === 'request_edits'
                                ? () => handleModerationStatusUpdate('needs_edits')
                                : () => handleModerationStatusUpdate('rejected')
                    }
                    disabled={
                      actionLoading ||
                      ((adminAction === 'force_delete' ||
                        adminAction === 'pause' ||
                        adminAction === 'request_edits' ||
                        adminAction === 'reject') &&
                        !actionReason.trim())
                    }
                    data-testid="btn-confirm-action"
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-medium text-sm"
                  >
                    {actionLoading
                      ? 'Processing...'
                      : `Confirm ${
                          adminAction === 'approve'
                            ? 'Approval'
                            : adminAction === 'force_delete'
                              ? 'Delete'
                              : adminAction === 'pause'
                                ? 'Pause'
                                : adminAction === 'unpause'
                                  ? 'Resume'
                                  : adminAction === 'request_edits'
                                    ? 'Request Edits'
                                    : 'Reject'
                        }`}
                  </button>
                  <button
                    onClick={() => {
                      setAdminAction(null);
                      setActionReason('');
                    }}
                    disabled={actionLoading}
                    data-testid="btn-cancel-action"
                    className="w-full px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 disabled:bg-gray-400 font-medium text-sm"
                  >
                    Cancel
                  </button>
                </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
