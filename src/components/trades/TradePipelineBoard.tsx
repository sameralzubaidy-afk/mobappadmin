'use client';

// File: p2p-kids-admin/src/components/trades/TradePipelineBoard.tsx
// Admin Trade Pipeline — kanban-style board to see and track trades across all
// stages (pending offer → in progress/pickup window → completed / cancelled).
// Data comes from admin_trades_view (server-fetched in /trades/pipeline).
// R2 (2026-08-10): stage countdowns use offer_expires_at (offer window) and
// auto_complete_at (pickup window → auto-complete deadline).

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

export interface PipelineTrade {
  id: string;
  status: 'pending' | 'payment_failed' | 'in_progress' | 'completed' | 'cancelled';
  sp_amount: number | null;
  cash_amount_cents: number | null;
  bundle_id: string | null;
  bundle_size: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  last_status_change_at: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  seller_name: string | null;
  seller_email: string | null;
  cancellation_reason: string | null;
  offer_expires_at: string | null;
  auto_complete_at: string | null;
  authorization_expires_at: string | null;
  dispute_status: string | null;
  dispute_resolution: string | null;
}

function formatMoney(cents: number | null | undefined): string {
  const c = Math.round(cents ?? 0);
  return `$${(c / 100).toFixed(2)}`;
}

function formatCountdown(ms: number): string {
  const abs = Math.abs(ms);
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  if (hours >= 48) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours >= 1) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function isDisputed(t: PipelineTrade): boolean {
  return !!t.dispute_status && !['none', 'resolved'].includes(t.dispute_status as string);
}

/** A trade "needs attention" if its stage deadline is near or a dispute is open. */
function isAttention(t: PipelineTrade, now: number): boolean {
  if (t.status === 'pending' && t.offer_expires_at) {
    const ms = Date.parse(t.offer_expires_at) - now;
    if (ms < 6 * 3_600_000) return true; // expiring within 6h or already past
  }
  if (t.status === 'in_progress') {
    if (isDisputed(t)) return true;
    if (t.auto_complete_at) {
      const ms = Date.parse(t.auto_complete_at) - now;
      if (ms < 4 * 3_600_000) return true; // auto-completing within 4h or past
    }
  }
  return false;
}

