// File: p2p-kids-admin/src/app/trades/page.tsx
import { Trade } from '@/types/trades';
import Link from 'next/link';
import TradeFilters from './TradeFilters';

type Props = {
  searchParams: {
    status?: string;
    search?: string;
  };
};

export default async function TradesListPage({ searchParams }: Props) {
  const statusFilter = searchParams.status || 'all';
  const searchQuery = searchParams.search || '';

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return <div className="p-6">Missing server configuration</div>;
  }

  // Use the admin_trades_view for easier searching across joined tables
  let url = `${SUPABASE_URL}/rest/v1/admin_trades_view?select=*&order=created_at.desc&limit=50`;
  
  if (statusFilter !== 'all') {
    url += `&status=eq.${statusFilter}`;
  }
  
  if (searchQuery) {
    // Enhanced search using the flat fields in the view
    const encodedSearch = encodeURIComponent(`*${searchQuery}*`);
    url += `&or=(id.ilike.${encodedSearch},buyer_id.ilike.${encodedSearch},seller_id.ilike.${encodedSearch},buyer_name.ilike.${encodedSearch},buyer_email.ilike.${encodedSearch},buyer_phone.ilike.${encodedSearch},seller_name.ilike.${encodedSearch},seller_email.ilike.${encodedSearch},seller_phone.ilike.${encodedSearch})`;
  }

  const resp = await fetch(url, {
    headers: { 
      apikey: SUPABASE_SERVICE_ROLE_KEY, 
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` 
    },
    cache: 'no-store'
  });

  if (!resp.ok) {
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

  const data = await resp.json();
  // Map view fields to the Trade interface structure expected by the UI
  const trades: Trade[] = Array.isArray(data) ? data.map((item: any) => ({
    ...item,
    buyer: {
      name: item.buyer_name,
      email: item.buyer_email,
      phone: item.buyer_phone
    },
    seller: {
      name: item.seller_name,
      email: item.seller_email,
      phone: item.seller_phone
    }
  })) : [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Trade Management</h1>
        <Link href="/" className="text-blue-600 hover:underline">← Back to Dashboard</Link>
      </div>

      {/* Filters (Client Component) */}
      <TradeFilters initialStatus={statusFilter} initialSearch={searchQuery} />

      {/* Table */}
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
      </div>
    </div>
  );
}
