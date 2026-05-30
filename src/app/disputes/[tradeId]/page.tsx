'use client';

// File: p2p-kids-admin/src/app/disputes/[tradeId]/page.tsx
// TFV2-017: Admin Dispute Detail — resolve or mark under_review

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type DisputeTrade = {
  id: string;
  status: string;
  dispute_status: string;
  dispute_reason: string | null;
  dispute_notes: string | null;
  dispute_reported_at: string | null;
  dispute_resolution: string | null;
  buyer_id: string;
  seller_id: string;
  cash_amount_cents: number;
  sp_amount: number;
  buyer_transaction_fee_cents: number;
  listing?: { title: string | null; price: number | null } | null;
};

type ResolveAction = 'mark_under_review' | 'resolve_complete' | 'resolve_refund';

export default function DisputeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tradeId = params?.tradeId as string;

  const [trade, setTrade] = useState<DisputeTrade | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ResolveAction | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tradeId) return;
    fetchDispute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeId]);

  const fetchDispute = async () => {
    setLoading(true);
    setError(null);
    try {
      const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '';
      const res = await fetch(`/api/admin/disputes/${tradeId}`, {
        headers: { 'x-admin-secret': adminSecret },
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to load');
      setTrade(json.trade);
    } catch (e: any) {
      setError(e.message || 'Failed to load dispute');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (action: ResolveAction) => {
    setSubmitting(true);
    setError(null);
    try {
      const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '';
      // Reuse the existing dispute-action route
      const res = await fetch('/api/admin/trades/dispute-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({ tradeId, action }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Failed');
      setConfirming(null);
      await fetchDispute();
      if (action !== 'mark_under_review') {
        router.push('/disputes');
      }
    } catch (e: any) {
      setError(e.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-48">
        <div className="text-gray-500">Loading dispute…</div>
      </div>
    );
  }

  if (error || !trade) {
    return (
      <div className="p-6">
        <div className="text-red-600 mb-4">{error || 'Dispute not found'}</div>
        <Link href="/disputes" className="text-blue-600 hover:underline">← Back to disputes</Link>
      </div>
    );
  }

  const isResolved = !['reported', 'under_review'].includes(trade.dispute_status);

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-4">
        <Link href="/disputes" className="text-sm text-blue-600 hover:underline">
          ← Back to disputes
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dispute Detail</h1>

      {/* Trade summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 font-medium">Trade ID</span>
          <span className="font-mono text-gray-800">{trade.id}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 font-medium">Item</span>
          <span className="text-gray-900">{trade.listing?.title ?? '—'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 font-medium">Item Price</span>
          <span className="text-gray-900">${((trade.listing?.price ?? 0)).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 font-medium">Cash Paid</span>
          <span className="text-gray-900">${(trade.cash_amount_cents / 100).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 font-medium">SP Used</span>
          <span className="text-gray-900">{trade.sp_amount} SP</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 font-medium">Trade Status</span>
          <span className="capitalize text-gray-800">{trade.status.replace('_', ' ')}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 font-medium">Dispute Status</span>
          <span
            className={`capitalize font-semibold ${
              trade.dispute_status === 'under_review' ? 'text-yellow-700' : 'text-orange-700'
            }`}
          >
            {trade.dispute_status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Dispute details */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6 space-y-3">
        <h2 className="font-semibold text-amber-900">Buyer's Reported Issue</h2>
        <div className="text-sm">
          <span className="text-amber-700 font-medium">Reason: </span>
          <span className="text-amber-900">{trade.dispute_reason?.replace('_', ' ') ?? '—'}</span>
        </div>
        {trade.dispute_notes && (
          <div className="text-sm">
            <span className="text-amber-700 font-medium">Notes: </span>
            <span className="text-amber-900">{trade.dispute_notes}</span>
          </div>
        )}
        {trade.dispute_reported_at && (
          <div className="text-sm text-amber-600">
            Reported: {new Date(trade.dispute_reported_at).toLocaleString()}
          </div>
        )}
      </div>

      {/* Actions */}
      {!isResolved ? (
        <div className="flex flex-wrap gap-3">
          {trade.dispute_status === 'reported' && (
            <button
              onClick={() => handleResolve('mark_under_review')}
              disabled={submitting}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-lg disabled:opacity-50"
            >
              {submitting && confirming === null ? 'Updating…' : 'Mark Under Review'}
            </button>
          )}

          <button
            onClick={() => setConfirming('resolve_complete')}
            disabled={submitting}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg disabled:opacity-50"
          >
            Resolve → Complete
          </button>

          <button
            onClick={() => setConfirming('resolve_refund')}
            disabled={submitting}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg disabled:opacity-50"
          >
            Resolve → Refund Buyer
          </button>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 font-medium">
          Dispute resolved — {trade.dispute_resolution ?? 'outcome recorded'}
        </div>
      )}

      {error && (
        <div className="mt-4 text-red-600 text-sm">{error}</div>
      )}

      {/* Confirmation modal */}
      {confirming && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              {confirming === 'resolve_complete' ? 'Resolve as Complete?' : 'Resolve with Refund?'}
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              {confirming === 'resolve_complete'
                ? 'The trade will be marked complete. Seller payout will proceed normally.'
                : 'The buyer will receive a full refund. Seller payout will be cancelled. This action cannot be undone.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(null)}
                disabled={submitting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResolve(confirming)}
                disabled={submitting}
                className={`flex-1 px-4 py-2 text-white font-semibold rounded-lg disabled:opacity-50 ${
                  confirming === 'resolve_complete'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {submitting ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