const STATUS_COLUMNS: Array<{ key: string; label: string; header: string; dot: string }> = [
  { key: 'pending', label: 'Pending Offer', header: 'bg-sky-50 text-sky-800 border-sky-200', dot: 'bg-sky-500' },
  { key: 'in_progress', label: 'In Progress · Pickup', header: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  { key: 'completed', label: 'Completed', header: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  { key: 'cancelled', label: 'Cancelled', header: 'bg-gray-50 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
];

function CountdownLine({ trade, now }: { trade: PipelineTrade; now: number }) {
  if (trade.status === 'pending' && trade.offer_expires_at) {
    const ms = Date.parse(trade.offer_expires_at) - now;
    if (ms <= 0) {
      return <p className="text-xs text-red-600 font-medium">Offer expired</p>;
    }
    return (
      <p className="text-xs font-medium text-sky-700">
        Offer expires in <span className="tabular-nums">{formatCountdown(ms)}</span>
      </p>
    );
  }
  if (trade.status === 'in_progress') {
    if (isDisputed(trade)) {
      return <p className="text-xs font-medium text-red-600">Dispute open — auto-complete paused</p>;
    }
    if (trade.auto_complete_at) {
      const ms = Date.parse(trade.auto_complete_at) - now;
      if (ms <= 0) {
        return <p className="text-xs text-amber-700 font-medium">Pickup window passed</p>;
      }
      return (
        <p className="text-xs font-medium text-amber-700">
          Auto-completes in <span className="tabular-nums">{formatCountdown(ms)}</span>
        </p>
      );
    }
  }
  if (trade.status === 'cancelled' && trade.cancellation_reason) {
    return <p className="text-xs text-gray-500">{trade.cancellation_reason}</p>;
  }
  if (trade.status === 'completed' && trade.completed_at) {
    return <p className="text-xs text-gray-500">Completed {new Date(trade.completed_at).toLocaleDateString()}</p>;
  }
  return null;
}

function TradeCard({ trade, now }: { trade: PipelineTrade; now: number }) {
  const shortId = trade.id.slice(0, 8);
  const isBundle = (trade.bundle_size ?? 0) > 1;
  return (
    <Link
      href={`/trades/${trade.id}`}
      className="block bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-blue-300 transition-shadow"
      data-testid={`pipeline-card-${trade.status}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs text-gray-400 font-mono">#{shortId}</span>
        <div className="flex gap-1">
          {isBundle && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-medium">
              Bundle ×{trade.bundle_size}
            </span>
          )}
          {isDisputed(trade) && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">
              Dispute
            </span>
          )}
        </div>
      </div>

      <div className="text-sm font-semibold text-gray-800 truncate">
        {trade.buyer_name ?? 'Buyer'} → {trade.seller_name ?? 'Seller'}
      </div>
      <div className="text-xs text-gray-500 truncate">
        {trade.buyer_email ?? '—'} · {trade.seller_email ?? '—'}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-bold text-gray-900 tabular-nums">
          {formatMoney(trade.cash_amount_cents)}
          {trade.sp_amount ? <span className="text-xs text-amber-600 font-semibold"> + {trade.sp_amount} SP</span> : null}
        </span>
      </div>

      <div className="mt-2 border-t border-gray-100 pt-1.5">
        <CountdownLine trade={trade} now={now} />
      </div>
    </Link>
  );
}

export default function TradePipelineBoard({ trades }: { trades: PipelineTrade[] }) {
  const now = useNow(30_000);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [attentionOnly, setAttentionOnly] = useState(false);

  const buckets = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map: Record<string, PipelineTrade[]> = {
      pending: [],
      in_progress: [],
      completed: [],
      cancelled: [],
      other: [],
    };
    for (const t of trades) {
      if (statusFilter !== 'all' && t.status !== statusFilter) continue;
      if (attentionOnly && !isAttention(t, now)) continue;
      if (q) {
        const haystack = `${t.buyer_name ?? ''} ${t.buyer_email ?? ''} ${t.seller_name ?? ''} ${t.seller_email ?? ''} ${t.id}`.toLowerCase();
        if (!haystack.includes(q)) continue;
      }
      const key = STATUS_COLUMNS.some((c) => c.key === t.status) ? t.status : 'other';
      map[key].push(t);
    }
    return map;
  }, [trades, statusFilter, search, attentionOnly, now]);

  const attentionCount = useMemo(
    () => trades.filter((t) => isAttention(t, now)).length,
    [trades, now]
  );

  const totalLoaded = trades.length;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold">Trade Pipeline</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track trades across all stages — countdowns are live. Showing the most recent {totalLoaded} updated trades.
          </p>
        </div>
        <Link href="/trades" className="text-blue-600 hover:underline text-sm">← Full Trade List</Link>
      </div>

      {/* Attention strip */}
      {attentionCount > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800" data-testid="pipeline-attention-strip">
          ⚠️ <span className="font-semibold">{attentionCount}</span> trade{attentionCount === 1 ? '' : 's'} need attention
          (offer expiring ≤6h, pickup/auto-complete ≤4h, or dispute open).{' '}
          <button onClick={() => setAttentionOnly((v) => !v)} className="underline font-medium ml-1">
            {attentionOnly ? 'Show all' : 'Show only these'}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {[{ key: 'all', label: 'All' }, ...STATUS_COLUMNS.map((c) => ({ key: c.key, label: c.label }))].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 text-sm ${statusFilter === tab.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search buyer, seller, or trade ID…"
          className="w-72 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          data-testid="pipeline-search"
        />
      </div>

      {/* Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATUS_COLUMNS.map((col) => {
          const items = buckets[col.key] ?? [];
          return (
            <div key={col.key} className="flex flex-col gap-2">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg border border-b-0 ${col.header}`}>
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                <span className="font-semibold text-sm">{col.label}</span>
                <span className="ml-auto text-xs font-bold bg-white/70 px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              </div>
              <div className="flex flex-col gap-2 bg-gray-50 border border-gray-200 rounded-b-lg p-2 min-h-[120px]">
                {items.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">No trades</p>
                ) : (
                  items.map((t) => <TradeCard key={t.id} trade={t} now={now} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
