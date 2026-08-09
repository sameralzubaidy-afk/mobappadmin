'use client';

// File: p2p-kids-admin/src/app/audit/page.tsx
// Financial Audit — the unified N2 journal (`financial_audit_log`).
// Shows every payment / Swap Points / fee / tax transition with actor, before/
// after state, amount, idempotency key, node, and a link to the trade when the
// entity is a trade. Searchable by entity id / trade id / idempotency key and
// filterable by mutation type, entity type, and date range.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '';

interface AuditRow {
  id: string;
  mutation_type: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_id_text: string | null;
  actor_id: string | null;
  actor_name: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  amount_cents: number | null;
  idempotency_key: string | null;
  node_id: string | null;
  node_name: string | null;
  created_at: string;
  trade_id: string | null;
  trade_id_text: string | null;
  listing_title: string | null;
  buyer_name: string | null;
  seller_name: string | null;
}

// Mutation-type metadata: label, category, and pill color class.
const MUTATION_META: Record<string, { label: string; category: string; color: string }> = {
  offer_created: { label: 'Offer Created', category: 'Payments', color: 'bg-sky-100 text-sky-800' },
  payment_intent_created: { label: 'PI Created', category: 'Payments', color: 'bg-sky-100 text-sky-800' },
  payment_captured: { label: 'Payment Captured', category: 'Payments', color: 'bg-blue-100 text-blue-800' },
  payment_capture_failed: { label: 'Capture Failed', category: 'Payments', color: 'bg-red-100 text-red-800' },
  payment_cancelled: { label: 'Payment Cancelled', category: 'Payments', color: 'bg-gray-200 text-gray-700' },
  refund_issued: { label: 'Refund Issued', category: 'Refunds', color: 'bg-red-100 text-red-800' },
  refund_voided: { label: 'Refund Voided', category: 'Refunds', color: 'bg-gray-200 text-gray-600' },
  payout_initiated: { label: 'Payout Initiated', category: 'Payouts', color: 'bg-teal-100 text-teal-800' },
  payout_paid: { label: 'Payout Paid', category: 'Payouts', color: 'bg-emerald-100 text-emerald-800' },
  payout_requires_action: { label: 'Payout Needs Action', category: 'Payouts', color: 'bg-amber-100 text-amber-800' },
  payout_failed: { label: 'Payout Failed', category: 'Payouts', color: 'bg-red-100 text-red-800' },
  sp_reserved: { label: 'SP Reserved', category: 'Swap Points', color: 'bg-green-100 text-green-800' },
  sp_restored: { label: 'SP Restored', category: 'Swap Points', color: 'bg-green-100 text-green-800' },
  sp_released: { label: 'SP Released', category: 'Swap Points', color: 'bg-green-100 text-green-800' },
  sp_issued: { label: 'SP Issued', category: 'Swap Points', color: 'bg-green-100 text-green-800' },
  sp_deducted: { label: 'SP Deducted', category: 'Swap Points', color: 'bg-red-100 text-red-800' },
  sp_frozen: { label: 'SP Frozen', category: 'Swap Points', color: 'bg-amber-100 text-amber-800' },
  sp_unfrozen: { label: 'SP Unfrozen', category: 'Swap Points', color: 'bg-green-100 text-green-800' },
  sp_expired: { label: 'SP Expired', category: 'Swap Points', color: 'bg-gray-300 text-gray-700' },
  buyer_fee_charged: { label: 'Buyer Fee', category: 'Fees', color: 'bg-purple-100 text-purple-800' },
  seller_fee_deducted: { label: 'Seller Fee', category: 'Fees', color: 'bg-purple-100 text-purple-800' },
  tax_quoted: { label: 'Tax Quoted', category: 'Tax', color: 'bg-amber-100 text-amber-800' },
  tax_collected: { label: 'Tax Collected', category: 'Tax', color: 'bg-amber-100 text-amber-800' },
  tax_voided: { label: 'Tax Voided', category: 'Tax', color: 'bg-gray-200 text-gray-600' },
  tax_refunded: { label: 'Tax Refunded', category: 'Tax', color: 'bg-amber-100 text-amber-800' },
  trade_completed: { label: 'Trade Completed', category: 'Trade', color: 'bg-emerald-100 text-emerald-800' },
  trade_cancelled: { label: 'Trade Cancelled', category: 'Trade', color: 'bg-gray-200 text-gray-700' },
};

const MUTATION_TYPES = Object.keys(MUTATION_META).sort();
const ENTITY_TYPES = ['trade', 'refund', 'payment', 'payout', 'wallet', 'listing'];
const CATEGORY_GROUPS: Record<string, string[]> = {
  Payments: ['offer_created', 'payment_intent_created', 'payment_captured', 'payment_capture_failed', 'payment_cancelled'],
  'Swap Points': ['sp_reserved', 'sp_restored', 'sp_released', 'sp_issued', 'sp_deducted', 'sp_frozen', 'sp_unfrozen', 'sp_expired'],
  Fees: ['buyer_fee_charged', 'seller_fee_deducted'],
  Tax: ['tax_quoted', 'tax_collected', 'tax_voided', 'tax_refunded'],
  Payouts: ['payout_initiated', 'payout_paid', 'payout_requires_action', 'payout_failed'],
  Refunds: ['refund_issued', 'refund_voided'],
  Trade: ['trade_completed', 'trade_cancelled'],
};

