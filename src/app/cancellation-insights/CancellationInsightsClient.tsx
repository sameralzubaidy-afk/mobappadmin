// File: p2p-kids-admin/src/app/cancellation-insights/CancellationInsightsClient.tsx
// Module: Admin — Cancellation Insights Dashboard (client component)

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────

interface SummaryKPIs {
  total_cancelled_offers: number;
  total_cancelled_trades: number;
  total_created_in_range: number;
  cancellation_rate_pct: number;
}

interface ReasonRow {
  reason: string;
  cancellation_type: 'offer' | 'trade';
  count: number;
  pct_share: number;
}

interface TopUserRow {
  user_id: string;
  display_name: string;
  email: string;
  role: 'buyer' | 'seller';
  cancelled_offers: number;
  cancelled_trades: number;
  total_cancelled: number;
  cancellation_rate: number | null;
  top_reason: string | null;
  admin_review_flagged_at: string | null;
}

interface UserCancellation {
  trade_id: string;
  listing_id: string;
  item_title: string;
  cancellation_type: 'offer' | 'trade';
  cancellation_reason: string;
  cancelled_at: string;
  actor_role: 'buyer' | 'seller' | 'unknown';
  counterparty_id: string;
  counterparty_name: string;
  cash_amount_cents: number;
  sp_amount: number;
  had_payment_intent: boolean;
}

interface InsightsData {
  summary: SummaryKPIs;
  reasons: ReasonRow[];
  top_users: TopUserRow[];
}

// ── Preset date ranges ────────────────────────────────────────────────────

type PresetKey = '24h' | '7d' | '30d' | 'custom';

interface DateRange {
  start: string; // ISO
  end: string;   // ISO
}

