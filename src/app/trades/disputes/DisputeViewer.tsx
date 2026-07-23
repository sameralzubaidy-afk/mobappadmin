'use client';
// File: p2p-kids-admin/src/app/trades/disputes/DisputeViewer.tsx
// TFV2-017: Client-side dispute viewer with search, filters, and pagination.

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DisputeActions from './DisputeActions';
import type { DisputeTrade } from './page';

const PAGE_SIZE = 20;

function ageLabel(isoDate: string | null): { label: string; overdue: boolean } {
  if (!isoDate) return { label: 'Unknown', overdue: false };
  const ms = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const overdue = hours >= 24;
  const label = hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h ${minutes}m`;
  return { label, overdue };
}

export default function DisputeViewer({
  disputes,
  uniqueReasons,
  initialStatusFilter,
  initialSearchFilter,
  initialReasonFilter,
}: {
  disputes: DisputeTrade[];
  uniqueReasons: string[];
  initialStatusFilter: string;
  initialSearchFilter: string;
  initialReasonFilter: string;
}) {
  const router = useRouter();

  const [searchText, setSearchText] = useState(initialSearchFilter);
  const [selectedReason, setSelectedReason] = useState(initialReasonFilter);
  const [selectedStatus, setSelectedStatus] = useState(initialStatusFilter);
  const [page, setPage] = useState(1);

  // Debounce search: track the value that's actually used for filtering
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearchFilter);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-poll: re-fetch disputes from server every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 15_000);
    return () => clearInterval(interval);
  }, [router]);

  const updateUrl = useCallback(
    (search: string, reason: string, status: string) => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (reason) params.set('reason', reason);
      if (status && status !== 'all') params.set('status', status);
      const qs = params.toString();
      router.push(qs ? `/trades/disputes?${qs}` : '/trades/disputes', { scroll: false });
    },
    [router],
  );

  // Debounce effect: fires 300ms after searchText last changes
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(searchText);
      setPage(1);
      updateUrl(searchText, selectedReason, selectedStatus);
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchText, selectedReason, selectedStatus, updateUrl]);

  const handleStatusChange = useCallback(
    (value: string) => {
      setSelectedStatus(value);
      setPage(1);
      updateUrl(debouncedSearch, selectedReason, value);
    },
    [debouncedSearch, selectedReason, updateUrl],
  );

  const handleReasonChange = useCallback(
    (value: string) => {
      setSelectedReason(value);
      setPage(1);
      updateUrl(debouncedSearch, value, selectedStatus);
    },
    [debouncedSearch, selectedStatus, updateUrl],
  );

  // Apply client-side filters: search (item title) + reason
  const filtered = useMemo(() => {
    let result = disputes;

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (d) =>
          (d.item_title && d.item_title.toLowerCase().includes(q)) ||
          d.id.toLowerCase().includes(q),
      );
    }

    if (selectedReason) {
      result = result.filter((d) => d.dispute_reason === selectedReason);
    }

    return result;
  }, [disputes, debouncedSearch, selectedReason]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dispute Queue</h1>
        <span className="text-sm text-gray-500">
          {filtered.length} dispute{filtered.length !== 1 ? 's' : ''}
          {filtered.length !== disputes.length && (
            <span className="text-gray-400">
              {' '}
              (filtered from {disputes.length})
            </span>
          )}
        </span>
      </div>

      {/* Filters bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {/* Status filter */}
        <select
          value={selectedStatus}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="reported">Reported</option>
          <option value="under_review">Under Review</option>
          <option value="resolved">Resolved</option>
          <option value="none">None</option>
        </select>

        {/* Search by item name */}
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search by item name or trade ID…"
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 min-w-[220px] focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Reason filter */}
        <select
          value={selectedReason}
          onChange={(e) => handleReasonChange(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Reasons</option>
          {uniqueReasons.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <p className="text-green-700 font-medium">No disputes match the current filters 🎉</p>
        </div>
      )}

      {/* Table */}
      {paginated.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Trade</th>
                  <th className="px-4 py-3 text-left">Item</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-left">Value</th>
                  <th className="px-4 py-3 text-left">Age (SLA: 24h)</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map((d) => {
                  const { label, overdue } = ageLabel(d.dispute_opened_at ?? d.created_at);
                  return (
                    <tr key={d.id} className="bg-white hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <a
                          href={`/trades/disputes/${d.id}`}
                          className="text-blue-600 hover:underline font-mono text-xs"
                        >
                          {d.id.slice(0, 8)}…
                        </a>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Trade status:{' '}
                          <span className="font-medium text-gray-600">{d.status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <span className="text-gray-800 line-clamp-2">
                          {d.item_title ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <span className="text-gray-600 text-xs line-clamp-2">
                          {d.dispute_reason ?? 'No reason provided'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-gray-800">
                          ${((d.cash_amount_cents ?? 0) / 100).toFixed(2)}
                        </span>
                        {(d.sp_amount ?? 0) > 0 && (
                          <span className="text-amber-600 ml-1 text-xs">
                            +{d.sp_amount} SP
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={
                            overdue
                              ? 'text-red-600 font-semibold'
                              : 'text-gray-700'
                          }
                        >
                          {label}
                          {overdue && ' ⚠️ OVERDUE'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            d.dispute_status === 'reported'
                              ? 'bg-orange-100 text-orange-700'
                              : d.dispute_status === 'under_review'
                                ? 'bg-blue-100 text-blue-700'
                                : d.dispute_status === 'resolved'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {d.dispute_status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <DisputeActions
                          tradeId={d.id}
                          currentDisputeStatus={d.dispute_status}
                          tradeStatus={d.status}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <span className="text-xs text-gray-500">
                Page {safePage} of {totalPages}
              </span>
              <button
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
