'use client';
// File: p2p-kids-admin/src/app/trades/disputes/DisputeActions.tsx
// TFV2-017: Admin dispute action buttons.
// Mark Under Review | Resolve → Complete | Resolve → Refund

import { useState } from 'react';

type DisputeStatus = 'reported' | 'under_review' | 'resolved' | 'none';

type Props = {
  tradeId: string;
  currentDisputeStatus: DisputeStatus;
  tradeStatus: string;
};

export default function DisputeActions({ tradeId, currentDisputeStatus, tradeStatus }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET;

  const callAction = async (action: 'mark_under_review' | 'resolve_complete' | 'resolve_refund') => {
    if (!adminSecret) {
      setError('Admin secret not configured');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/trades/dispute-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({ tradeId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setDone(true);
      setTimeout(() => window.location.reload(), 800);
    } catch (err: any) {
      setError(err.message ?? 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  if (done) return <span className="text-green-600 text-xs font-medium">Updated ✓</span>;

  return (
    <div className="flex flex-col gap-1.5">
      {currentDisputeStatus === 'reported' && (
        <button
          onClick={() => callAction('mark_under_review')}
          disabled={loading}
          className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50 whitespace-nowrap"
          data-testid={`btn-dispute-mark-under-review-${tradeId}`}
        >
          Mark Under Review
        </button>
      )}
      {(currentDisputeStatus === 'reported' || currentDisputeStatus === 'under_review') && (
        <>
          <button
            onClick={() => callAction('resolve_complete')}
            disabled={loading}
            className="text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 disabled:opacity-50 whitespace-nowrap"
            data-testid={`btn-dispute-resolve-complete-${tradeId}`}
          >
            Resolve → Complete
          </button>
          <button
            onClick={() => callAction('resolve_refund')}
            disabled={loading}
            className="text-xs px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 whitespace-nowrap"
            data-testid={`btn-dispute-resolve-refund-${tradeId}`}
          >
            Resolve → Refund
          </button>
        </>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
