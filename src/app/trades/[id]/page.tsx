// File: p2p-kids-admin/src/app/trades/[id]/page.tsx
import Link from 'next/link';
import TradeActions from './TradeActions';

type Props = { params: { id: string } };

export default async function TradeDetailPage({ params }: Props) {
  const id = params.id;
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return <div className="p-6">Missing server configuration</div>;
  }

  // Use profiles table instead of users table for PostgREST relationship
  // Also join subscriptions to get current status. 
  // Note: profiles.subscription_id links to subscriptions.id
  const url = `${SUPABASE_URL}/rest/v1/trades?id=eq.${id}&select=*,buyer:profiles!buyer_id(email,name,phone,subscription:subscriptions!subscription_id(status)),seller:profiles!seller_id(email,name,phone)`;
  const resp = await fetch(url, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    cache: 'no-store'
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    return (
      <div className="p-6 text-red-600">
        <h1 className="text-xl font-bold mb-2">Error Fetching Trade</h1>
        <p className="bg-red-50 p-4 rounded border border-red-200 font-mono text-sm">
          {resp.status} {resp.statusText}: {errorText}
        </p>
        <Link href="/trades" className="text-blue-600 hover:underline mt-4 block">← Back to List</Link>
      </div>
    );
  }

  const rows = await resp.json();
  const trade = Array.isArray(rows) ? rows[0] : null;
  if (!trade) return <div className="p-6">Trade {id} not found.</div>;

  // Fetch audit logs for this trade
  const auditUrl = `${SUPABASE_URL}/rest/v1/admin_audit_logs?entity_id=eq.${id}&entity_type=eq.trade&order=created_at.desc`;
  const auditResp = await fetch(auditUrl, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    cache: 'no-store'
  });
  const auditLogs = await auditResp.json();

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Trade Details</h1>
        <Link href="/trades" className="text-blue-600 hover:underline">← Back to List</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Basic Info & Status */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded shadow-sm border border-gray-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">General Information</h3>
                <p className="text-sm text-gray-500 font-mono">{trade.id}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold 
                ${trade.status === 'completed' ? 'bg-green-100 text-green-800' : 
                  trade.status === 'cancelled' ? 'bg-red-100 text-red-800' : 
                  'bg-blue-100 text-blue-800'}`}>
                {trade.status.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Buyer</p>
                <p className="font-medium">{trade.buyer?.name || 'Unknown'}</p>
                <p className="text-xs text-gray-600">{trade.buyer?.email}</p>
                {trade.buyer?.phone && <p className="text-xs text-gray-600">{trade.buyer.phone}</p>}
                <p className="text-xs text-gray-400 font-mono mt-1">{trade.buyer_id}</p>
              </div>
              <div>
                <p className="text-gray-500">Seller</p>
                <p className="font-medium">{trade.seller?.name || 'Unknown'}</p>
                <p className="text-xs text-gray-600">{trade.seller?.email}</p>
                {trade.seller?.phone && <p className="text-xs text-gray-600">{trade.seller.phone}</p>}
                <p className="text-xs text-gray-400 font-mono mt-1">{trade.seller_id}</p>
              </div>
              <div>
                <p className="text-gray-500">Created At</p>
                <p className="font-medium">{new Date(trade.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Last Updated</p>
                <p className="font-medium">{new Date(trade.last_status_change_at || trade.updated_at).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Monetary Breakdown</h3>
            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Item Price (Total)</span>
                <span className="font-medium">${(((trade.cash_amount_cents - trade.buyer_transaction_fee_cents) / 100) + (trade.sp_amount || 0)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Swap Points Applied</span>
                <span className="font-medium text-blue-600">-{trade.sp_amount || 0} SP</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Cash Component</span>
                <span className="font-medium">${((trade.cash_amount_cents - trade.buyer_transaction_fee_cents) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Platform Fee</span>
                <span className="font-medium">${(trade.buyer_transaction_fee_cents / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 font-bold text-lg">
                <span>Total Charged (Cash)</span>
                <span>${(trade.cash_amount_cents / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Audit Logs */}
          <div className="bg-white p-6 rounded shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Admin Audit Trail</h3>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-gray-500">No admin actions recorded for this trade.</p>
            ) : (
              <div className="space-y-4">
                {auditLogs.map((log: any) => (
                  <div key={log.id} className="text-sm border-l-2 border-blue-500 pl-4 py-1">
                    <p className="font-semibold">{log.action_type.replace(/_/g, ' ').toUpperCase()}</p>
                    <p className="text-gray-600">{log.reason}</p>
                    <p className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString()} by {log.actor_id.substring(0, 8)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: External Links & Actions */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Subscription Context</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500">Status at Initiation</p>
                <p className="font-medium capitalize">{trade.buyer_subscription_status || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-gray-500">Current Status</p>
                <p className="font-medium capitalize">{trade.buyer?.subscription?.status || 'Unknown'}</p>
              </div>
              <Link 
                href={`/subscriptions?user_id=${trade.buyer_id}`}
                className="text-blue-600 text-xs hover:underline block mt-2"
              >
                View Subscription History →
              </Link>
            </div>
          </div>

          <div className="bg-white p-6 rounded shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">External References</h3>
            <div className="space-y-3 text-sm">
              {trade.stripe_payment_intent_id && (
                <div>
                  <p className="text-gray-500">Stripe PaymentIntent</p>
                  <p className="font-mono text-xs break-all">{trade.stripe_payment_intent_id}</p>
                </div>
              )}
              {trade.stripe_refund_id && (
                <div>
                  <p className="text-gray-500">Stripe Refund ID</p>
                  <p className="font-mono text-xs break-all text-red-600">{trade.stripe_refund_id}</p>
                </div>
              )}
              {trade.sp_debit_ledger_entry_id && (
                <div>
                  <p className="text-gray-500">SP Debit Ledger</p>
                  <p className="font-mono text-xs break-all">{trade.sp_debit_ledger_entry_id}</p>
                </div>
              )}
              {trade.sp_credit_ledger_entry_id && (
                <div>
                  <p className="text-gray-500">SP Credit Ledger (Refund)</p>
                  <p className="font-mono text-xs break-all text-green-600">{trade.sp_credit_ledger_entry_id}</p>
                </div>
              )}
            </div>
          </div>

          <TradeActions tradeId={trade.id} status={trade.status} />
        </div>
      </div>
    </div>
  );
}
