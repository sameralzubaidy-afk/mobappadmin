// File: p2p-kids-admin/src/app/components/TradeAnalytics.tsx
import { TradeAnalytics as ITradeAnalytics } from '@/types/trades';

export default async function TradeAnalytics(): Promise<JSX.Element | null> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_get_trade_analytics`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!resp.ok) {
    return <div className="p-4 text-red-600">Error loading trade analytics</div>;
  }

  const stats: ITradeAnalytics = await resp.json();

  const completedCount = stats.status_counts?.completed || 0;
  const total = stats.total_volume || 0;
  const completedRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div
        className="bg-white p-4 rounded-2xl border" // 16px radius (§8.2)
        style={{ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)', borderColor: 'var(--neutral-300)' }} // Level 1 shadow (§8.1)
      >
        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Total Trades</p>
        <p className="text-2xl font-bold">{total}</p>
      </div>

      <div
        className="bg-white p-4 rounded-2xl border"
        style={{ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)', borderColor: 'var(--neutral-300)' }}
      >
        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Fee Revenue</p>
        <p className="text-2xl font-bold" style={{ color: 'var(--success-500)' }}>${(stats.total_fee_revenue_cents / 100).toFixed(2)}</p>
      </div>

      <div
        className="bg-white p-4 rounded-2xl border"
        style={{ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)', borderColor: 'var(--neutral-300)' }}
      >
        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Avg SP Usage</p>
        <p className="text-2xl font-bold" style={{ color: 'var(--secondary-500)' }}>{Math.round(stats.avg_sp_usage)} SP</p>
      </div>

      <div
        className="bg-white p-4 rounded-2xl border"
        style={{ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)', borderColor: 'var(--neutral-300)' }}
      >
        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Completed Rate</p>
        <p className="text-2xl font-bold">{completedRate}%</p>
      </div>
    </div>
  );
}
