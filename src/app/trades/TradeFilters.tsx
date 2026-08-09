'use client';

import { useRouter, useSearchParams } from 'next/navigation';

type ViewMode = 'single' | 'bundles';
type SortField = 'created_at' | 'updated_at' | 'cash_amount_cents' | 'sp_amount';
type SortDir = 'asc' | 'desc';

export default function TradeFilters({ 
  initialStatus, 
  initialSearch,
  initialView = 'single',
  initialDateFrom = '',
  initialDateTo = '',
  initialSort = 'created_at',
  initialSortDir = 'desc',
  initialPageSize = '50',
}: { 
  initialStatus: string; 
  initialSearch: string;
  initialView?: ViewMode;
  initialDateFrom?: string;
  initialDateTo?: string;
  initialSort?: string;
  initialSortDir?: string;
  initialPageSize?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const navigateWithParams = (updates: Record<string, string | null>, resetPage = true) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '' || value === 'all') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    // Reset to page 1 when filters/sort/pageSize change
    if (resetPage && !('page' in updates)) {
      params.delete('page');
    }
    router.push(`/trades?${params.toString()}`);
  };

  const handleStatusChange = (status: string) => {
    navigateWithParams({ status: status === 'all' ? null : status });
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const search = formData.get('search') as string;
    navigateWithParams({ search: search || null });
  };

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    navigateWithParams({ dateFrom: e.target.value || null });
  };

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    navigateWithParams({ dateTo: e.target.value || null });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    // Format: "field_dir" e.g. "created_at_desc"
    const [field, dir] = value.split('_') as [SortField, SortDir];
    // 'created_at_desc' splits to ['created', 'at', 'desc'] — handle that
    if (value.includes('cash_amount')) {
      navigateWithParams({ sort: 'cash_amount_cents', sortDir: dir || 'desc' });
    } else if (value.includes('sp_amount')) {
      navigateWithParams({ sort: 'sp_amount', sortDir: dir || 'desc' });
    } else {
      navigateWithParams({ sort: field || 'created_at', sortDir: dir || 'desc' });
    }
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    navigateWithParams({ pageSize: e.target.value || null });
  };

  const handleViewChange = (view: ViewMode) => {
    navigateWithParams({
      view: view === 'single' ? null : view,
      status: null,
      search: null,
      dateFrom: null,
      dateTo: null,
      page: null,
    }, false);
  };

  // Build the current sort value for the dropdown
  const getSortValue = (): string => {
    if (initialSort === 'cash_amount_cents') return `cash_amount_${initialSortDir || 'desc'}`;
    if (initialSort === 'sp_amount') return `sp_amount_${initialSortDir || 'desc'}`;
    return `${initialSort || 'created_at'}_${initialSortDir || 'desc'}`;
  };

  return (
    <div className="space-y-4 mb-6">
      {/* View Mode Tabs */}
      <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex">
          <button
            onClick={() => handleViewChange('single')}
            className={`flex-1 px-6 py-3 text-sm font-medium text-center transition-colors
              ${initialView === 'single' || initialView === undefined
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            Single Trades
          </button>
          <button
            onClick={() => handleViewChange('bundles')}
            className={`flex-1 px-6 py-3 text-sm font-medium text-center transition-colors
              ${initialView === 'bundles'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            Bundle Trades
          </button>
        </div>
      </div>

      {/* Filters Bar — shown for both views */}
      <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Date Range */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              defaultValue={initialDateFrom}
              onChange={handleDateFromChange}
              className="border border-gray-300 rounded px-2 py-2 text-sm w-36"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              defaultValue={initialDateTo}
              onChange={handleDateToChange}
              className="border border-gray-300 rounded px-2 py-2 text-sm w-36"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select
              name="status"
              defaultValue={initialStatus}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="payment_failed">Payment Failed</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={getSortValue()}
              onChange={handleSortChange}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="created_at_desc">Newest First</option>
              <option value="created_at_asc">Oldest First</option>
              <option value="updated_at_desc">Recently Updated</option>
              <option value="updated_at_asc">Least Recently Updated</option>
              <option value="cash_amount_desc">Highest Amount</option>
              <option value="cash_amount_asc">Lowest Amount</option>
              <option value="sp_amount_desc">Most SP Used</option>
              <option value="sp_amount_asc">Least SP Used</option>
            </select>
          </div>

          {/* Page Size */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Per Page</label>
            <select
              defaultValue={initialPageSize}
              onChange={handlePageSizeChange}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>

          {/* Search (single view only) */}
          {initialView !== 'bundles' && (
            <div className="flex-grow min-w-[200px]">
              <label className="block text-xs font-medium text-gray-700 mb-1">Search Trades</label>
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  name="search"
                  defaultValue={initialSearch}
                  placeholder="Search by ID, Name, Email, or Phone..."
                  className="border border-gray-300 rounded px-3 py-2 text-sm flex-grow"
                />
                <button type="submit" className="bg-blue-600 text-white px-3 py-2 text-sm rounded hover:bg-blue-700 whitespace-nowrap">
                  Search
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
