'use client';
// filepath: p2p-kids-admin/src/app/sp-wallet/page.tsx
// Module: MODULE-12-ADMIN-V2 / TASK ADMIN-V2-003

import { useState, useEffect, FormEvent } from 'react';
import type {
  SpWalletDetail,
  SpEconomyMetrics,
  SpWalletStatus,
  SpLedgerEntry,
} from '@/types/sp-wallet';

const ADMIN_API_BASE_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL?.replace(/\/$/, '') || '';
const buildUrl = (path: string) =>
  ADMIN_API_BASE_URL ? `${ADMIN_API_BASE_URL}${path}` : path;

const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '';

const authHeaders = {
  'Content-Type': 'application/json',
  'x-admin-secret': adminSecret,
};

function formatSP(val: number) {
  return val.toLocaleString();
}

// Colour badges for ledger transaction types
function TxTypeBadge({ type }: { type: string }) {
  const isEarn = type.startsWith('earn_') || type === 'unfreeze';
  const isAdmin = type === 'earn_admin_grant' || type === 'admin_deduct';
  const base = 'inline-block px-2 py-0.5 rounded text-xs font-medium';
  if (isAdmin) return <span className={`${base} bg-purple-100 text-purple-700`}>{type}</span>;
  if (isEarn) return <span className={`${base} bg-green-100 text-green-700`}>{type}</span>;
  return <span className={`${base} bg-red-100 text-red-700`}>{type}</span>;
}

