import Link from 'next/link';
import BundleTradeActions from './BundleTradeActions';

type Props = { params: { bundleId: string } };

export default async function BundleDetailPage({ params }: Props) {
  const bundleId = params.bundleId;

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return <div className="p-6">Missing server configuration</div>;
  }

  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };

  // Fetch all trades with this bundle_id, ordered by item
  const tradesUrl = `${SUPABASE_URL}/rest/v1/trades?bundle_id=eq.${encodeURIComponent(bundleId)}&select=*&order=created_at.asc`;
  const resp = await fetch(tradesUrl, { headers, cache: 'no-store' });

  if (!resp.ok) {
    const errorText = await resp.text();
    return (
      <div className="p-6 text-red-600">
        <h1 className="text-xl font-bold mb-2">Error Fetching Bundle</h1>
        <p className="bg-red-50 p-4 rounded border border-red-200 font-mono text-sm">
          {resp.status} {resp.statusText}: {errorText}
        </p>
        <Link href="/trades" className="text-blue-600 hover:underline mt-4 block">← Back to Trades</Link>
      </div>
    );
  }

  const trades = await resp.json();

  if (!Array.isArray(trades) || trades.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Bundle Not Found</h1>
        <p className="text-gray-500">No trades found with bundle ID {bundleId}.</p>
        <Link href="/trades" className="text-blue-600 hover:underline mt-4 block">← Back to Trades</Link>
      </div>
    );
  }

  // Fetch buyer + seller profiles (from the first trade)
  const baseTrade = trades[0];
  const [buyerProfileResp, sellerProfileResp, buyerSubscriptionResp] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${encodeURIComponent(baseTrade.buyer_id)}&select=name,email,phone&limit=1`,
      { headers, cache: 'no-store' }
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${encodeURIComponent(baseTrade.seller_id)}&select=name,email,phone&limit=1`,
      { headers, cache: 'no-store' }
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(baseTrade.buyer_id)}&select=status&limit=1`,
      { headers, cache: 'no-store' }
    ),
  ]);

  const buyerProfileRows = buyerProfileResp.ok ? await buyerProfileResp.json() : [];
  const sellerProfileRows = sellerProfileResp.ok ? await sellerProfileResp.json() : [];
  const buyerSubscriptionRows = buyerSubscriptionResp.ok ? await buyerSubscriptionResp.json() : [];

  const buyerProfile = Array.isArray(buyerProfileRows) ? buyerProfileRows[0] : null;
  const sellerProfile = Array.isArray(sellerProfileRows) ? sellerProfileRows[0] : null;
  const buyerSubscription = Array.isArray(buyerSubscriptionRows) ? buyerSubscriptionRows[0] : null;

  // Fetch item details for each trade
  const itemDetails: Record<string, any> = {};
  await Promise.all(
    trades.map(async (trade: any) => {
      if (!trade.listing_id) return;
      const itemResp = await fetch(
        `${SUPABASE_URL}/rest/v1/items?id=eq.${encodeURIComponent(trade.listing_id)}&select=title,price,status,condition,accepts_swap_points&limit=1`,
        { headers, cache: 'no-store' }
      );
      if (itemResp.ok) {
        const itemRows = await itemResp.json();
        itemDetails[trade.id] = Array.isArray(itemRows) ? itemRows[0] : null;
      }
    })
  );

  // Compute bundle totals
  const totalCashCents = trades.reduce((sum: number, t: any) => sum + (t.cash_amount_cents || 0), 0);
  const totalSp = trades.reduce((sum: number, t: any) => sum + (t.sp_amount || 0), 0);
  const totalFeeCents = trades.reduce((sum: number, t: any) => sum + (t.buyer_transaction_fee_cents || 0), 0);
  // TAX-VISIBILITY (2026-07-30): Surface sales tax in the admin bundle breakdown —
  // previously omitted, so "Total Charged" understated what the buyer paid Stripe.
  const totalTaxCents = trades.reduce((sum: number, t: any) => sum + (t.tax_amount_cents || 0), 0);
  const allStatuses = [...new Set(trades.map((t: any) => t.status))];
  const allTerminal = trades.every((t: any) => t.status === 'completed' || t.status === 'cancelled');
  const tradeIds = trades.map((t: any) => t.id);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Bundle Details</h1>
          <p className="text-sm text-gray-500 font-mono mt-1">Bundle ID: {bundleId}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/trades?view=bundles" className="text-blue-600 hover:underline">← Back to Bundle List</Link>
          <span className="text-gray-400 mx-1">|</span>
          <Link href="/trades" className="text-blue-600 hover:underline">All Trades</Link>
        </div>
      </div>

      {/* Bundle Summary Card */}
      <div className="bg-white p-6 rounded shadow-sm border border-gray-200 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold">Bundle Summary</h3>
            <p className="text-sm text-gray-500">{trades.length} item{trades.length !== 1 ? 's' : ''} in this bundle</p>
          </div>
          <div className="flex gap-2">
            {allStatuses.map((status: string) => (
              <span
                key={status}
                className={`px-3 py-1 rounded-full text-sm font-semibold
                  ${status === 'completed' ? 'bg-green-100 text-green-800' :
                    status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'}`}
              >
                {status.toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Buyer</p>
            <p className="font-medium">{buyerProfile?.name || 'Unknown'}</p>
            <p className="text-xs text-gray-600">{buyerProfile?.email}</p>
            {buyerProfile?.phone && <p className="text-xs text-gray-600">{buyerProfile.phone}</p>}
            <p className="text-xs text-gray-400 font-mono mt-1">{baseTrade.buyer_id?.substring(0, 8)}...</p>
          </div>
          <div>
            <p className="text-gray-500">Seller</p>
            <p className="font-medium">{sellerProfile?.name || 'Unknown'}</p>
            <p className="text-xs text-gray-600">{sellerProfile?.email}</p>
            {sellerProfile?.phone && <p className="text-xs text-gray-600">{sellerProfile.phone}</p>}
            <p className="text-xs text-gray-400 font-mono mt-1">{baseTrade.seller_id?.substring(0, 8)}...</p>
          </div>
          <div>
            <p className="text-gray-500">Total Items</p>
            <p className="font-medium text-lg">{trades.length}</p>
          </div>
          <div>
            <p className="text-gray-500">Created</p>
            <p className="font-medium">{new Date(baseTrade.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Monetary Summary */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <h4 className="text-md font-semibold mb-2">Bundle Monetary Breakdown</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-600">Total Cash (All Items)</span>
              <span className="font-medium">${(totalCashCents / 100).toFixed(2)}</span>
            </div>
            {totalSp > 0 && (
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-600">Total Swap Points Applied</span>
                <span className="font-medium text-blue-600">-{totalSp} SP</span>
              </div>
            )}
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-600">Total Platform Fees</span>
              <span className="font-medium">${(totalFeeCents / 100).toFixed(2)}</span>
            </div>
            {totalTaxCents > 0 && (
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-600">Total Sales Tax</span>
                <span className="font-medium">${(totalTaxCents / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between py-1 font-bold text-lg">
              <span>Total Charged (Cash)</span>
              <span>${((totalCashCents + totalFeeCents + totalTaxCents) / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Individual Trade Cards */}
      <h3 className="text-lg font-semibold mb-4">Trades in this Bundle</h3>
      <div className="space-y-4">
        {trades.map((trade: any) => {
          const item = itemDetails[trade.id];
          return (
            <div key={trade.id} className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="text-sm font-mono text-gray-400">{trade.id.substring(0, 8)}...</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
                      ${trade.status === 'completed' ? 'bg-green-100 text-green-800' :
                        trade.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        trade.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'}`}>
                      {trade.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Item</p>
                      <p className="font-medium">{item?.title || 'Unknown item'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Price</p>
                      <p className="font-medium">
                        ${item ? parseFloat(item.price).toFixed(2) : (trade.cash_amount_cents / 100).toFixed(2)}
                        {trade.sp_amount > 0 && <span className="text-xs text-blue-600 ml-1">({trade.sp_amount} SP)</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Condition</p>
                      <p className="font-medium capitalize">{item?.condition?.replace(/_/g, ' ') || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                      <Link
                        href={`/trades/${trade.id}`}
                        className="text-blue-600 text-sm hover:underline"
                      >
                        View Details →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bundle-Level Admin Actions */}
      <BundleTradeActions
        bundleId={bundleId}
        tradeIds={tradeIds}
        allTerminal={allTerminal}
      />
    </div>
  );
}
