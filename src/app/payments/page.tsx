'use client';

// File: p2p-kids-admin/src/app/payments/page.tsx
// Payments reconciliation ledger — one row per trade showing the charged snapshot
// (item price / platform fee / sales tax / SP / total) vs. refunded totals, sourced
// from the `payments` + `trade_refunds` tables. Finance/ops can reconcile what was
// actually charged and refunded per trade/bundle against the Stripe dashboard.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '';

interface PaymentRow {
  id: string;
  trade_id: string;
  bundle_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  buyer_id: string | null;
  seller_id: string | null;
  buyer_name?: string;
  seller_name?: string;
  currency: string;
  item_price_cents: number;
  platform_fee_cents: number;
  tax_amount_cents: number;
  sp_amount: number;
  total_charged_cents: number;
  refunded_cents: number;
  refunded_price_cents: number;
  refunded_fee_cents: number;
  refunded_tax_cents: number;
  status: string;
  created_at: string;
  updated_at: string;
  captured_at: string | null;
  refunded_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  requires_capture: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  captured: 'bg-blue-100 text-blue-800',
  succeeded: 'bg-green-100 text-green-800',
  refunded: 'bg-red-100 text-red-800',
  partially_refunded: 'bg-orange-100 text-orange-800',
  cancelled: 'bg-gray-200 text-gray-600',
  failed: 'bg-red-100 text-red-800',
};

function cents(n: number): string {
  return `$${((n || 0) / 100).toFixed(2)}`;
}

export default function PaymentsPage() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce the search input (150–250ms per UI perf defaults)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (debouncedQuery) params.set('q', debouncedQuery);
      const res = await fetch(`/api/admin/payments?${params.toString()}`, {
        headers: { 'x-admin-secret': adminSecret },
        cache: 'no-store',
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRows(json.data || []);
      setTotal(json.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [status, debouncedQuery]);

  useEffect(() => {
    load();
  }, [load]);

  const totalCharged = rows.reduce((s, r) => s + (r.total_charged_cents || 0), 0);
  const totalRefunded = rows.reduce((s, r) => s + (r.refunded_cents || 0), 0);
  const netCollected = totalCharged - totalRefunded;
  const refundedCount = rows.filter((r) => (r.refunded_cents || 0) > 0).length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Payments Reconciliation</h1>
          <p className="text-sm text-gray-600 mt-1">
            One row per trade: what was charged (price + fee + tax) vs. what was refunded. Reconcile against the Stripe dashboard.
          </p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
        <div className="bg-white rounded shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Payments (this page)</p>
          <p className="text-2xl font-bold">{rows.length}</p>
          {total > 0 && (
            <p className="text-xs text-gray-500 mt-1">of {total} matching</p>
          )}
        </div>
        <div className="bg-white rounded shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Charged</p>
          <p className="text-2xl font-bold">{cents(totalCharged)}</p>
        </div>
        <div className="bg-white rounded shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Refunded ({refundedCount})</p>
          <p className="text-2xl font-bold text-red-600">{cents(totalRefunded)}</p>
        </div>
        <div className="bg-white rounded shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Net Collected</p>
          <p className="text-2xl font-bold text-green-700">{cents(netCollected)}</p>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-6">
        Summary figures reflect the rows shown above
        {total > rows.length ? ` (the first ${rows.length} of ${total} matching).` : '.'}
      </p>

      {/* Filters */}
      <div className="bg-white rounded shadow-sm border border-gray-200 p-4 mb-6 flex flex-col md:flex-row gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm bg-white"
          data-testid="payment-status-filter"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="requires_capture">Requires Capture</option>
          <option value="processing">Processing</option>
          <option value="captured">Captured</option>
          <option value="succeeded">Succeeded</option>
          <option value="partially_refunded">Partially Refunded</option>
          <option value="refunded">Refunded</option>
          <option value="cancelled">Cancelled</option>
          <option value="failed">Failed</option>
        </select>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search trade id, PI id, or bundle id..."
          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm bg-white"
          data-testid="payment-search"
        />
        <button
          onClick={load}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          data-testid="payment-refresh"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 mb-6 text-red-700 text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-500">Loading payments...</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            No payments match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Trade</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Buyer</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Item Price</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Fee</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Tax</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">SP</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Charged</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Refunded</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Stripe PI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50" data-testid="payment-row">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link href={`/trades/${r.trade_id}`} className="text-blue-600 hover:underline font-mono text-xs" data-testid={`payment-trade-link-${r.id}`}>
                        {r.trade_id.substring(0, 8)}...
                      </Link>
                      {r.bundle_id && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-primary-100 text-primary-700 text-xs">bundle</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">
                      {r.buyer_name || r.buyer_id?.substring(0, 8) || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">{cents(r.item_price_cents)}</td>
                    <td className="px-4 py-3 text-right">{cents(r.platform_fee_cents)}</td>
                    <td className="px-4 py-3 text-right">{cents(r.tax_amount_cents)}</td>
                    <td className="px-4 py-3 text-right text-blue-600">{r.sp_amount} SP</td>
                    <td className="px-4 py-3 text-right font-semibold">{cents(r.total_charged_cents)}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">
                      {(r.refunded_cents || 0) > 0 ? cents(r.refunded_cents) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-700'}`}>
                        {r.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400 max-w-[120px] truncate">
                      {r.stripe_payment_intent_id || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