function StatusBadge({ status }: { status: SpWalletStatus }) {
  const map: Record<SpWalletStatus, string> = {
    active: 'bg-green-100 text-green-800',
    frozen: 'bg-blue-100 text-blue-800',
    suspended: 'bg-red-100 text-red-800',
    grace_period: 'bg-yellow-100 text-yellow-800',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${map[status]}`}>
      {status}
    </span>
  );
}

export default function SpWalletAdminPage() {
  // ─── Economy metrics state ────────────────────────────────────────────────
  const [metrics, setMetrics] = useState<SpEconomyMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // ─── Wallet search state ──────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [walletDetail, setWalletDetail] = useState<SpWalletDetail | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  // ─── Adjustment form state ────────────────────────────────────────────────
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjNotes, setAdjNotes] = useState('');
  const [adjInProgress, setAdjInProgress] = useState(false);
  const [adjSuccess, setAdjSuccess] = useState<string | null>(null);
  const [adjError, setAdjError] = useState<string | null>(null);

  // ─── Status toggle state ──────────────────────────────────────────────────
  const [statusInProgress, setStatusInProgress] = useState(false);
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // ─── Load economy metrics ─────────────────────────────────────────────────
  useEffect(() => {
    loadMetrics();
  }, []);

  async function loadMetrics() {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const res = await fetch(buildUrl('/api/admin/sp-wallet'), { headers: authHeaders });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }
      if (json?.metrics) setMetrics(json.metrics);
    } catch (err: any) {
      setMetricsError(err.message ?? 'Failed to load metrics');
    } finally {
      setMetricsLoading(false);
    }
  }

  // ─── Search wallet ────────────────────────────────────────────────────────
  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const uid = searchInput.trim();
    if (!uid) return;

    setWalletLoading(true);
    setWalletError(null);
    setWalletDetail(null);
    setAdjSuccess(null);
    setAdjError(null);
    setStatusSuccess(null);
    setStatusError(null);

    try {
      const res = await fetch(buildUrl(`/api/admin/sp-wallet?user_id=${encodeURIComponent(uid)}`), {
        headers: authHeaders,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Wallet not found');
      }
      setWalletDetail(json as SpWalletDetail);
    } catch (err: any) {
      setWalletError(err.message ?? 'Failed to load wallet');
    } finally {
      setWalletLoading(false);
    }
  }

  // ─── SP Adjustment ────────────────────────────────────────────────────────
  async function handleAdjust(e: FormEvent) {
    e.preventDefault();
    if (!walletDetail) return;

    const amount = parseInt(adjAmount, 10);
    if (isNaN(amount) || amount === 0) {
      setAdjError('Enter a non-zero integer amount (positive to add, negative to deduct).');
      return;
    }
    if (!adjReason.trim()) {
      setAdjError('Reason is required.');
      return;
    }

    setAdjInProgress(true);
    setAdjSuccess(null);
    setAdjError(null);

    try {
      const res = await fetch(buildUrl('/api/admin/sp-wallet/actions'), {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          action: 'adjust',
          user_id: walletDetail.wallet.user_id,
          amount,
          reason: adjReason.trim(),
          notes: adjNotes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Adjustment failed');

      setAdjSuccess(`✅ SP adjusted. New balance: ${formatSP(json.new_balance)} SP`);
      setAdjAmount('');
      setAdjReason('');
      setAdjNotes('');
      // Refresh wallet detail
      await reloadWallet(walletDetail.wallet.user_id);
      loadMetrics();
    } catch (err: any) {
      setAdjError(err.message ?? 'Adjustment failed');
    } finally {
      setAdjInProgress(false);
    }
  }

  // ─── Status Toggle ────────────────────────────────────────────────────────
  async function handleStatusChange(newStatus: SpWalletStatus) {
    if (!walletDetail) return;
    setStatusInProgress(true);
    setStatusSuccess(null);
    setStatusError(null);

    try {
      const res = await fetch(buildUrl('/api/admin/sp-wallet/actions'), {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          action: 'toggle_status',
          user_id: walletDetail.wallet.user_id,
          new_status: newStatus,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Status change failed');

      setStatusSuccess(`✅ Wallet status changed: ${json.old_status} → ${json.new_status}`);
      await reloadWallet(walletDetail.wallet.user_id);
    } catch (err: any) {
      setStatusError(err.message ?? 'Status change failed');
    } finally {
      setStatusInProgress(false);
    }
  }

  async function reloadWallet(userId: string) {
    try {
      const res = await fetch(buildUrl(`/api/admin/sp-wallet?user_id=${encodeURIComponent(userId)}`), {
        headers: authHeaders,
      });
      const json = await res.json();
      if (res.ok && json.success) setWalletDetail(json as SpWalletDetail);
    } catch {
      // silent – stale data acceptable on reload failure
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl" data-testid="sp-wallet-admin-page">
      <h1 className="text-2xl font-bold mb-1">💎 SP Wallet Operations</h1>
      <p className="text-gray-500 text-sm mb-6">
        Inspect any user&apos;s Swap Points wallet, adjust balances, manage status, and monitor the SP economy.
      </p>

      {/* ── Economy Metrics ── */}
      <section className="mb-8" aria-label="SP Economy Metrics">
        <h2 className="text-lg font-semibold mb-3">💹 SP Economy Metrics (last 30 days)</h2>
        {metricsLoading && <p className="text-gray-400 text-sm">Loading metrics…</p>}
        {metricsError && (
          <div className="rounded-md bg-amber-50 border border-amber-200 p-4" data-testid="metrics-error">
            <p className="text-amber-800 text-sm font-semibold mb-1">⚠️ Could not load SP economy metrics</p>
            <p className="text-amber-700 text-sm">{metricsError}</p>
            {metricsError.toLowerCase().includes('rpc') || metricsError.toLowerCase().includes('migration') || metricsError.toLowerCase().includes('not installed') ? (
              <p className="mt-2 text-sm text-amber-700">
                👉 You need to apply the database migration first.{' '}
                <a
                  href="https://supabase.com/dashboard/project/drntwgporzabmxdqykrp/sql/new"
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-medium text-amber-900"
                >
                  Open Supabase SQL Editor
                </a>
                {' '}and run the file:{' '}
                <code className="bg-amber-100 px-1 rounded text-xs">
                  supabase/migrations/20260322000001_admin_v2_003_sp_wallet_rpcs.sql
                </code>
              </p>
            ) : null}
          </div>
        )}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="metrics-grid">
            <MetricCard label="Total Earned" value={`${formatSP(metrics.total_earned)} SP`} color="green" />
            <MetricCard label="Total Spent" value={`${formatSP(metrics.total_spent)} SP`} color="red" />
            <MetricCard label="In Circulation" value={`${formatSP(metrics.current_circulation)} SP`} color="blue" />
            <MetricCard label="Active Wallets" value={metrics.active_wallets.toString()} color="gray" />
            <MetricCard label="Avg Balance" value={`${formatSP(metrics.avg_balance)} SP`} color="gray" />
            <MetricCard label="Admin Adj. (30d)" value={metrics.admin_adjustments_count.toString()} color="purple" />
            <MetricCard label="Admin Adj. Total (30d)" value={`${formatSP(metrics.admin_adjustments_total)} SP`} color="purple" />
          </div>
        )}
      </section>

      {/* ── Wallet Search ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">🔍 Wallet Inspection</h2>
        <form onSubmit={handleSearch} className="flex gap-2 mb-4" data-testid="wallet-search-form">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="User ID (UUID)"
            className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            data-testid="wallet-search-input"
          />
          <button
            type="submit"
            disabled={walletLoading || !searchInput.trim()}
            className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
            data-testid="wallet-search-btn"
          >
            {walletLoading ? 'Loading…' : 'Load Wallet'}
          </button>
        </form>

        {walletError && (
          <p className="text-red-600 text-sm mb-4" data-testid="wallet-error">{walletError}</p>
        )}

        {/* ── Wallet Details Panel ── */}
        {walletDetail && (
          <div className="border rounded-lg overflow-hidden" data-testid="wallet-detail-panel">
            {/* Header */}
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">
                  {walletDetail.user_info.display_name ?? 'Unknown User'}
                </p>
                <p className="text-xs text-gray-500">{walletDetail.user_info.email}</p>
                <p className="text-xs text-gray-400">{walletDetail.wallet.user_id}</p>
              </div>
              <div className="text-right">
                <StatusBadge status={walletDetail.wallet.state} />
                <p className="text-2xl font-bold text-indigo-700 mt-1" data-testid="wallet-balance">
                  {formatSP(walletDetail.wallet.available_balance)} SP
                </p>
                <p className="text-xs text-gray-400">
                  + {formatSP(walletDetail.wallet.pending_balance)} pending
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4 py-3 border-t bg-white">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Lifetime Earned</p>
                <p className="font-bold text-green-700" data-testid="lifetime-earned">
                  {formatSP(walletDetail.wallet.lifetime_earned)} SP
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Lifetime Spent</p>
                <p className="font-bold text-red-700" data-testid="lifetime-spent">
                  {formatSP(walletDetail.wallet.lifetime_spent)} SP
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Last Activity</p>
                <p className="text-sm text-gray-700">
                  {walletDetail.wallet.last_activity_at
                    ? new Date(walletDetail.wallet.last_activity_at).toLocaleDateString()
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Created</p>
                <p className="text-sm text-gray-700">
                  {new Date(walletDetail.wallet.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Status Toggle */}
            <div className="px-4 py-3 border-t bg-white">
              <p className="text-sm font-semibold text-gray-700 mb-2">Wallet Status</p>
              {statusSuccess && (
                <p className="text-green-600 text-sm mb-2" data-testid="status-success">{statusSuccess}</p>
              )}
              {statusError && (
                <p className="text-red-600 text-sm mb-2" data-testid="status-error">{statusError}</p>
              )}
              <div className="flex gap-2">
                {(['active', 'frozen', 'suspended'] as SpWalletStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    disabled={statusInProgress || walletDetail.wallet.state === s}
                    data-testid={`status-btn-${s}`}
                    className={`px-3 py-1 rounded text-sm font-medium border transition-colors
                      ${walletDetail.wallet.state === s
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed border-gray-300'
                        : 'hover:bg-indigo-50 border-indigo-300 text-indigo-700'
                      }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* SP Adjustment Form */}
            <div className="px-4 py-4 border-t bg-white">
              <p className="text-sm font-semibold text-gray-700 mb-3">Manual SP Adjustment</p>
              {adjSuccess && (
                <p className="text-green-600 text-sm mb-2" data-testid="adj-success">{adjSuccess}</p>
              )}
              {adjError && (
                <p className="text-red-600 text-sm mb-2" data-testid="adj-error">{adjError}</p>
              )}
              <form onSubmit={handleAdjust} className="space-y-3" data-testid="adj-form">
                <div className="flex gap-3">
                  <div className="w-40">
                    <label className="block text-xs text-gray-500 mb-1">
                      Amount (+ add / - deduct)
                    </label>
                    <input
                      type="number"
                      value={adjAmount}
                      onChange={(e) => setAdjAmount(e.target.value)}
                      placeholder="e.g. 50 or -20"
                      required
                      className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      data-testid="adj-amount-input"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">
                      Reason <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={adjReason}
                      onChange={(e) => setAdjReason(e.target.value)}
                      placeholder="Required – e.g. Compensation for failed trade"
                      required
                      className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      data-testid="adj-reason-input"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Admin Notes (optional)
                  </label>
                  <input
                    type="text"
                    value={adjNotes}
                    onChange={(e) => setAdjNotes(e.target.value)}
                    placeholder="Internal note for audit trail"
                    className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    data-testid="adj-notes-input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={adjInProgress || !adjAmount || !adjReason.trim()}
                  className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
                  data-testid="adj-submit-btn"
                >
                  {adjInProgress ? 'Applying…' : 'Apply Adjustment'}
                </button>
              </form>
            </div>

            {/* Ledger History */}
            <div className="px-4 py-3 border-t bg-white">
              <p className="text-sm font-semibold text-gray-700 mb-3">
                Ledger History (last 100 entries)
              </p>
              {walletDetail.ledger.length === 0 ? (
                <p className="text-gray-400 text-sm">No ledger entries yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" data-testid="ledger-table">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-1 pr-3">Date</th>
                        <th className="pb-1 pr-3">Type</th>
                        <th className="pb-1 pr-3 text-right">Amount</th>
                        <th className="pb-1 pr-3 text-right">Balance After</th>
                        <th className="pb-1">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {walletDetail.ledger.map((entry) => (
                        <LedgerRow key={entry.id} entry={entry} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: 'green' | 'red' | 'blue' | 'gray' | 'purple';
}) {
  const colorMap = {
    green: 'text-green-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    gray: 'text-gray-700',
    purple: 'text-purple-600',
  };
  return (
    <div className="bg-white rounded border border-gray-200 p-3 shadow-sm">
      <p className="text-xs text-gray-500 uppercase font-semibold mb-1">{label}</p>
      <p className={`text-xl font-bold ${colorMap[color]}`}>{value}</p>
    </div>
  );
}

function LedgerRow({ entry }: { entry: SpLedgerEntry }) {
  const isPositive = entry.amount > 0;
  const adjReason = entry.metadata?.adjustment_reason as string | undefined;

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50">
      <td className="py-1 pr-3 text-gray-400 whitespace-nowrap">
        {new Date(entry.created_at).toLocaleDateString()}
      </td>
      <td className="py-1 pr-3">
        <TxTypeBadge type={entry.transaction_type} />
      </td>
      <td className={`py-1 pr-3 text-right font-mono font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? '+' : ''}{entry.amount}
      </td>
      <td className="py-1 pr-3 text-right font-mono text-gray-700">{entry.balance_after}</td>
      <td className="py-1 text-gray-600 max-w-xs truncate">
        {adjReason ?? entry.description}
        {entry.admin_note && (
          <span className="ml-1 text-gray-400">· {entry.admin_note}</span>
        )}
      </td>
    </tr>
  );
}
