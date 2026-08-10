'use client';
// filepath: p2p-kids-admin/src/components/analytics/FeeTierDistributionCard.tsx
// R1 — Tiered Buyer-Fee Engine: fee-tier distribution (flat vs percentage).
// Backed by /api/admin/fee-tier-stats → fn_admin_get_fee_tier_stats.
// BP-49: send x-admin-secret on /api/admin/* browser fetches.

import { useEffect, useState } from 'react';

interface FeeTierRow {
  fee_state: string;
  user_count: number;
  fee_tier: string;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export default function FeeTierDistributionCard() {
  const [rows, setRows] = useState<FeeTierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/fee-tier-stats', {
          headers: { 'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '' },
        });
        const json = await res.json();
        if (cancelled) return;
        if (json.success) {
          setRows(json.data ?? []);
        } else {
          setError(json.error || 'Failed to load fee-tier stats');
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load fee-tier stats');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const total = rows.reduce((s, r) => s + r.user_count, 0);
  const flatCount = rows
    .filter((r) => r.fee_tier === 'flat')
    .reduce((s, r) => s + r.user_count, 0);
  const pctCount = rows
    .filter((r) => r.fee_tier === 'percentage')
    .reduce((s, r) => s + r.user_count, 0);

  return (
    <section className="mb-8" data-testid="fee-tier-distribution">
      <h2 className="text-xl font-semibold mb-4">🛡️ Buyer Fee-Tier Distribution</h2>
      {loading ? (
        <p className="text-sm text-gray-500">Loading fee-tier distribution…</p>
      ) : error ? (
        <p className="text-sm text-red-600">✗ {error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">No fee-tier data yet.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                <p className="text-xs text-green-700 font-medium">Flat fee users</p>
                <p className="text-2xl font-bold text-green-800">{formatNumber(flatCount)}</p>
                <p className="text-xs text-green-600">
                  {total > 0 ? Math.round((flatCount / total) * 100) : 0}% of users
                </p>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-xs text-blue-700 font-medium">Percentage fee users</p>
                <p className="text-2xl font-bold text-blue-800">{formatNumber(pctCount)}</p>
                <p className="text-xs text-blue-600">
                  {total > 0 ? Math.round((pctCount / total) * 100) : 0}% of users
                </p>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-3">Fee State</th>
                  <th className="py-2">Users</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.fee_state} className="border-b border-gray-50">
                    <td className="py-2 pr-3 capitalize">
                      {r.fee_state.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2 font-medium">{formatNumber(r.user_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-3">
              Flat = active members + free users with no completed trade (first-trade
              protection). Percentage = free users with 1+ completed trades. All fee
              amounts are dynamic from admin_config (fees category).
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
