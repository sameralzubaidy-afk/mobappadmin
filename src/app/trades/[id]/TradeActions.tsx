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
  cashAmountCents?: number;
  feeCents?: number;
  taxCents?: number;
  cancelRequestStatus?: string | null;
};

function cents(n: number): string {
  return `$${((n || 0) / 100).toFixed(2)}`;
}

export default function TradeActions({
  tradeId,
  status,
  cashAmountCents = 0,
  feeCents = 0,
  taxCents = 0,
  cancelRequestStatus = null,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);

  // FIX-CANCEL (2026-09-01): admin resolve of a buyer cancellation request
  const [showCancelRequestModal, setShowCancelRequestModal] = useState(false);
  const [cancelRequestAction, setCancelRequestAction] = useState<
    'approve_cancel' | 'keep_trade' | null
  >(null);

  // Partial / line-item refund state (PAY-317)
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundPrice, setRefundPrice] = useState<number>(cashAmountCents);
  const [refundFee, setRefundFee] = useState<number>(feeCents);
  const [refundTax, setRefundTax] = useState<number>(taxCents);
  const [refundReason, setRefundReason] = useState('');

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

  const openRefundModal = () => {
    setRefundPrice(cashAmountCents);
    setRefundFee(feeCents);
    setRefundTax(taxCents);
    setRefundReason('');
    setShowRefundModal(true);
  };

  const handlePartialRefund = async () => {
    if (!refundReason.trim()) {
      alert('Please provide a reason for the partial refund');
      return;
    }
    const total = (refundPrice || 0) + (refundFee || 0) + (refundTax || 0);
    if (total <= 0) {
      alert('Enter a refund amount greater than zero');
      return;
    }

    const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET;
    if (!adminSecret) {
      alert('Configuration error: Admin secret missing');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const response = await fetch('/api/admin/trades/partial-refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({
          tradeId,
          refundPriceCents: refundPrice || 0,
          refundFeeCents: refundFee || 0,
          refundTaxCents: refundTax || 0,
          reason: refundReason,
          adminId: user?.id ?? null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data?.data?.error?.message || `HTTP error ${response.status}`);
      }

      alert('Partial refund issued successfully');
      window.location.reload();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error issuing partial refund:', message);
      alert('Failed to issue partial refund: ' + message);
    } finally {
      setLoading(false);
      setShowRefundModal(false);
    }
  };

  const showForceCancel = status !== 'completed' && status !== 'cancelled';
  const showPartialRefund =
    (status === 'completed' || status === 'in_progress' || status === 'payment_processing') &&
    (cashAmountCents + feeCents + taxCents) > 0;
  const showCancelRequestAction =
    cancelRequestStatus === 'requested' || cancelRequestStatus === 'escalated';

  if (!showForceCancel && !showPartialRefund && !showCancelRequestAction) {
    return null;
  }

  const handleResolveCancelRequest = async (action: 'approve_cancel' | 'keep_trade') => {
    const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET;
    if (!adminSecret) {
      alert('Configuration error: Admin secret missing');
      return;
    }
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const response = await fetch('/api/admin/trades/cancel-request-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({ tradeId, action, adminId: user?.id ?? null }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data?.data?.error || `HTTP error ${response.status}`);
      }
      alert(
        action === 'approve_cancel'
          ? 'Cancellation approved and refund issued.'
          : 'Trade kept — request resolved.'
      );
      window.location.reload();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error resolving cancel request:', message);
      alert('Failed to resolve cancel request: ' + message);
    } finally {
      setLoading(false);
      setShowCancelRequestModal(false);
      setCancelRequestAction(null);
    }
  };

  const refundTotal = (refundPrice || 0) + (refundFee || 0) + (refundTax || 0);

  return (
    <div className="mt-6 space-y-4">
      {showForceCancel && (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <h3 className="text-red-800 font-semibold mb-2">Admin Interventions</h3>
          <p className="text-sm text-red-600 mb-4">
            Force-cancelling a trade will mark it as cancelled in the database, re-credit any Swap Points to the buyer, and issue a Stripe refund if applicable.
          </p>

          {!showCancelModal ? (
            <button
              onClick={() => setShowCancelModal(true)}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              data-testid="btn-force-cancel-trade"
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
                data-testid="force-cancel-reason-input"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleForceCancel}
                  disabled={loading}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
                  data-testid="btn-confirm-force-cancel"
                >
                  {loading ? 'Processing...' : 'Confirm Force Cancel'}
                </button>
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
                  data-testid="btn-force-cancel-modal-cancel"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showPartialRefund && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded">
          <h3 className="text-blue-800 font-semibold mb-2">Partial / Line-Item Refund</h3>
          <p className="text-sm text-blue-700 mb-3">
            Refund one or more components (item price, platform fee, sales tax) without cancelling the trade. Original: price {cents(cashAmountCents)} + fee {cents(feeCents)} + tax {cents(taxCents)}.
          </p>

          {!showRefundModal ? (
            <button
              onClick={openRefundModal}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              data-testid="partial-refund-button"
            >
              Issue Partial Refund
            </button>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Item Price</label>
                  <input
                    type="number"
                    min={0}
                    max={cashAmountCents}
                    value={refundPrice}
                    onChange={(e) => setRefundPrice(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    data-testid="refund-price-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Platform Fee</label>
                  <input
                    type="number"
                    min={0}
                    max={feeCents}
                    value={refundFee}
                    onChange={(e) => setRefundFee(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    data-testid="refund-fee-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Sales Tax</label>
                  <input
                    type="number"
                    min={0}
                    max={taxCents}
                    value={refundTax}
                    onChange={(e) => setRefundTax(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    data-testid="refund-tax-input"
                  />
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Total refund: <span className="font-semibold">{cents(refundTotal)}</span>
              </p>
              <textarea
                placeholder="Reason for partial refund (required for audit log)..."
                className="w-full border border-blue-300 rounded p-2 text-sm"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                rows={2}
                data-testid="refund-reason-input"
              />
              <div className="flex gap-2">
                <button
                  onClick={handlePartialRefund}
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                  data-testid="confirm-partial-refund"
                >
                  {loading ? 'Processing...' : `Refund ${cents(refundTotal)}`}
                </button>
                <button
                  onClick={() => setShowRefundModal(false)}
                  className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
                  data-testid="btn-refund-modal-cancel"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showCancelRequestAction && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded">
          <h3 className="text-amber-800 font-semibold mb-2">Buyer Cancellation Request</h3>
          <p className="text-sm text-amber-700 mb-3">
            This buyer requested to cancel the in-progress trade. Approving will cancel the
            trade and refund the buyer. Keeping the trade leaves it in progress.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setCancelRequestAction('approve_cancel');
                setShowCancelRequestModal(true);
              }}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              data-testid="btn-approve-cancel-request"
            >
              Approve Cancel &amp; Refund
            </button>
            <button
              onClick={() => {
                setCancelRequestAction('keep_trade');
                setShowCancelRequestModal(true);
              }}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
              data-testid="btn-keep-trade"
            >
              Keep Trade
            </button>
          </div>

          {showCancelRequestModal && cancelRequestAction && (
            <div className="mt-4 space-y-3 border-t border-amber-200 pt-3">
              <p className="text-sm text-gray-700">
                {cancelRequestAction === 'approve_cancel'
                  ? 'Cancel this trade and refund the buyer? The trade will be cancelled and Swap Points / payment released back.'
                  : "Keep this trade in progress? The buyer's cancellation request will be closed and they will be notified."}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleResolveCancelRequest(cancelRequestAction)}
                  disabled={loading}
                  className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 disabled:opacity-50"
                  data-testid="btn-confirm-resolve-cancel-request"
                >
                  {loading ? 'Processing...' : 'Confirm'}
                </button>
                <button
                  onClick={() => {
                    setShowCancelRequestModal(false);
                    setCancelRequestAction(null);
                  }}
                  className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
                  data-testid="btn-cancel-resolve-cancel-request"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
