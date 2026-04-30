// File: p2p-kids-admin/src/components/spconfig/SPHealthPanel.tsx
// Module: SP Economy Hub — Tab 1 (Health)
// Purpose: Single-screen "is the SP economy stable?" view with hero KPIs +
//          issues list. Powered by /api/admin/sp-economy/summary.

'use client';

import { useEffect, useState, useCallback } from 'react';

const ADMIN_API_BASE_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL?.replace(/\/$/, '') || '';
const buildUrl = (path: string) =>
  ADMIN_API_BASE_URL ? `${ADMIN_API_BASE_URL}${path}` : path;
const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '';
const authHeaders = { 'x-admin-secret': adminSecret };

type RangePreset = '7d' | '30d' | '90d';

interface NodeOption {
  id: string;
  name: string;
}

interface SpEconomySummary {
  window: { start: string; end: string; node_id: string | null };
  circulation: {
    available: number;
    pending: number;
    total: number;
    active_wallets: number;
    frozen_wallets: number;
    suspended_wallets: number;
  };
  flow: {
    earned: number;
    spent: number;
    earn_spend_ratio: number;
    admin_grants_count: number;
    admin_grants_total: number;
    admin_deducts_count: number;
    admin_deducts_total: number;
  };
  trades: {
    total: number;
    with_sp: number;
    sp_adoption_pct: number;
    avg_sp_per_trade: number;
    avg_cash_per_trade: number;
  };
  risk: { stuck_pending_wallets: number };
}

const PRESET_DAYS: Record<RangePreset, number> = { '7d': 7, '30d': 30, '90d': 90 };

