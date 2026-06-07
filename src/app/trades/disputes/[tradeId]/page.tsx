'use client';
// File: p2p-kids-admin/src/app/trades/disputes/[tradeId]/page.tsx
// TFV2-017: Per-dispute resolution page
// Shows trade summary + dispute details + action buttons

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface DisputeDetail {
  id: string;
  status: string;
  dispute_status: 'reported' | 'under_review' | 'resolved' | null;
  dispute_reason: string | null;
  dispute_opened_at: string | null;
  dispute_resolution: string | null;
  cash_amount_cents: number;
  buyer_transaction_fee_cents: number;
  created_at: string;
  listing: { title: string; price: number } | null;
  buyer_profile: { name: string } | null;
  seller_profile: { name: string } | null;
}

export default function DisputeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tradeId = params.tradeId as string;

  const [trade, setTrade] = useState<DisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadTrade();
  }, [tradeId]);

  const loadTrade = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('trades')
      .select(`
        id, status, dispute_status, dispute_reason, dispute_opened_at,
        dispute_resolution, cash_amount_cents, buyer_transaction_fee_cents, created_at,
        listing:items(title, price),
        buyer_profile:profiles!trades_buyer_id_fkey(name),
        seller_profile:profiles!trades_seller_id_fkey(name)
      `)
      .eq('id', tradeId)
      .single();

    if (error || !data) {
      setMessage({ type: 'error', text: 'Trade not found.' });
    } else {
      setTrade(data as any);
    }
    setLoading(false);
  };

  const callAction = async (action: 'mark_under_review' | 'resolve_complete' | 'resolve_refund') => {
    if (!confirm(`Are you sure you want to: ${action.replace(/_/g, ' ')}?`)) return;
    setActing(true);
    setMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resolve-dispute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ trade_id: tradeId, action }),
        }
      );
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error?.message ?? 'Action failed');
      }
      setMessage({ type: 'success', text: `Action "${action}" completed successfully.` });
      await loadTrade();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message ?? 'Something went wrong.' });
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-500">Loading dispute…</div>;
  }

  if (!trade) {
    return <div className="p-8 text-red-500">Trade not found.</div>;
  }

  const totalCash = ((trade.cash_amount_cents ?? 0) + (trade.buyer_transaction_fee_cents ?? 0)) / 100;

  return (
    <div className="p-8 max-w-3xl">
      <button
        onClick={() => router.back()}
        className="mb-6 text-sm text-blue-600 hover:underline"
      >
        ← Back to disputes
      </button>

      <h1 className="text-2xl font-bold mb-6">Dispute Detail</h1>

      {message && (
        <div
          className={`mb-4 p-3 rounded text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
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

          <dt className="text-gray-500">Buyer</dt>
          <dd className="text-gray-900">{(trade.buyer_profile as any)?.name ?? '—'}</dd>

          <dt className="text-gray-500">Seller</dt>
          <dd className="text-gray-900">{(trade.seller_profile as any)?.name ?? '—'}</dd>

          <dt className="text-gray-500">Trade Status</dt>
          <dd>
            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
              {trade.status}
            </span>
          </dd>

          <dt className="text-gray-500">Trade Created</dt>
          <dd className="text-gray-900">{new Date(trade.created_at).toLocaleString()}</dd>
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
              onClick={() => callAction('mark_under_review')}
              disabled={acting}
              className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
            >
              Mark Under Review
            </button>
          )}

          <button
            onClick={() => callAction('resolve_complete')}
            disabled={acting}
            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            Resolve → Complete
          </button>

          <button
            onClick={() => callAction('resolve_refund')}
            disabled={acting}
            className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50"
          >
            Resolve → Refund
          </button>

          {acting && <span className="text-sm text-gray-500 self-center">Processing…</span>}
        </div>
      )}

      {trade.dispute_status === 'resolved' && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
          This dispute has been resolved.
        </div>
      )}
    </div>
  );
}
