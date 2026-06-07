// File: p2p-kids-admin/src/app/trades/disputes/page.tsx
// TFV2-017: Dispute Admin Dashboard Queue
// Lists trades where dispute_status IN ('reported', 'under_review')
// Shows SLA age (24h target), allows admin to mark under_review or resolve.

export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import DisputeActions from './DisputeActions';

// Server component — never exposes service role key to browser
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface DisputeTrade {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  dispute_status: 'reported' | 'under_review' | 'resolved';
  dispute_reason: string | null;
  dispute_opened_at: string | null;
  cash_amount_cents: number;
  sp_amount: number;
  created_at: string;
  item_title: string | null;
}

function ageLabel(isoDate: string | null): { label: string; overdue: boolean } {
  if (!isoDate) return { label: 'Unknown', overdue: false };
  const ms = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const overdue = hours >= 24;
  const label = hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h ${minutes}m`;
  return { label, overdue };
}

export default async function DisputeQueuePage() {
  const { data: trades, error } = await supabaseAdmin
    .from('trades')
    .select(`
      id,
      listing_id,
      buyer_id,
      seller_id,
      status,
      dispute_status,
      dispute_reason,
      dispute_opened_at,
      cash_amount_cents,
      sp_amount,
      created_at,
      items!listing_id(title)
    `)
    .in('dispute_status', ['reported', 'under_review'])
    .order('dispute_opened_at', { ascending: true });

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Dispute Queue</h1>
        <p className="text-red-600">Failed to load disputes: {error.message}</p>
      </div>
    );
  }

  const disputes: DisputeTrade[] = (trades ?? []).map((t: any) => ({
    ...t,
    item_title: Array.isArray(t.items) ? t.items[0]?.title ?? null : t.items?.title ?? null,
  }));

  const reported = disputes.filter((d) => d.dispute_status === 'reported');
  const underReview = disputes.filter((d) => d.dispute_status === 'under_review');

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dispute Queue</h1>
        <span className="text-sm text-gray-500">
          {disputes.length} open dispute{disputes.length !== 1 ? 's' : ''}
        </span>
      </div>

      {disputes.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <p className="text-green-700 font-medium">No open disputes 🎉</p>
        </div>
      )}

      {reported.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold text-orange-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
            Reported ({reported.length}) — Needs review
          </h2>
          <DisputeTable rows={reported} />
        </section>
      )}

      {underReview.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-blue-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            Under Review ({underReview.length})
          </h2>
          <DisputeTable rows={underReview} />
        </section>
      )}
    </div>
  );
}

function DisputeTable({ rows }: { rows: DisputeTrade[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
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
          {rows.map((d) => {
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
                    Trade status: <span className="font-medium text-gray-600">{d.status}</span>
                  </div>
                </td>
                <td className="px-4 py-3 max-w-xs">
                  <span className="text-gray-800 line-clamp-2">{d.item_title ?? '—'}</span>
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
                    <span className="text-amber-600 ml-1 text-xs">+{d.sp_amount} SP</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={overdue ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                    {label}
                    {overdue && ' ⚠️ OVERDUE'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      d.dispute_status === 'reported'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-blue-100 text-blue-700'
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
  );
}
