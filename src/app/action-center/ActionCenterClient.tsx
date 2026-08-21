// File: p2p-kids-admin/src/app/action-center/ActionCenterClient.tsx
// Admin Action Center — client logic.
//
// Single feed that aggregates every pending admin action:
//   Flagged Items · Disputes · ID Badge Requests · Cancel Insights anomaly ·
//   Failed Payouts · Config Drift.
//
// Behavior (per the Action Center spec):
//   - Same-type items are bundled into ONE card with a count (drill on expand).
//   - Each card carries a severity tag: Urgent (Error 500) / Routine (Warning 500).
//   - Each card has an inline action appropriate to its type
//     (Approve / Review / Mark Under Review / Retry).
//   - Empty queue → "All caught up" success state (Success 500 checkmark).
//
// Data comes from GET /api/admin/action-center (summary + per-source detail).
// Mutations reuse the EXISTING admin endpoints (item status, dispute-action,
// id-badge decide, payout retry) — this page never re-implements a write path.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import {
  Flag,
  Scale,
  IdCard,
  TrendingDown,
  CircleDollarSign,
  Settings,
  ChevronDown,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

// ── Design tokens (docx/old/design-system.md) ─────────────────────────────
const COLORS = {
  error500: 'var(--error-500)', // Urgent severity (§2.4)
  warning500: 'var(--warning-500)', // Routine severity (§2.4)
  success500: 'var(--success-500)', // All-caught-up state (§2.4)
  accent500: 'var(--accent-500)', // Icons (design-system §5.3)
  cardBorder: 'var(--card-border)',
  cardBg: 'var(--card-bg)',
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
};

// Level 1 shadow per design-system §8.1
const CARD_SHADOW = '0px 2px 8px rgba(0, 0, 0, 0.08)';

type Severity = 'urgent' | 'routine';

interface SummaryGroup {
  source: string;
  count: number;
  detail?: any;
}

interface Summary {
  generated_at?: string;
  total: number;
  groups: SummaryGroup[];
}

interface SourceMeta {
  label: string;
  icon: React.ReactNode;
  severity: Severity;
  actionVerb: 'Approve' | 'Review' | 'Mark Under Review' | 'Retry';
  summaryText: (count: number) => string;
  emptyText: string;
  href?: string;
  hrefLabel?: string;
}

const ICON_SIZE = 18;

const SOURCE_META: Record<string, SourceMeta> = {
  flagged_items: {
    label: 'Flagged Items',
    icon: <Flag size={ICON_SIZE} />,
    severity: 'routine',
    actionVerb: 'Approve',
    summaryText: (n) => `${n} flagged ${n === 1 ? 'listing' : 'listings'} pending review`,
    emptyText: 'No flagged listings in the moderation queue.',
    href: '/items/flagged',
    hrefLabel: 'Open moderation queue',
  },
  disputes: {
    label: 'Disputes',
    icon: <Scale size={ICON_SIZE} />,
    severity: 'urgent',
    actionVerb: 'Mark Under Review',
    summaryText: (n) => `${n} open ${n === 1 ? 'dispute' : 'disputes'} awaiting review`,
    emptyText: 'No open disputes.',
    href: '/trades/disputes',
    hrefLabel: 'Open dispute queue',
  },
  id_badge_requests: {
    label: 'ID Badge Requests',
    icon: <IdCard size={ICON_SIZE} />,
    severity: 'routine',
    actionVerb: 'Approve',
    summaryText: (n) => `${n} ID badge ${n === 1 ? 'request' : 'requests'} pending verification`,
    emptyText: 'No ID badge requests pending.',
    href: '/id-badges',
    hrefLabel: 'Open ID badge queue',
  },
  cancel_anomalies: {
    label: 'Cancel Insights',
    icon: <TrendingDown size={ICON_SIZE} />,
    severity: 'routine',
    actionVerb: 'Review',
    summaryText: () => 'Cancellation spike detected in the last 7 days',
    emptyText: 'No cancellation spikes detected.',
    href: '/cancellation-insights',
    hrefLabel: 'Open cancellation insights',
  },
  failed_payouts: {
    label: 'Failed Payouts',
    icon: <CircleDollarSign size={ICON_SIZE} />,
    severity: 'urgent',
    actionVerb: 'Retry',
    summaryText: (n) => `${n} failed ${n === 1 ? 'payout' : 'payouts'} needing retry`,
    emptyText: 'No failed payouts.',
    href: '/payouts/earnings',
    hrefLabel: 'Open payouts',
  },
  config_drift: {
    label: 'Config Drift',
    icon: <Settings size={ICON_SIZE} />,
    severity: 'routine',
    actionVerb: 'Review',
    summaryText: (n) => `${n} ${n === 1 ? 'setting' : 'settings'} outside the recommended range`,
    emptyText: 'All settings within their recommended ranges.',
    href: '/config',
    hrefLabel: 'Open config',
  },
};

