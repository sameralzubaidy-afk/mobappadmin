import { Trade, BundleGroup } from '@/types/trades';
import Link from 'next/link';
import TradeFilters from './TradeFilters';

type Props = {
  searchParams: {
    status?: string;
    search?: string;
    view?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
    sortDir?: string;
    page?: string;
    pageSize?: string;
  };
};

/** Parse sort params into PostgREST order clause */
function buildOrderClause(sort: string, sortDir: string): string {
  const allowedSorts = ['created_at', 'updated_at', 'cash_amount_cents', 'sp_amount'];
  const field = allowedSorts.includes(sort) ? sort : 'created_at';
  const dir = sortDir === 'asc' ? 'asc' : 'desc';
  return `${field}.${dir}.nullslast`;
}

/** Group trades by bundle_id into BundleGroup objects */
function groupTradesIntoBundles(trades: any[]): BundleGroup[] {
  const bundleMap = new Map<string, any[]>();

  for (const t of trades) {
    const bid = t.bundle_id;
    if (!bid) continue;
    if (!bundleMap.has(bid)) {
      bundleMap.set(bid, []);
    }
    bundleMap.get(bid)!.push(t);
  }

  const groups: BundleGroup[] = [];

  for (const [bundleId, bundleTrades] of bundleMap.entries()) {
    const first = bundleTrades[0];
    const statuses = [...new Set(bundleTrades.map((t: any) => t.status))];

    groups.push({
      bundle_id: bundleId,
      bundle_size: bundleTrades.length,
      trades: bundleTrades,
      buyer_id: first.buyer_id,
      seller_id: first.seller_id,
      buyer_name: first.buyer_name ?? null,
      buyer_email: first.buyer_email ?? null,
      buyer_phone: first.buyer_phone ?? null,
      seller_name: first.seller_name ?? null,
      seller_email: first.seller_email ?? null,
      seller_phone: first.seller_phone ?? null,
      total_cash_cents: bundleTrades.reduce((s: number, t: any) => s + (t.cash_amount_cents || 0), 0),
      total_sp: bundleTrades.reduce((s: number, t: any) => s + (t.sp_amount || 0), 0),
      total_fee_cents: bundleTrades.reduce((s: number, t: any) => s + (t.buyer_transaction_fee_cents || 0), 0),
      statuses,
      created_at: first.created_at,
      earliest_created_at: bundleTrades.reduce(
        (earliest: string, t: any) => t.created_at < earliest ? t.created_at : earliest,
        first.created_at
      ),
    });
  }

  return groups;
}

/** Sort bundle groups client-side */
function sortBundleGroups(groups: BundleGroup[], sort: string, sortDir: string): BundleGroup[] {
  const dir = sortDir === 'asc' ? 1 : -1;
  const sorted = [...groups];
  sorted.sort((a, b) => {
    switch (sort) {
      case 'cash_amount_cents':
        return (a.total_cash_cents - b.total_cash_cents) * dir;
      case 'sp_amount':
        return (a.total_sp - b.total_sp) * dir;
      case 'updated_at':
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
      case 'created_at':
      default:
        return (new Date(a.earliest_created_at).getTime() - new Date(b.earliest_created_at).getTime()) * dir;
    }
  });
  return sorted;
}

