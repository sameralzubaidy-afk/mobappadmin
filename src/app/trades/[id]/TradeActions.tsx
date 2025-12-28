'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Use standard client but we will pass service role key in headers for admin actions
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
    if (!reason) {
      alert('Please provide a reason for cancellation');
      return;
    }

    const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const adminUiSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET;

    if (!serviceRoleKey || !supabaseUrl) {
      console.error('Configuration missing:', { hasKey: !!serviceRoleKey, hasUrl: !!supabaseUrl });
      alert('Configuration error: Admin key or URL missing');
      return;
    }

    setLoading(true);
    try {
      console.log('Invoking admin-trade-action via fetch for trade:', tradeId);
      
      // Get current admin user ID for audit log
      const { data: { user } } = await supabase.auth.getUser();
      const adminId = user?.id;

      // Using direct fetch to avoid Supabase client header interference
      const response = await fetch(`${supabaseUrl}/functions/v1/admin-trade-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'x-admin-api-key': serviceRoleKey,
          'x-admin-ui-secret': adminUiSecret || ''
        },
        body: JSON.stringify({
          action: 'force-cancel',
          tradeId,
          reason,
          issue_refund: true,
          adminId: adminId // Pass the actual admin ID for the audit log
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Edge function error response:', data);
        throw new Error(data.error || data.details || `HTTP error ${response.status}`);
      }
      
      console.log('Edge function success:', data);
      alert('Trade force-cancelled successfully');
      window.location.reload();
    } catch (err: any) {
      console.error('Error cancelling trade:', err);
      alert('Failed to cancel trade: ' + (err.message || 'Unknown error'));
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