function metaFor(type: string) {
  return MUTATION_META[type] ?? { label: type, category: 'Other', color: 'bg-gray-100 text-gray-700' };
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function fmtAmount(row: AuditRow): string {
  const amt = row.amount_cents;
  if (amt === null || amt === undefined) return '—';
  if (row.mutation_type.startsWith('sp_')) {
    return `${amt} SP`;
  }
  return `$${(amt / 100).toFixed(2)}`;
}

function shortId(id: string | null | undefined): string {
  if (!id) return '—';
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

export default function FinancialAuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [mutationType, setMutationType] = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
      if (mutationType) params.set('mutation_type', mutationType);
      if (entityType) params.set('entity_type', entityType);
      if (debouncedQuery) params.set('q', debouncedQuery);
      if (from) params.set('from', new Date(from).toISOString());
      if (to) params.set('to', new Date(`${to}T23:59:59`).toISOString());
      const res = await fetch(`/api/admin/audit?${params.toString()}`, {
        headers: { 'x-admin-secret': adminSecret },
        cache: 'no-store',
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRows(json.data || []);
    } catch (err: any) {
      setError(err.message || 'We couldn’t load the audit journal. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [mutationType, entityType, debouncedQuery, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  // Summary counts by category
  const categoryCounts: Record<string, number> = {};
  for (const cat of Object.keys(CATEGORY_GROUPS)) categoryCounts[cat] = 0;
  let totalAmountCents = 0;
  for (const r of rows) {
    const cat = metaFor(r.mutation_type).category;
    if (categoryCounts[cat] !== undefined) categoryCounts[cat] += 1;
    else categoryCounts[cat] = 1;
    if (!r.mutation_type.startsWith('sp_') && r.amount_cents) totalAmountCents += r.amount_cents;
  }

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Financial Audit</h1>
          <p className="text-sm text-gray-600 mt-1">
            The unified N2 journal — every payment, Swap Points, fee, and tax transition. Each row is immutable and
            keyed by an idempotency key so retries can never double-log.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search (trade / entity / idempotency key)</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Trade id, entity id, or idempotency key"
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Mutation type</label>
            <select
              value={mutationType}
              onChange={(e) => setMutationType(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            >
              <option value="">All</option>
              {MUTATION_TYPES.map((m) => (
                <option key={m} value={m}>{metaFor(m).label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Entity type</label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            >
              <option value="">All</option>
              {ENTITY_TYPES.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <div className="bg-white rounded shadow-sm border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Entries</p>
          <p className="text-xl font-bold">{rows.length}</p>
        </div>
        {(Object.keys(CATEGORY_GROUPS) as string[]).map((cat) => (
          <div key={cat} className="bg-white rounded shadow-sm border border-gray-200 p-3">
            <p className="text-xs text-gray-500">{cat}</p>
            <p className="text-xl font-bold">{categoryCounts[cat] ?? 0}</p>
          </div>
        ))}
        <div className="bg-white rounded shadow-sm border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Cash Movement</p>
          <p className="text-xl font-bold">${(totalAmountCents / 100).toFixed(2)}</p>
        </div>
      </div>

      {/* Table */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-4 mb-4 text-sm">{error}</div>
      )}

      <div className="bg-white rounded shadow-sm border border-gray-200 overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-gray-500">Loading audit journal…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">
            {debouncedQuery || mutationType || entityType || from || to
              ? 'No audit entries match these filters. Try widening the search or clearing a filter.'
              : 'No audit entries yet. The journal is written as payments, Swap Points, fees, and taxes move — run a trade to see it populate.'}
          </p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Node</th>
                <th className="px-4 py-3">Idempotency Key</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => {
                const meta = metaFor(r.mutation_type);
                const isOpen = expanded.has(r.id);
                return (
                  <FragmentRow key={r.id} row={r} meta={meta} isOpen={isOpen} onToggle={() => toggleExpand(r.id)} />
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function FragmentRow({ row, meta, isOpen, onToggle }: {
  row: AuditRow;
  meta: { label: string; color: string };
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="hover:bg-gray-50 align-top">
        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">{fmtDate(row.created_at)}</td>
        <td className="px-4 py-3">
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>{meta.label}</span>
        </td>
        <td className="px-4 py-3">
          {row.trade_id ? (
            <Link href={`/trades/${row.trade_id}`} className="text-blue-600 hover:underline">
              {row.listing_title ? `Trade · ${row.listing_title.slice(0, 40)}` : `Trade ${shortId(row.trade_id)}`}
            </Link>
          ) : (
            <span className="text-gray-600">{row.entity_type ?? '—'} {shortId(row.entity_id_text)}</span>
          )}
        </td>
        <td className="px-4 py-3 whitespace-nowrap font-medium">{fmtAmount(row)}</td>
        <td className="px-4 py-3">{row.actor_name ?? (row.actor_id ? shortId(row.actor_id) : 'System')}</td>
        <td className="px-4 py-3 text-xs text-gray-500">{row.node_name ?? shortId(row.node_id)}</td>
        <td className="px-4 py-3 text-xs text-gray-500 font-mono">{shortId(row.idempotency_key)}</td>
        <td className="px-4 py-3">
          <button onClick={onToggle} className="text-blue-600 text-xs hover:underline">
            {isOpen ? 'Hide' : 'View'}
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-gray-50">
          <td colSpan={8} className="px-4 py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <p className="font-semibold text-gray-600 mb-1">Before</p>
                <pre className="bg-white border border-gray-200 rounded p-2 overflow-x-auto max-h-40">
                  {JSON.stringify(row.before_state ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <p className="font-semibold text-gray-600 mb-1">After</p>
                <pre className="bg-white border border-gray-200 rounded p-2 overflow-x-auto max-h-40">
                  {JSON.stringify(row.after_state ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