function fmtNum(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function rangeBounds(preset: RangePreset) {
  const end = new Date();
  const start = new Date(end.getTime() - PRESET_DAYS[preset] * 24 * 60 * 60 * 1000);
  return { start, end };
}

// Threshold helpers — derived directly from the recommendations table
function ratioStatus(ratio: number): { tone: 'ok' | 'warn' | 'alert'; label: string } {
  if (ratio === 0) return { tone: 'warn', label: 'no spend yet' };
  if (ratio < 0.8) return { tone: 'alert', label: 'deflation risk' };
  if (ratio > 1.4) return { tone: 'alert', label: 'inflation risk' };
  return { tone: 'ok', label: 'healthy' };
}

function adoptionStatus(pct: number): { tone: 'ok' | 'warn' | 'alert'; label: string } {
  if (pct < 10) return { tone: 'warn', label: 'under-used' };
  if (pct > 70) return { tone: 'alert', label: 'cash-starved' };
  return { tone: 'ok', label: 'healthy' };
}

const TONE_BG: Record<'ok' | 'warn' | 'alert', string> = {
  ok: 'bg-green-50 border-green-200',
  warn: 'bg-amber-50 border-amber-200',
  alert: 'bg-red-50 border-red-200',
};
const TONE_TEXT: Record<'ok' | 'warn' | 'alert', string> = {
  ok: 'text-green-700',
  warn: 'text-amber-700',
  alert: 'text-red-700',
};

export function SPHealthPanel() {
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [nodeId, setNodeId] = useState<string>(''); // '' = all nodes
  const [nodes, setNodes] = useState<NodeOption[]>([]);
  const [summary, setSummary] = useState<SpEconomySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load node options once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(buildUrl('/api/admin/sp-economy/summary?action=nodes'), {
          headers: authHeaders,
        });
        const json = await res.json();
        if (!cancelled && res.ok && json.success) {
          setNodes(json.nodes ?? []);
        }
      } catch {
        // non-fatal: node filter just stays empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { start, end } = rangeBounds(preset);
      const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
      });
      if (nodeId) params.set('node_id', nodeId);

      const res = await fetch(
        buildUrl(`/api/admin/sp-economy/summary?${params.toString()}`),
        { headers: authHeaders },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setSummary(json.summary as SpEconomySummary);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load SP economy summary');
    } finally {
      setLoading(false);
    }
  }, [preset, nodeId]);

  useEffect(() => {
    load();
  }, [load]);

  const ratio = summary?.flow.earn_spend_ratio ?? 0;
  const adoption = summary?.trades.sp_adoption_pct ?? 0;
  const ratioInfo = ratioStatus(ratio);
  const adoptionInfo = adoptionStatus(adoption);

  // Issues list — derived signals
  const issues: { tone: 'warn' | 'alert'; text: string }[] = [];
  if (summary) {
    if (ratioInfo.tone !== 'ok')
      issues.push({
        tone: ratioInfo.tone,
        text: `Earn / Spend ratio ${ratio.toFixed(2)} — ${ratioInfo.label}`,
      });
    if (adoptionInfo.tone !== 'ok')
      issues.push({
        tone: adoptionInfo.tone,
        text: `SP adoption ${adoption.toFixed(1)}% of trades — ${adoptionInfo.label}`,
      });
    if (summary.risk.stuck_pending_wallets > 0)
      issues.push({
        tone: 'warn',
        text: `${summary.risk.stuck_pending_wallets} wallets have pending SP older than 3 days`,
      });
    if (summary.circulation.frozen_wallets + summary.circulation.suspended_wallets > 0)
      issues.push({
        tone: 'warn',
        text: `${summary.circulation.frozen_wallets} frozen + ${summary.circulation.suspended_wallets} suspended wallets`,
      });
    if (summary.flow.admin_grants_count + summary.flow.admin_deducts_count > 0)
      issues.push({
        tone: 'warn',
        text: `${summary.flow.admin_grants_count} admin grants, ${summary.flow.admin_deducts_count} admin deductions in window`,
      });
  }

  return (
    <div data-testid="sp-health-panel" className="space-y-6">
      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-md border border-gray-200 p-1 bg-white">
          {(['7d', '30d', '90d'] as RangePreset[]).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              data-testid={`sp-health-range-${p}`}
              className={`px-3 py-1 text-sm rounded ${
                preset === p
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <select
          value={nodeId}
          onChange={(e) => setNodeId(e.target.value)}
          data-testid="sp-health-node-filter"
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white"
        >
          <option value="">All nodes</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>

        {loading && <span className="text-sm text-gray-400">Loading…</span>}
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          data-testid="sp-health-error"
        >
          {error}
        </div>
      )}

      {/* KPI strip (6 hero tiles) */}
      {summary && (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          data-testid="sp-health-kpis"
        >
          <KpiTile
            label="SP in circulation"
            primary={`${fmtNum(summary.circulation.total)} SP`}
            secondary={`${fmtNum(summary.circulation.available)} avail · ${fmtNum(
              summary.circulation.pending,
            )} pending`}
            tone="ok"
          />
          <KpiTile
            label="Earn / Spend ratio"
            primary={ratio.toFixed(2)}
            secondary={ratioInfo.label}
            tone={ratioInfo.tone}
          />
          <KpiTile
            label="% trades using SP"
            primary={`${adoption.toFixed(1)}%`}
            secondary={`${summary.trades.with_sp} of ${summary.trades.total} trades`}
            tone={adoptionInfo.tone}
          />
          <KpiTile
            label="Avg SP per SP-trade"
            primary={`${fmtNum(summary.trades.avg_sp_per_trade)} SP`}
            secondary={`avg cash $${fmtNum(summary.trades.avg_cash_per_trade)}`}
            tone="ok"
          />
          <KpiTile
            label="Admin adjustments"
            primary={`+${fmtNum(summary.flow.admin_grants_total)} / -${fmtNum(
              summary.flow.admin_deducts_total,
            )}`}
            secondary={`${summary.flow.admin_grants_count} grants · ${summary.flow.admin_deducts_count} deducts`}
            tone={
              summary.flow.admin_grants_count + summary.flow.admin_deducts_count > 0
                ? 'warn'
                : 'ok'
            }
          />
          <KpiTile
            label="Stuck pending wallets"
            primary={summary.risk.stuck_pending_wallets.toString()}
            secondary="pending SP older than 3 days"
            tone={summary.risk.stuck_pending_wallets > 0 ? 'warn' : 'ok'}
          />
        </div>
      )}

      {/* Issues list */}
      {summary && (
        <section data-testid="sp-health-issues" aria-label="SP economy issues">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Issues to review</h3>
          {issues.length === 0 ? (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              ✅ No issues detected for the selected window.
            </div>
          ) : (
            <ul className="space-y-2">
              {issues.map((issue, i) => (
                <li
                  key={i}
                  className={`rounded-md border p-3 text-sm ${TONE_BG[issue.tone]} ${TONE_TEXT[issue.tone]}`}
                  data-testid={`sp-health-issue-${i}`}
                >
                  {issue.text}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function KpiTile(props: {
  label: string;
  primary: string;
  secondary?: string;
  tone: 'ok' | 'warn' | 'alert';
}) {
  return (
    <div
      className={`rounded-lg border p-4 shadow-sm ${TONE_BG[props.tone]}`}
      data-testid={`kpi-${props.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
    >
      <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
        {props.label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${TONE_TEXT[props.tone]}`}>{props.primary}</p>
      {props.secondary && (
        <p className="mt-0.5 text-xs text-gray-500">{props.secondary}</p>
      )}
    </div>
  );
}

export default SPHealthPanel;
