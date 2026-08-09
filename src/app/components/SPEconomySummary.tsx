// File: p2p-kids-admin/src/app/components/SPEconomySummary.tsx
// Module: MODULE-12-ADMIN-V2 / TASK ADMIN-V2-003
// Server component – fetches SP economy metrics and renders a summary card
// used on the admin home page alongside TradeAnalytics.

import type { SpEconomyMetrics } from '@/types/sp-wallet';

export default async function SPEconomySummary(): Promise<JSX.Element | null> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  let metrics: SpEconomyMetrics | null = null;

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_sp_economy_metrics`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      cache: 'no-store',
    });

    if (resp.ok) {
      metrics = await resp.json();
    }
  } catch {
    // Non-fatal – home page still renders without this card
    return null;
  }

  if (!metrics) return null;

  const fmt = (n: number) => n.toLocaleString();

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-4 gap-4"
      data-testid="sp-economy-summary"
    >
      <div
        className="bg-white p-4 rounded-2xl border" // 16px radius (§8.2)
        style={{ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)', borderColor: 'var(--neutral-300)' }} // Level 1 shadow (§8.1)
      >
        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">SP Circulation</p>
        <p className="text-2xl font-bold" style={{ color: 'var(--sp-500)' }}>{fmt(metrics.current_circulation)} SP</p>
      </div>

      <div
        className="bg-white p-4 rounded-2xl border"
        style={{ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)', borderColor: 'var(--neutral-300)' }}
      >
        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Total Earned</p>
        <p className="text-2xl font-bold" style={{ color: 'var(--success-500)' }}>{fmt(metrics.total_earned)} SP</p>
      </div>

      <div
        className="bg-white p-4 rounded-2xl border"
        style={{ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)', borderColor: 'var(--neutral-300)' }}
      >
        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Total Spent</p>
        <p className="text-2xl font-bold" style={{ color: 'var(--error-500)' }}>{fmt(metrics.total_spent)} SP</p>
      </div>

      <div
        className="bg-white p-4 rounded-2xl border"
        style={{ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)', borderColor: 'var(--neutral-300)' }}
      >
        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Active Wallets</p>
        <p className="text-2xl font-bold">{fmt(metrics.active_wallets)}</p>
      </div>
    </div>
  );
}