const SOURCE_ORDER = [
  'flagged_items',
  'disputes',
  'id_badge_requests',
  'cancel_anomalies',
  'failed_payouts',
  'config_drift',
];

const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '';

// Used only to identify the acting admin (supabase.auth.getUser()) so approval
// metadata / audit rows record who approved. Mirrors ListingSearch + /items/flagged.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ActionCenterProps {
  /**
   * 'full' = standalone /action-center page (own header + refresh).
   * 'embedded' = compact section rendered on the dashboard homepage
   * (headerless; shows cards/empty state + a "View all" deep-link).
   */
  variant?: 'full' | 'embedded';
  /**
   * Optional cap on how many source cards to render. The dashboard embeds
   * only the top N pending items (spec: "top 3-5 items") and links to the
   * full page; /action-center passes no cap and shows every source.
   */
  maxCards?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
}

function formatMoney(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ActionCenterClient({ variant = 'full', maxCards }: ActionCenterProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const embedded = variant === 'embedded';

  // Which cards are expanded (drill-down open)
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Per-source detail rows + loading flag
  const [details, setDetails] = useState<Record<string, any[] | null>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});
  // Row currently executing an inline action
  const [actingId, setActingId] = useState<string | null>(null);
  // Inline feedback toast
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/action-center', {
        headers: { 'x-admin-secret': adminSecret },
        cache: 'no-store',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to load (${res.status})`);
      }
      const json = await res.json();
      setSummary(json.data ?? { total: 0, groups: [] });
      setError(null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load the Action Center. Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchDetail = useCallback(async (source: string) => {
    setDetailLoading((prev) => ({ ...prev, [source]: true }));
    try {
      const res = await fetch(`/api/admin/action-center?source=${source}`, {
        headers: { 'x-admin-secret': adminSecret },
        cache: 'no-store',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to load (${res.status})`);
      }
      const json = await res.json();
      setDetails((prev) => ({ ...prev, [source]: json.data ?? [] }));
    } catch (err: any) {
      setToast({ kind: 'error', text: err.message ?? 'Failed to load details.' });
      setDetails((prev) => ({ ...prev, [source]: [] }));
    } finally {
      setDetailLoading((prev) => ({ ...prev, [source]: false }));
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const toggleExpand = (source: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
        if (!(source in details) && !detailLoading[source]) {
          fetchDetail(source);
        }
      }
      return next;
    });
  };

  const groups = useMemo(() => {
    if (!summary?.groups?.length) return [];
    return SOURCE_ORDER.map((s) => summary.groups.find((g) => g.source === s)).filter(
      (g): g is SummaryGroup => !!g
    );
  }, [summary]);

  // Only render cards for sources that actually have pending work.
  const activeGroups = useMemo(() => groups.filter((g) => (g.count || 0) > 0), [groups]);

  // Embedded (dashboard) view shows only the top N cards; the standalone
  // /action-center page renders every source with pending work.
  const visibleGroups = useMemo(
    () => (maxCards && maxCards > 0 ? activeGroups.slice(0, maxCards) : activeGroups),
    [activeGroups, maxCards],
  );

  const total = summary?.total ?? 0;

  const refetchAll = async () => {
    setRefreshing(true);
    setDetails({});
    await fetchSummary();
    // Re-open any expanded card so the drill-down stays fresh.
    expanded.forEach((s) => fetchDetail(s));
  };

  const handleAction = async (
    source: string,
    action: 'approve' | 'review' | 'mark_under_review' | 'retry',
    row: any
  ) => {
    setActingId(row.id || row.key || 'action');
    setToast(null);
    try {
      if (action === 'approve') {
        if (source === 'flagged_items') {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            setToast({ kind: 'error', text: 'Could not identify the current admin. Please sign in again.' });
            return;
          }
          await postJson(`/api/admin/items/${row.id}/status`, { status: 'available', admin_user_id: user.id });
        } else if (source === 'id_badge_requests') {
          await postJson(`/api/admin/id-badges/${row.id}/decide`, { decision: 'approve' });
        }
        setToast({ kind: 'success', text: `Approved ${row.title || row.email || 'item'}.` });
      } else if (action === 'mark_under_review') {
        await postJson('/api/admin/trades/dispute-action', {
          tradeId: row.id,
          action: 'mark_under_review',
        });
        setToast({ kind: 'success', text: 'Dispute marked under review.' });
      } else if (action === 'retry') {
        if (
          !window.confirm('Retry this payout? This will attempt to reprocess the failed payout.')
        ) {
          return;
        }
        await postJson(`/api/admin/payouts/${row.id}/retry`, {});
        setToast({ kind: 'success', text: 'Payout reset to pending for retry.' });
      }
      // Refresh summary + this source's detail after a successful action.
      await fetchSummary();
      if (expanded.has(source)) await fetchDetail(source);
    } catch (err: any) {
      setToast({ kind: 'error', text: err.message ?? 'Action failed.' });
    } finally {
      setActingId(null);
    }
  };

  // ── Render: loading / error / empty ────────────────────────────────────
  if (loading) {
    return (
      <div className={embedded ? '' : 'max-w-4xl mx-auto'}>
        {!embedded && (
          <>
            <h1 className="text-[32px] font-bold leading-10 mb-1" style={{ color: COLORS.textPrimary, letterSpacing: '-0.5px' }}>
              Action Center
            </h1>
            <p className="text-sm mb-6" style={{ color: COLORS.textSecondary }}>
              Every pending admin action in one place.
            </p>
          </>
        )}
        <div
          className="p-8 text-center rounded-2xl"
          style={{
            background: COLORS.cardBg,
            border: `1px solid ${COLORS.cardBorder}`,
            boxShadow: CARD_SHADOW,
          }}
        >
          <p style={{ color: COLORS.textSecondary }}>Loading the action queue…</p>
        </div>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className={embedded ? '' : 'max-w-4xl mx-auto'}>
        {!embedded && (
          <h1 className="text-[32px] font-bold leading-10 mb-1" style={{ color: COLORS.textPrimary, letterSpacing: '-0.5px' }}>
            Action Center
          </h1>
        )}
        <div
          className="p-8 text-center rounded-2xl"
          style={{
            background: COLORS.cardBg,
            border: `1px solid ${COLORS.error500}`,
            boxShadow: CARD_SHADOW,
          }}
        >
          <p className="mb-4" style={{ color: COLORS.error500 }}>
            We couldn&apos;t load the action queue.
          </p>
          <button
            onClick={() => {
              setLoading(true);
              fetchSummary();
            }}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'var(--brand-primary)' }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'max-w-4xl mx-auto'}>
      {/* Header — full page on /action-center; compact section on the dashboard */}
      {embedded ? (
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-semibold" style={{ color: COLORS.textPrimary }}>
            Action Center
          </h2>
          <Link
            href="/action-center"
            className="text-xs font-medium"
            style={{ color: 'var(--brand-primary)' }}
            data-testid="action-center-view-all"
          >
            View all →
          </Link>
        </div>
      ) : (
        <div className="flex items-start justify-between mb-1">
          <div>
            <h1 className="text-[32px] font-bold leading-10" style={{ color: COLORS.textPrimary, letterSpacing: '-0.5px' }}>
              Action Center
            </h1>
            <p className="text-sm" style={{ color: COLORS.textSecondary }}>
              Every pending admin action in one place.
              {summary?.generated_at && (
                <span className="ml-2 text-xs" style={{ color: COLORS.textMuted }}>
                  Updated {formatDateTime(summary.generated_at)}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={refetchAll}
            disabled={refreshing}
            data-testid="action-center-refresh"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ background: 'var(--card-bg)', border: '2px solid var(--brand-primary)', color: 'var(--brand-primary)' }} // Secondary button (§6.1)
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      )}

      {/* Inline feedback toast */}
      {toast && (
        <div
          className="mt-3 px-4 py-2 rounded-lg text-sm"
          data-testid="action-center-toast"
          style={{
            background: toast.kind === 'success' ? 'var(--success-100)' : 'var(--error-100)',
            color: toast.kind === 'success' ? 'var(--text-primary)' : COLORS.error500,
            border: `1px solid ${toast.kind === 'success' ? COLORS.success500 : COLORS.error500}`,
          }}
        >
          {toast.text}
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm" style={{ color: COLORS.error500 }}>
          {error}
        </p>
      )}

      {/* Empty state — "All caught up" with Success 500 checkmark */}
      {!error && total === 0 && (
        <div
          className="mt-6 p-10 text-center rounded-2xl"
          data-testid="action-center-empty"
          style={{
            background: COLORS.cardBg,
            border: `1px solid ${COLORS.cardBorder}`,
            boxShadow: CARD_SHADOW,
          }}
        >
          <CheckCircle2 size={48} style={{ color: COLORS.success500, margin: '0 auto 12px' }} />
          <p className="text-lg font-semibold" style={{ color: COLORS.textPrimary }}>
            All caught up
          </p>
          <p className="text-sm mt-1" style={{ color: COLORS.textSecondary }}>
            There are no pending admin actions right now. New items will appear here as they come
            in.
          </p>
        </div>
      )}

      {/* Grouped cards — only sources with pending work */}
      {!error && total > 0 && (
        <div className="mt-6 space-y-4">
          {visibleGroups.map((group) => {
            const meta = SOURCE_META[group.source];
            if (!meta) return null;
            const count = group.count || 0;
            const isOpen = expanded.has(group.source);
            const severityColor = meta.severity === 'urgent' ? COLORS.error500 : COLORS.warning500;
            const rows = details[group.source] ?? null;
            const isLoadingDetail = !!detailLoading[group.source];

            return (
              <div
                key={group.source}
                data-testid={`action-card-${group.source}`}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: COLORS.cardBg,
                  border: `1px solid ${COLORS.cardBorder}`,
                  boxShadow: CARD_SHADOW,
                  borderRadius: 16,
                }}
              >
                {/* Card header — click to expand/drill */}
                <button
                  onClick={() => toggleExpand(group.source)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-black/5"
                  aria-expanded={isOpen}
                  data-testid={`action-card-header-${group.source}`}
                >
                  <span className="flex-shrink-0" style={{ color: COLORS.accent500 }}>
                    {meta.icon}
                  </span>

                  <span className="flex-1 min-w-0">
                    <span
                      className="block text-sm font-semibold truncate"
                      style={{ color: COLORS.textPrimary }}
                    >
                      {meta.label}
                    </span>
                    <span
                      className="block text-xs mt-0.5 truncate"
                      style={{ color: COLORS.textSecondary }}
                    >
                      {meta.summaryText(count)}
                    </span>
                  </span>

                  {/* Severity pill — Status Badge style (24px height, 12px radius) */}
                  <span
                    className="inline-flex items-center px-3 rounded-xl text-xs font-medium text-white flex-shrink-0"
                    style={{ height: 24, background: severityColor }}
                  >
                    {meta.severity === 'urgent' ? 'Urgent' : 'Routine'}
                  </span>

                  <ChevronDown
                    size={16}
                    className={`flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    style={{ color: COLORS.textMuted }}
                  />
                </button>

                {/* Expanded detail — drill into the list */}
                {isOpen && (
                  <div className="border-t" style={{ borderColor: COLORS.cardBorder }}>
                    {isLoadingDetail && (
                      <p className="px-5 py-4 text-sm" style={{ color: COLORS.textSecondary }}>
                        Loading details…
                      </p>
                    )}
                    {!isLoadingDetail && (!rows || rows.length === 0) && (
                      <p className="px-5 py-4 text-sm" style={{ color: COLORS.textSecondary }}>
                        {meta.emptyText}
                      </p>
                    )}
                    {!isLoadingDetail && rows && rows.length > 0 && (
                      <ul className="divide-y" style={{ borderColor: COLORS.cardBorder }}>
                        {rows.map((row: any, idx: number) => (
                          <li
                            key={row.id || `${group.source}-${idx}`}
                            className="px-5 py-3 flex items-center gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <ActionRowText source={group.source} row={row} />
                            </div>
                            <ActionButtons
                              source={group.source}
                              meta={meta}
                              row={row}
                              acting={actingId === (row.id || row.key || 'action')}
                              onAction={handleAction}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                    {/* Deep-link to the full module page */}
                    {meta.href && (
                      <div
                        className="px-5 py-3 border-t"
                        style={{ borderColor: COLORS.cardBorder }}
                      >
                        <Link
                          href={meta.href}
                          className="text-xs font-medium"
                          style={{ color: 'var(--brand-primary)' }}
                          data-testid={`action-link-${group.source}`}
                        >
                          {meta.hrefLabel} →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Per-source row text ────────────────────────────────────────────────────

function ActionRowText({ source, row }: { source: string; row: any }) {
  if (source === 'flagged_items') {
    return (
      <>
        <p className="text-sm font-medium truncate" style={{ color: COLORS.textPrimary }}>
          {row.title || 'Untitled item'}
        </p>
        <p className="text-xs truncate" style={{ color: COLORS.textSecondary }}>
          {formatMoney(row.price)} · {row.seller_name || row.seller_email || 'Unknown seller'} ·
          Flagged {formatDateTime(row.flagged_at)}
        </p>
      </>
    );
  }
  if (source === 'disputes') {
    return (
      <>
        <p className="text-sm font-medium truncate" style={{ color: COLORS.textPrimary }}>
          {row.item_title || 'Untitled trade'}
        </p>
        <p className="text-xs truncate" style={{ color: COLORS.textSecondary }}>
          {row.dispute_reason || 'No reason given'} · {formatMoney(row.cash_amount_cents)} ·{' '}
          {String(row.dispute_status || '').replace('_', ' ')}
        </p>
      </>
    );
  }
  if (source === 'id_badge_requests') {
    return (
      <>
        <p className="text-sm font-medium truncate" style={{ color: COLORS.textPrimary }}>
          {[row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unknown user'}
        </p>
        <p className="text-xs truncate" style={{ color: COLORS.textSecondary }}>
          {row.email || 'No email'} · Submitted {formatDateTime(row.submitted_at)}
        </p>
      </>
    );
  }
  if (source === 'cancel_anomalies') {
    return (
      <>
        <p className="text-sm font-medium truncate" style={{ color: COLORS.textPrimary }}>
          {row.reason || 'Cancellation reason'} — {row.count} this week
        </p>
        <p className="text-xs truncate" style={{ color: COLORS.textSecondary }}>
          Top cancellation reason in the last 7 days
        </p>
      </>
    );
  }
  if (source === 'failed_payouts') {
    return (
      <>
        <p className="text-sm font-medium truncate" style={{ color: COLORS.textPrimary }}>
          {row.seller_name || row.seller_email || 'Unknown seller'}
        </p>
        <p className="text-xs truncate" style={{ color: COLORS.textSecondary }}>
          {formatMoney(row.net_amount_cents)} · {row.failure_reason || 'No failure reason'} ·
          Created {formatDateTime(row.created_at)}
        </p>
      </>
    );
  }
  if (source === 'config_drift') {
    return (
      <>
        <p className="text-sm font-medium truncate" style={{ color: COLORS.textPrimary }}>
          {row.key}
        </p>
        <p className="text-xs truncate" style={{ color: COLORS.textSecondary }}>
          Current <b>{row.value}</b> · documented default <b>{row.documented_default}</b> ·
          recommended {row.recommended_min}–{row.recommended_max}
        </p>
      </>
    );
  }
  return null;
}

// ── Inline action buttons ──────────────────────────────────────────────────

function ActionButtons({
  source,
  meta,
  row,
  acting,
  onAction,
}: {
  source: string;
  meta: SourceMeta;
  row: any;
  acting: boolean;
  onAction: (
    source: string,
    action: 'approve' | 'review' | 'mark_under_review' | 'retry',
    row: any
  ) => void;
}) {
  const primaryBg = 'var(--brand-primary)'; // Primary button (§6.1)

  if (source === 'disputes') {
    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        {row.dispute_status === 'reported' && (
          <button
            onClick={() => onAction(source, 'mark_under_review', row)}
            disabled={acting}
            className="px-3 rounded-xl text-xs font-medium text-white disabled:opacity-50 whitespace-nowrap"
            style={{ height: 24, background: 'var(--brand-primary)' }}
            data-testid={`action-${source}-${row.id}`}
          >
            {acting ? '…' : 'Under Review'}
          </button>
        )}
        {meta.href && (
          <Link
            href={meta.href}
            className="px-3 rounded-xl text-xs font-medium whitespace-nowrap"
            style={{
              height: 24,
              display: 'inline-flex',
              alignItems: 'center',
              color: 'var(--brand-primary)',
            }}
          >
            Review
          </Link>
        )}
      </div>
    );
  }

  if (source === 'cancel_anomalies' || source === 'config_drift') {
    return (
      <Link
        href={meta.href || '#'}
        className="px-3 rounded-xl text-xs font-medium whitespace-nowrap"
        style={{
          height: 24,
          display: 'inline-flex',
          alignItems: 'center',
          color: 'var(--brand-primary)',
        }}
        data-testid={`action-${source}-${row.key || row.reason || 'row'}`}
      >
        {meta.actionVerb}
      </Link>
    );
  }

  return (
    <button
      onClick={() => onAction(source, meta.actionVerb === 'Retry' ? 'retry' : 'approve', row)}
      disabled={acting}
      className="px-3 rounded-xl text-xs font-medium text-white disabled:opacity-50 whitespace-nowrap"
      style={{ height: 24, background: primaryBg }}
      data-testid={`action-${source}-${row.id}`}
    >
      {acting ? '…' : meta.actionVerb}
    </button>
  );
}