function PaginationBar({
  currentPage,
  totalPages,
  totalItems,
  label,
  note,
  showTotalWord = true,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  label: string;
  note?: string;
  showTotalWord?: boolean;
}) {
  const searchParams = new URLSearchParams();

  const buildPageUrl = (page: number) => {
    const params = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : ''
    );
    if (page <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(page));
    }
    return `/trades?${params.toString()}`;
  };

  return (
    <div className="bg-white px-6 py-3 border-t border-gray-200 flex items-center justify-between text-sm">
      <div className="text-gray-500">
        {totalItems > 0 ? (
          <>
            Showing page <span className="font-medium">{currentPage}</span> of{' '}
            <span className="font-medium">{totalPages}</span> —{' '}
            <span className="font-medium">{totalItems}</span> {label}
            {showTotalWord ? ' total' : ''}
            {note && <span className="text-gray-400 ml-1">({note})</span>}
          </>
        ) : (
          <span>No {label} found</span>
        )}
      </div>
      <div className="flex gap-2">
        {currentPage > 1 && (
          <Link
            href={buildPageUrl(currentPage - 1)}
            className="px-3 py-1.5 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
          >
            ← Previous
          </Link>
        )}
        {currentPage < totalPages && (
          <Link
            href={buildPageUrl(currentPage + 1)}
            className="px-3 py-1.5 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
          >
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}

export default async function TradesListPage({ searchParams }: Props) {
  const statusFilter = searchParams.status || 'all';
  const searchQuery = searchParams.search || '';
  const dateFrom = searchParams.dateFrom || '';
  const dateTo = searchParams.dateTo || '';
  const sortField = searchParams.sort || 'created_at';
  const sortDir = searchParams.sortDir || 'desc';
  const currentPage = Math.max(1, parseInt(searchParams.page || '1', 10) || 1);
  const pageSize = Math.min(200, Math.max(10, parseInt(searchParams.pageSize || '50', 10) || 50));
  const currentView = searchParams.view === 'bundles' ? 'bundles' : 'single';

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return <div className="p-6">Missing server configuration</div>;
  }

  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };

  // ============================================================
  // BUNDLE VIEW — grouped by bundle_id
  // ============================================================
  if (currentView === 'bundles') {
    let url = `${SUPABASE_URL}/rest/v1/admin_trades_view?select=*&limit=500`;
    url += `&bundle_id=not.is.null`;
    url += `&order=${buildOrderClause(sortField, sortDir)}`;

    if (statusFilter !== 'all') {
      url += `&status=eq.${statusFilter}`;
    }
    if (dateFrom) {
      url += `&created_at=gte.${encodeURIComponent(dateFrom)}`;
    }
    if (dateTo) {
      // Add one day to include the entire To date
      const toDate = new Date(dateTo);
      toDate.setDate(toDate.getDate() + 1);
      url += `&created_at=lt.${encodeURIComponent(toDate.toISOString().split('T')[0])}`;
    }

    const resp = await fetch(url, { headers, cache: 'no-store' });

    if (!resp.ok) {
      const errorText = await resp.text();
      return (
        <div className="p-6 text-red-600">
          <h1 className="text-xl font-bold mb-2">Error Fetching Bundle Trades</h1>
          <p className="bg-red-50 p-4 rounded border border-red-200 font-mono text-sm">
            {resp.status} {resp.statusText}: {errorText}
          </p>
          <Link href="/" className="text-blue-600 hover:underline mt-4 block">← Back to Dashboard</Link>
        </div>
      );
    }

    const data = await resp.json();
    const rawTrades: any[] = Array.isArray(data) ? data : [];
    let bundleGroups = groupTradesIntoBundles(rawTrades);
    bundleGroups = sortBundleGroups(bundleGroups, sortField, sortDir);

    // Paginate bundle groups client-side
    const totalItems = bundleGroups.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const startIdx = (safePage - 1) * pageSize;
    const pagedGroups = bundleGroups.slice(startIdx, startIdx + pageSize);

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Trade Management</h1>
          <Link href="/" className="text-blue-600 hover:underline">← Back to Dashboard</Link>
        </div>

        <TradeFilters
          initialStatus={statusFilter}
          initialSearch={searchQuery}
          initialView="bundles"
          initialDateFrom={dateFrom}
          initialDateTo={dateTo}
          initialSort={sortField}
          initialSortDir={sortDir}
          initialPageSize={String(pageSize)}
        />

        {/* Bundle Table */}
        <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bundle ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items / Statuses</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Buyer / Seller</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pagedGroups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">No bundle trades found</td>
                </tr>
              ) : (
                pagedGroups.map((group) => (
                  <tr key={group.bundle_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {group.bundle_id.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {group.bundle_size} item{group.bundle_size !== 1 ? 's' : ''}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {group.statuses.map((s) => (
                          <span
                            key={s}
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                              ${s === 'completed' ? 'bg-green-100 text-green-800' :
                                s === 'cancelled' ? 'bg-red-100 text-red-800' :
                                s === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'}`}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="text-gray-900 font-medium">
                        B: {group.buyer_name || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {group.buyer_email} {group.buyer_phone && `| ${group.buyer_phone}`}
                      </div>
                      <div className="text-gray-900 font-medium mt-1">
                        S: {group.seller_name || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {group.seller_email} {group.seller_phone && `| ${group.seller_phone}`}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>${(group.total_cash_cents / 100).toFixed(2)} cash</div>
                      {group.total_sp > 0 && (
                        <div className="text-xs text-blue-600">{group.total_sp} SP</div>
                      )}
                      <div className="text-xs text-gray-400">
                        +${(group.total_fee_cents / 100).toFixed(2)} fees
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(group.earliest_created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/trades/bundles/${group.bundle_id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View Bundle
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <PaginationBar
            currentPage={safePage}
            totalPages={totalPages}
            totalItems={totalItems}
            label="bundles"
            showTotalWord={false}
            note={
              rawTrades.length >= 500
                ? 'first 500 trades loaded — bundle count may be capped'
                : 'all matching trades loaded'
            }
          />
        </div>
      </div>
    );
  }

  // ============================================================
  // SINGLE TRADES VIEW (default) — with pagination
  // ============================================================
  let url = `${SUPABASE_URL}/rest/v1/admin_trades_view?select=*&order=${buildOrderClause(sortField, sortDir)}`;
  url += `&bundle_id=is.null`;

  if (statusFilter !== 'all') {
    url += `&status=eq.${statusFilter}`;
  }

  if (searchQuery) {
    const encodedSearch = encodeURIComponent(`*${searchQuery}*`);
    url += `&or=(id.ilike.${encodedSearch},buyer_id.ilike.${encodedSearch},seller_id.ilike.${encodedSearch},buyer_name.ilike.${encodedSearch},buyer_email.ilike.${encodedSearch},buyer_phone.ilike.${encodedSearch},seller_name.ilike.${encodedSearch},seller_email.ilike.${encodedSearch},seller_phone.ilike.${encodedSearch})`;
  }

  if (dateFrom) {
    url += `&created_at=gte.${encodeURIComponent(dateFrom)}`;
  }
  if (dateTo) {
    const toDate = new Date(dateTo);
    toDate.setDate(toDate.getDate() + 1);
    url += `&created_at=lt.${encodeURIComponent(toDate.toISOString().split('T')[0])}`;
  }

  // PostgREST pagination via Range header + Prefer: count=exact
  const offset = (currentPage - 1) * pageSize;
  const rangeEnd = offset + pageSize - 1;
  const resp = await fetch(url, {
    headers: {
      ...headers,
      Range: `${offset}-${rangeEnd}`,
      Prefer: 'count=exact',
    },
    cache: 'no-store',
  });

  if (!resp.ok && resp.status !== 206) {
    const errorText = await resp.text();
    return (
      <div className="p-6 text-red-600">
        <h1 className="text-xl font-bold mb-2">Error Fetching Trades</h1>
        <p className="bg-red-50 p-4 rounded border border-red-200 font-mono text-sm">
          {resp.status} {resp.statusText}: {errorText}
        </p>
        <Link href="/" className="text-blue-600 hover:underline mt-4 block">← Back to Dashboard</Link>
      </div>
    );
  }

  // Parse total count from Content-Range header
  const contentRange = resp.headers.get('content-range') || '';
  const totalItems = contentRange ? parseInt(contentRange.split('/')[1] || '0', 10) || 0 : 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const data = await resp.json();
  const trades: Trade[] = Array.isArray(data) ? data.map((item: any) => ({
    ...item,
    buyer: {
      name: item.buyer_name,
      email: item.buyer_email,
      phone: item.buyer_phone,
    },
    seller: {
      name: item.seller_name,
      email: item.seller_email,
      phone: item.seller_phone,
    },
  })) : [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Trade Management</h1>
        <Link href="/" className="text-blue-600 hover:underline">← Back to Dashboard</Link>
      </div>

      <TradeFilters
        initialStatus={statusFilter}
        initialSearch={searchQuery}
        initialView="single"
        initialDateFrom={dateFrom}
        initialDateTo={dateTo}
        initialSort={sortField}
        initialSortDir={sortDir}
        initialPageSize={String(pageSize)}
      />

      <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trade ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Buyer / Seller</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {trades.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">No trades found</td>
              </tr>
            ) : (
              trades.map((trade) => (
                <tr key={trade.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {trade.id.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                      ${trade.status === 'completed' ? 'bg-green-100 text-green-800' :
                        trade.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        trade.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'}`}>
                      {trade.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="text-gray-900 font-medium">
                      B: {trade.buyer?.name || 'Unknown'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {trade.buyer?.email} {trade.buyer?.phone && `| ${trade.buyer.phone}`}
                    </div>
                    <div className="text-gray-900 font-medium mt-1">
                      S: {trade.seller?.name || 'Unknown'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {trade.seller?.email} {trade.seller?.phone && `| ${trade.seller.phone}`}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${(trade.cash_amount_cents / 100).toFixed(2)}
                    {trade.sp_amount > 0 && <span className="text-xs text-blue-600 ml-1">({trade.sp_amount} SP)</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(trade.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link href={`/trades/${trade.id}`} className="text-blue-600 hover:text-blue-900">
                      View Details
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <PaginationBar
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          label="trades"
        />
      </div>
    </div>
  );
}
