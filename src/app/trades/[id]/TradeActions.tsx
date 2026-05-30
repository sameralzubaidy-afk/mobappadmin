'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Anon client for reading current auth user only — no service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type Props = {
  tradeId: string;
  status: string;
};

export default function TradeActions({ tradeId, status }: Props) {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);

  const handleForceCancel = async () => {
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
    try {
      // Get current admin user ID for audit log
      const { data: { user } } = await supabase.auth.getUser();

      // Call the server-side API route — service role key never touches the browser
      const response = await fetch('/api/admin/trades/force-cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({
          tradeId,
          reason,
          adminId: user?.id ?? null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error ${response.status}`);
      }

      alert('Trade force-cancelled successfully');
      window.location.reload();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error cancelling trade:', message);
      alert('Failed to cancel trade: ' + message);
    } finally {
      setLoading(false);
      setShowCancelModal(false);
    }
  };

  if (status === 'completed' || status === 'cancelled') {
    return null;
  }

  return (
    <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded">
      <h3 className="text-red-800 font-semibold mb-2">Admin Interventions</h3>
      <p className="text-sm text-red-600 mb-4">
        Force-cancelling a trade will mark it as cancelled in the database, re-credit any Swap Points to the buyer, and issue a Stripe refund if applicable.
      </p>
      
      {!showCancelModal ? (
        <button 
          onClick={() => setShowCancelModal(true)}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
        >
          Force Cancel Trade
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
              onClick={handleForceCancel}
              disabled={loading}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Confirm Force Cancel'}
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
