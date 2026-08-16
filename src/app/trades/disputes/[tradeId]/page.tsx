'use client';
// File: p2p-kids-admin/src/app/trades/disputes/[tradeId]/page.tsx
// TFV2-017: Per-dispute resolution page
// Shows trade summary + dispute details + action buttons

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type ResolveAction = 'mark_under_review' | 'resolve_complete' | 'resolve_refund';

interface DisputeDetail {
  id: string;
  status: string;
  dispute_status: 'reported' | 'under_review' | 'resolved' | null;
  dispute_reason: string | null;
  dispute_notes: string | null;
  dispute_opened_at: string | null;
  dispute_resolution: string | null;
  cash_amount_cents: number;
  sp_amount: number;
  buyer_transaction_fee_cents: number;
  buyer_id: string;
  seller_id: string;
  listing: { title: string; price: number } | null;
}

export default function DisputeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tradeId = params.tradeId as string;

  const [trade, setTrade] = useState<DisputeDetail | null>(null);
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
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to load dispute');
      setTrade(json.trade);
    } catch (e: any) {
      setError(e.message || 'Failed to load dispute');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (action: ResolveAction) => {
    if (!confirm(`Are you sure you want to: ${action.replace(/_/g, ' ')}?`)) return;
    setSubmitting(true);
    setError(null);
    try {
      const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '';
      const res = await fetch('/api/admin/trades/dispute-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({ tradeId, action }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Action failed');
      setConfirming(null);
      await fetchDispute();
      if (action !== 'mark_under_review') {
        router.push('/trades/disputes');
      }
    } catch (e: any) {
      setError(e.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-500">Loading dispute…</div>;
  }

  if (error || !trade) {
    return (
      <div className="p-8">
        <div className="text-red-500 mb-4">{error || 'Trade not found.'}</div>
        <button onClick={() => router.push('/trades/disputes')} className="text-sm text-blue-600 hover:underline" data-testid="btn-dispute-back">
          ← Back to disputes
        </button>
      </div>
    );
  }

  const totalCash = ((trade.cash_amount_cents ?? 0) + (trade.buyer_transaction_fee_cents ?? 0)) / 100;

  return (
    <div className="p-8 max-w-3xl">
      <button
        onClick={() => router.push('/trades/disputes')}
        className="mb-6 text-sm text-blue-600 hover:underline"
        data-testid="btn-dispute-back"
      >
        ← Back to disputes
      </button>

      <h1 className="text-2xl font-bold mb-6">Dispute Detail</h1>

      {error && (
        <div className="mb-4 p-3 rounded text-sm bg-red-50 text-red-800 border border-red-200">
          {error}
        </div>
      )}

      {/* Trade Summary */}
      <div className="bg-white rounded-lg border p-5 mb-5">
        <h2 className="font-semibold text-gray-700 mb-3">Trade Summary</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-gray-500">Trade ID</dt>
          <dd className="font-mono text-gray-900 break-all">{trade.id}</dd>

          <dt className="text-gray-500">Listing</dt>
          <dd className="text-gray-900">{(trade.listing as any)?.title ?? '—'}</dd>

          <dt className="text-gray-500">Price</dt>
          <dd className="text-gray-900">${(trade.listing as any)?.price?.toFixed(2) ?? '—'}</dd>

          <dt className="text-gray-500">Cash Total</dt>
          <dd className="text-gray-900">${totalCash.toFixed(2)}</dd>

          <dt className="text-gray-500">Buyer ID</dt>
          <dd className="font-mono text-gray-900 text-xs break-all">{trade.buyer_id}</dd>

          <dt className="text-gray-500">Seller ID</dt>
          <dd className="font-mono text-gray-900 text-xs break-all">{trade.seller_id}</dd>

          <dt className="text-gray-500">Trade Status</dt>
          <dd>
            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
              {trade.status}
            </span>
          </dd>

          <dt className="text-gray-500">SP Amount</dt>
          <dd className="text-gray-900">{trade.sp_amount} SP</dd>
        </dl>
      </div>

      {/* Dispute Details */}
      <div className="bg-amber-50 rounded-lg border border-amber-200 p-5 mb-5">
        <h2 className="font-semibold text-amber-800 mb-3">Dispute Details</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-gray-500">Dispute Status</dt>
          <dd>
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                trade.dispute_status === 'reported'
                  ? 'bg-yellow-100 text-yellow-800'
                  : trade.dispute_status === 'under_review'
                  ? 'bg-orange-100 text-orange-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {trade.dispute_status ?? 'none'}
            </span>
          </dd>

          <dt className="text-gray-500">Reason</dt>
          <dd className="text-gray-900">{trade.dispute_reason ?? '—'}</dd>

          <dt className="text-gray-500">Reported At</dt>
          <dd className="text-gray-900">
            {trade.dispute_opened_at
              ? new Date(trade.dispute_opened_at).toLocaleString()
              : '—'}
          </dd>

          <dt className="text-gray-500">Resolution</dt>
          <dd className="text-gray-900">{trade.dispute_resolution ?? '—'}</dd>
        </dl>
      </div>

      {/* Action Buttons */}
      {trade.dispute_status !== 'resolved' && (
        <div className="flex flex-wrap gap-3">
          {trade.dispute_status === 'reported' && (
            <button
              onClick={() => setConfirming('mark_under_review')}
              disabled={submitting}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-lg disabled:opacity-50"
              data-testid="btn-dispute-mark-under-review"
            >
              Mark Under Review
            </button>
          )}

          <button
            onClick={() => setConfirming('resolve_complete')}
            disabled={submitting}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg disabled:opacity-50"
            data-testid="btn-dispute-resolve-complete"
          >
            Resolve → Complete
          </button>

          <button
            onClick={() => setConfirming('resolve_refund')}
            disabled={submitting}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg disabled:opacity-50"
            data-testid="btn-dispute-resolve-refund"
          >
            Resolve → Refund Buyer
          </button>
        </div>
      )}

      {trade.dispute_status === 'resolved' && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
          This dispute has been resolved.
        </div>
      )}

      {/* Confirmation modal */}
      {confirming && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="dispute-confirm-modal">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              {confirming === 'mark_under_review'
                ? 'Mark Under Review?'
                : confirming === 'resolve_complete'
                ? 'Resolve as Complete?'
                : 'Resolve with Refund?'}
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              {confirming === 'mark_under_review'
                ? 'The dispute status will be updated to Under Review.'
                : confirming === 'resolve_complete'
                ? 'The trade will be marked complete. Seller payout will proceed normally.'
                : 'The buyer will receive a full refund. Seller payout will be cancelled. This action cannot be undone.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(null)}
                disabled={submitting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                data-testid="btn-dispute-confirm-cancel"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResolve(confirming)}
                disabled={submitting}
                className={`flex-1 px-4 py-2 text-white font-semibold rounded-lg disabled:opacity-50 ${
                  confirming === 'resolve_refund'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
                data-testid="btn-dispute-confirm-submit"
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
