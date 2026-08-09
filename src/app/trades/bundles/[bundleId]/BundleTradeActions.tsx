'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type Props = {
  bundleId: string;
  tradeIds: string[];
  allTerminal: boolean; // true if all trades are completed or cancelled
};

export default function BundleTradeActions({ bundleId, tradeIds, allTerminal }: Props) {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [result, setResult] = useState<{ success: string[]; failed: string[] } | null>(null);

  const handleForceCancelBundle = async () => {
    if (!reason.trim()) {
      alert('Please provide a reason for cancellation');
      return;
    }

    const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET;
    if (!adminSecret) {
      alert('Configuration error: Admin secret missing');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Cancel each trade in the bundle sequentially
      const success: string[] = [];
      const failed: string[] = [];

      for (const tradeId of tradeIds) {
        try {
          const response = await fetch('/api/admin/trades/force-cancel', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-secret': adminSecret,
            },
            body: JSON.stringify({
              tradeId,
              reason: `${reason} [Bundle: ${bundleId.substring(0, 8)}...]`,
              adminId: user?.id ?? null,
            }),
          });

          const data = await response.json();

          if (response.ok) {
            success.push(tradeId.substring(0, 8));
          } else {
            failed.push(`${tradeId.substring(0, 8)}... (${data.error || `HTTP ${response.status}`})`);
          }
        } catch (err) {
          failed.push(`${tradeId.substring(0, 8)}... (${err instanceof Error ? err.message : 'Unknown error'})`);
        }
      }

      setResult({ success, failed });

      if (failed.length === 0) {
        // All succeeded — reload after a moment
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error cancelling bundle:', message);
      alert('Failed to cancel bundle: ' + message);
    } finally {
      setLoading(false);
      setShowCancelModal(false);
    }
  };

  if (allTerminal) {
    return null;
  }

  return (
    <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded">
      <h3 className="text-red-800 font-semibold mb-2">Bundle Admin Interventions</h3>
      <p className="text-sm text-red-600 mb-4">
        Force-cancelling this bundle will attempt to cancel <strong>all {tradeIds.length} trades</strong> in the bundle. 
        Each trade will be marked as cancelled, SP will be re-credited to the buyer, 
        and Stripe refunds will be issued if applicable.
      </p>

      {result && (
        <div className="mb-4 p-3 bg-white rounded border border-gray-200 text-sm">
          <p className="font-semibold text-green-700 mb-1">
            Succeeded: {result.success.length} / {tradeIds.length}
          </p>
          {result.success.length > 0 && (
            <p className="text-xs text-gray-500 font-mono mb-2">
              {result.success.join(', ')}
            </p>
          )}
          {result.failed.length > 0 && (
            <>
              <p className="font-semibold text-red-700 mb-1">Failed:</p>
              <ul className="list-disc list-inside text-xs text-red-600 font-mono">
                {result.failed.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </>
          )}
          {result.failed.length === 0 && (
            <p className="text-xs text-gray-500 mt-1">Page will reload automatically...</p>
          )}
        </div>
      )}
      
      {!showCancelModal ? (
        <button 
          onClick={() => setShowCancelModal(true)}
          disabled={loading}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Force Cancel Entire Bundle'}
        </button>
      ) : (
        <div className="space-y-3">
          <textarea
            placeholder="Reason for cancellation (required for audit log)..."
            className="w-full border border-red-300 rounded p-2 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2">
            <button 
              onClick={handleForceCancelBundle}
              disabled={loading}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : `Confirm Force Cancel (${tradeIds.length} trades)`}
            </button>
            <button 
              onClick={() => setShowCancelModal(false)}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
