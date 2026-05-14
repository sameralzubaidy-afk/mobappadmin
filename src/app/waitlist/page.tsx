'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

type WaitlistStatus = 'pending' | 'notified' | 'joined';

interface WaitlistNode {
  id: string;
  name: string;
  city: string;
  state: string;
  zip_code: string;
}

interface WaitlistEntry {
  id: string;
  user_id: string;
  user_display_name: string | null;
  email: string;
  requested_zip: string;
  assigned_node_id: string | null;
  status: WaitlistStatus;
  created_at: string;
  updated_at: string;
  nodes: WaitlistNode | null;
}

interface WaitlistResponse {
  entries: WaitlistEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const statusChipClass: Record<WaitlistStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  notified: 'bg-blue-100 text-blue-800',
  joined: 'bg-emerald-100 text-emerald-800',
};

export default function WaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const getAuthHeaders = async (): Promise<HeadersInit> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const fetchWaitlist = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: '25',
      });

      if (appliedSearch.trim()) {
        params.set('search', appliedSearch.trim());
      }

      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const res = await fetch(`/api/admin/waitlist?${params.toString()}`, {
        headers: await getAuthHeaders(),
      });

      const payload = (await res.json()) as WaitlistResponse | { error?: string };

      if (!res.ok) {
        throw new Error((payload as { error?: string }).error || 'Failed to fetch waitlist data');
      }

      const typedPayload = payload as WaitlistResponse;
      setEntries(typedPayload.entries || []);
      setTotal(typedPayload.total || 0);
      setTotalPages(typedPayload.total_pages || 1);
    } catch (err: any) {
      console.error('[WaitlistPage] fetch error:', err);
      setError(err.message || 'Failed to fetch waitlist data');
      setEntries([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, page, statusFilter]);

  useEffect(() => {
    void fetchWaitlist();
  }, [fetchWaitlist]);

  const statusCounts = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        acc[entry.status] += 1;
        return acc;
      },
      { pending: 0, notified: 0, joined: 0 }
    );
  }, [entries]);

  return (
    <div className="p-8 bg-gray-50 min-h-screen" data-testid="waitlist-page">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">ZIP Waitlist</h1>
          <p className="mt-1 text-gray-600">Users requesting inactive ZIP codes and their fallback node assignment</p>
        </div>
        <button
          onClick={() => {
            void fetchWaitlist();
          }}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          data-testid="waitlist-refresh-button"
        >
          Refresh
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{total}</div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Pending (page)</div>
          <div className="mt-1 text-2xl font-bold text-amber-700">{statusCounts.pending}</div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Notified (page)</div>
          <div className="mt-1 text-2xl font-bold text-blue-700">{statusCounts.notified}</div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Joined (page)</div>
          <div className="mt-1 text-2xl font-bold text-emerald-700">{statusCounts.joined}</div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-lg bg-white p-4 shadow-sm md:flex-row">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or ZIP"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          data-testid="waitlist-search-input"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm md:w-56"
          data-testid="waitlist-status-filter"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="notified">Notified</option>
          <option value="joined">Joined</option>
        </select>
        <button
          onClick={() => {
            setPage(1);
            setAppliedSearch(search.trim());
          }}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
          data-testid="waitlist-apply-filters"
        >
          Apply
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" data-testid="waitlist-error">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        {loading ? (
          <div className="px-6 py-10 text-center text-gray-500">Loading waitlist entries...</div>
        ) : entries.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-500">No waitlist entries found for the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">User</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Requested ZIP</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Assigned Node</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Requested At</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">User ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-700">{entry.user_display_name || 'Unknown user'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{entry.requested_zip}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{entry.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {entry.nodes ? `${entry.nodes.name} (${entry.nodes.zip_code})` : 'No fallback node'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusChipClass[entry.status]}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(entry.created_at).toLocaleString()}</td>
                    <td className="px-6 py-4 text-xs text-gray-500">{entry.user_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Page {page} of {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="waitlist-prev-page"
          >
            Previous
          </button>
          <button
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="waitlist-next-page"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