function getPresetRange(preset: PresetKey): DateRange {
  const now = new Date();
  let start: Date;

  switch (preset) {
    case '24h':
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return {
    start: start.toISOString(),
    end: now.toISOString(),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

// ── Reasons breakdown sub-component ───────────────────────────────────────

function ReasonsTable({ reasons, type }: { reasons: ReasonRow[]; type: 'offer' | 'trade' }) {
  const filtered = reasons.filter((r) => r.cancellation_type === type);
  const label = type === 'offer' ? 'Offer Cancellation Reasons' : 'Trade Cancellation Reasons';
  const color = type === 'offer' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  if (filtered.length === 0) {
    return (
      <div className={`p-4 rounded-lg border ${color}`}>
        <h3 className="font-semibold text-sm mb-2">{label}</h3>
        <p className="text-gray-500 text-sm">No {type} cancellations in this period.</p>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-lg border ${color}`}>
      <h3 className="font-semibold text-sm mb-3">{label}</h3>
      <div className="space-y-2">
        {filtered.map((r) => (
          <div key={`${r.reason}-${r.cancellation_type}`} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium truncate">{r.reason}</span>
                <span className="text-sm text-gray-600 ml-2">
                  {r.count} ({r.pct_share}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${type === 'offer' ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(r.pct_share, 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── KPI Card sub-component ────────────────────────────────────────────────

function KPICard({
  label,
  value,
  subtext,
  color = 'blue',
}: {
  label: string;
  value: string | number;
  subtext?: string;
  color?: 'blue' | 'amber' | 'red' | 'green';
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    green: 'bg-green-50 border-green-200 text-green-700',
  };

  return (
    <div className={`p-5 rounded-lg border ${colorMap[color]}`}>
      <div className="text-sm font-medium opacity-80">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
      {subtext && <div className="text-xs mt-1 opacity-70">{subtext}</div>}
    </div>
  );
}

// ── User Drill-Down Modal ─────────────────────────────────────────────────

function UserDetailModal({
  userId,
  userName,
  flagged,
  start,
  end,
  onClose,
}: {
  userId: string;
  userName: string;
  flagged: boolean;
  start: string;
  end: string;
  onClose: () => void;
}) {
  const [cancellations, setCancellations] = useState<UserCancellation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          user_id: userId,
          start,
          end,
        });
        const resp = await fetch(`/api/admin/cancellation-insights?${params}`, {
          cache: 'no-store',
          headers: { 'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '' },
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json.error || 'Failed to load user detail');
        setCancellations(json.cancellations || []);
      } catch (err: any) {
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [userId, start, end]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold">Cancellation History</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-gray-500">{userName}</p>
              {flagged && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-700 border border-red-300">
                  ⚑ Flagged
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
              <span className="ml-3 text-gray-500">Loading...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && cancellations.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              No cancellations found for this user in the selected period.
            </div>
          )}

          {!loading && !error && cancellations.length > 0 && (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Reason</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Item</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Counterparty</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Amount</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cancellations.map((c) => (
                  <tr key={c.trade_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-xs font-mono">
                      {formatDate(c.cancelled_at)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${
                          c.cancellation_type === 'offer'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {c.cancellation_type === 'offer' ? 'Offer' : 'Trade'}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-[200px] truncate" title={c.cancellation_reason}>
                      {c.cancellation_reason || '—'}
                    </td>
                    <td className="px-3 py-2 max-w-[150px] truncate" title={c.item_title}>
                      {c.item_title}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{c.counterparty_name}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right font-mono">
                      ${formatCents(c.cash_amount_cents)}
                      {c.sp_amount > 0 && (
                        <span className="text-xs text-blue-600 ml-1">(+{c.sp_amount} SP)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${
                          c.actor_role === 'seller'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {c.actor_role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Date Range Picker (custom) ────────────────────────────────────────────

function CustomDateRange({
  start,
  end,
  onChange,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}) {
  // Convert ISO to YYYY-MM-DD for input[type=date]
  const toDateInput = (iso: string) => iso.substring(0, 10);
  const fromDateInput = (val: string) => {
    const d = new Date(val + 'T00:00:00Z');
    return d.toISOString();
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <label className="text-gray-600">From:</label>
      <input
        type="date"
        value={toDateInput(start)}
        onChange={(e) => onChange(fromDateInput(e.target.value), end)}
        className="border border-gray-300 rounded px-2 py-1 text-sm"
        data-testid="custom-date-start"
      />
      <label className="text-gray-600">To:</label>
      <input
        type="date"
        value={toDateInput(end)}
        onChange={(e) => onChange(start, fromDateInput(e.target.value))}
        className="border border-gray-300 rounded px-2 py-1 text-sm"
        data-testid="custom-date-end"
      />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function CancellationInsightsClient() {
  const [preset, setPreset] = useState<PresetKey>('30d');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drill-down state
  const [drillDownUser, setDrillDownUser] = useState<{ id: string; name: string; flagged: boolean } | null>(null);

  // Compute effective date range — useMemo prevents getPresetRange (which calls
  // new Date()) from running on every render, which would cause an infinite
  // re-fetch loop since the ISO strings would change every millisecond.
  const effectiveRange: DateRange = useMemo(() => {
    if (preset === 'custom' && customStart && customEnd) {
      return { start: customStart, end: customEnd };
    }
    return getPresetRange(preset);
  }, [preset, customStart, customEnd]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        start: effectiveRange.start,
        end: effectiveRange.end,
      });
      const resp = await fetch(`/api/admin/cancellation-insights?${params}`, {
        cache: 'no-store',
        headers: { 'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '' },
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Failed to load cancellation insights');
      setData(json as InsightsData);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [effectiveRange.start, effectiveRange.end]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Preset buttons ─────────────────────────────────────────────────────

  const presets: { key: PresetKey; label: string }[] = [
    { key: '24h', label: 'Last 24h' },
    { key: '7d', label: 'Last 7 Days' },
    { key: '30d', label: 'Last 30 Days' },
    { key: 'custom', label: 'Custom' },
  ];

  // ── Render ──────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h2 className="text-lg font-bold text-red-700 mb-2">Error Loading Data</h2>
        <p className="text-red-600 text-sm">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Date Range Filter ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => {
              setPreset(p.key);
              if (p.key === 'custom') {
                // Initialize custom with current range
                const r = getPresetRange('30d');
                setCustomStart(r.start);
                setCustomEnd(r.end);
              }
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              preset === p.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            data-testid={`preset-${p.key}`}
          >
            {p.label}
          </button>
        ))}

        {preset === 'custom' && (
          <CustomDateRange
            start={customStart}
            end={customEnd}
            onChange={(s, e) => {
              setCustomStart(s);
              setCustomEnd(e);
            }}
          />
        )}
      </div>

      {/* ── Loading State ──────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
          <span className="ml-3 text-gray-500">Loading cancellation insights...</span>
        </div>
      )}

      {/* ── Data Display ───────────────────────────────────────────────── */}
      {!loading && data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KPICard
              label="Cancelled Offers"
              value={data.summary.total_cancelled_offers}
              subtext="Pending offers that were cancelled"
              color="amber"
            />
            <KPICard
              label="Cancelled Trades"
              value={data.summary.total_cancelled_trades}
              subtext="In-progress trades that were cancelled"
              color="red"
            />
            <KPICard
              label="Total Created"
              value={data.summary.total_created_in_range}
              subtext={`In selected period`}
              color="blue"
            />
            <KPICard
              label="Cancellation Rate"
              value={`${data.summary.cancellation_rate_pct}%`}
              subtext="Cancelled / Total created"
              color={data.summary.cancellation_rate_pct > 20 ? 'red' : data.summary.cancellation_rate_pct > 10 ? 'amber' : 'green'}
            />
          </div>

          {/* Reasons Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ReasonsTable reasons={data.reasons} type="offer" />
            <ReasonsTable reasons={data.reasons} type="trade" />
          </div>

          {/* Top Cancelling Users */}
          <div>
            <h2 className="text-lg font-bold mb-3">Top Cancelling Users</h2>
            {data.top_users.length === 0 ? (
              <div className="p-6 bg-gray-50 rounded-lg border border-gray-200 text-center text-gray-500">
                No cancellations in this period.
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">User</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Role</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-600">Flagged</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Cancelled Offers</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Cancelled Trades</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Top Reason</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.top_users.map((user) => (
                      <tr key={`${user.user_id}-${user.role}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium">{user.display_name}</div>
                          <div className="text-xs text-gray-500 font-mono">{user.user_id.substring(0, 12)}...</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${
                              user.role === 'seller'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {user.admin_review_flagged_at ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-700 border border-red-300">
                              ⚑ Flagged
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">{user.cancelled_offers}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">{user.cancelled_trades}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right font-semibold">
                          {user.total_cancelled}
                        </td>
                        <td className="px-4 py-3 max-w-[180px] truncate" title={user.top_reason || ''}>
                          {user.top_reason || '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() =>
                              setDrillDownUser({
                                id: user.user_id,
                                name: user.display_name,
                                flagged: user.role === 'seller' && user.admin_review_flagged_at !== null,
                              })
                            }
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium underline"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Data freshness note */}
          <div className="text-xs text-gray-400 text-right">
            Data as of {new Date().toLocaleString()}
          </div>
        </>
      )}

      {/* ── Drill-Down Modal ──────────────────────────────────────────── */}
      {drillDownUser && (
        <UserDetailModal
          userId={drillDownUser.id}
          userName={drillDownUser.name}
          flagged={drillDownUser.flagged}
          start={effectiveRange.start}
          end={effectiveRange.end}
          onClose={() => setDrillDownUser(null)}
        />
      )}
    </div>
  );
}
