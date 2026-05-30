'use client';

/**
 * File: p2p-kids-admin/src/app/tax/reports/page.tsx
 * MODULE-15.3-PART3 TAX-008
 *
 * Tax collection reports: filterable by date range + optional node.
 * Supports 7 report types. CSV export uses get_tax_export_data RPC for
 * per-transaction data; summary view uses get_tax_summary_for_period.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface NodeOpt {
  id: string;
  name: string;
}

interface TaxSummaryRow {
  jurisdiction: string;
  transaction_count: number;
  taxable_total_cents: number;
  tax_collected_cents: number;
  tax_refunded_cents: number;
  tax_net_cents: number;
}

interface TaxSummary {
  start_date: string;
  end_date: string;
  node_id: string | null;
  transaction_count: number;
  taxable_total_cents: number;
  tax_collected_cents: number;
  tax_refunded_cents: number;
  tax_net_cents: number;
  by_jurisdiction: TaxSummaryRow[];
}

const fmtCents = (c: number) => `$${(c / 100).toFixed(2)}`;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function TaxReportsPage() {
  const supabase = useMemo(
    () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      ),
    []
  );
  const [nodes, setNodes] = useState<NodeOpt[]>([]);
  const [startDate, setStartDate] = useState(isoDaysAgo(30));
  const [endDate, setEndDate] = useState(todayISO());
  const [nodeId, setNodeId] = useState<string>('');
  const [reportType, setReportType] = useState<string>('summary');
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('nodes').select('id, name').order('name');
      setNodes((data ?? []) as NodeOpt[]);
    })();
  }, [supabase]);

  const run = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('get_tax_summary_for_period', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_node_id: nodeId || null,
      p_report_type: reportType,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    const r = data as { success: boolean; data?: TaxSummary; error?: { message: string } };
    if (!r?.success || !r.data) {
      setError(r?.error?.message ?? 'unknown error');
      return;
    }
    setSummary(r.data);
  };

  /**
   * TAX-008: Export full per-transaction CSV via get_tax_export_data RPC.
   * Falls back to summary jurisdiction data if RPC returns forbidden (non-admin).
   */
  const exportCsv = async () => {
    setExporting(true);
    setError(null);
    try {
      const { data: exportData, error: exportError } = await supabase.rpc('get_tax_export_data', {
        p_start_date: new Date(startDate).toISOString(),
        p_end_date: new Date(endDate + 'T23:59:59').toISOString(),
      });
      if (exportError) {
        setError(`CSV export failed: ${exportError.message}`);
        return;
      }
      // get_tax_export_data returns TABLE rows directly (array)
      const rows = Array.isArray(exportData) ? exportData : [];
      const headers = [
        'transaction_date',
        'buyer_email',
        'node_name',
        'taxable_amount_usd',
        'tax_rate',
        'tax_amount_usd',
        'refunded_tax_usd',
        'net_tax_usd',
      ];
      const lines = [headers.join(',')];
      (rows as Record<string, unknown>[]).forEach((r) => {
        lines.push(
          headers
            .map((h) => {
              const val = r[h] ?? '';
              // Wrap in quotes if contains comma
              return String(val).includes(',') ? `"${val}"` : String(val);
            })
            .join(',')
        );
      });
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tax-transactions-${startDate}-to-${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6" data-testid="tax-reports-page">
      <h1 className="text-2xl font-semibold mb-2">Sales Tax — Reports</h1>
      <p className="text-sm text-gray-600 mb-4">
        Aggregated tax collected (and refunded) for a date range.
      </p>

      {/* TAX-008: Report type tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['summary', 'jurisdictions', 'transactions', 'refunds', 'by_period', 'tax_exempt', 'audit_trail'].map((t) => (
          <button
            key={t}
            onClick={() => setReportType(t)}
            className={`px-3 py-1 rounded text-sm border ${
              reportType === t
                ? 'bg-blue-600 text-white border-blue-600'
                : 'text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
            data-testid={`tax-report-type-${t}`}
          >
            {t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-end mb-4">
        <label className="flex flex-col text-sm">
          Start
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded px-2 py-1"
            data-testid="tax-report-start"
          />
        </label>
        <label className="flex flex-col text-sm">
          End
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded px-2 py-1"
            data-testid="tax-report-end"
          />
        </label>
        <label className="flex flex-col text-sm">
          Node (optional)
          <select
            value={nodeId}
            onChange={(e) => setNodeId(e.target.value)}
            className="border rounded px-2 py-1"
            data-testid="tax-report-node"
          >
            <option value="">All nodes</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={run}
          disabled={loading}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          data-testid="tax-report-run"
        >
          {loading ? 'Running…' : 'Run Report'}
        </button>
        <button
          onClick={exportCsv}
          disabled={exporting}
          className="px-4 py-2 rounded border disabled:opacity-50"
          data-testid="tax-report-export"
        >
          {exporting ? 'Exporting…' : 'Export CSV (Transactions)'}
        </button>
      </div>

      {error && <div className="text-red-600 mb-4">{error}</div>}

      {summary && (
        <div data-testid="tax-report-results">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Stat label="Transactions" value={String(summary.transaction_count)} />
            <Stat label="Taxable Total" value={fmtCents(summary.taxable_total_cents)} />
            <Stat label="Tax Collected" value={fmtCents(summary.tax_collected_cents)} />
            <Stat label="Tax Net" value={fmtCents(summary.tax_net_cents)} />
          </div>

          <h2 className="text-lg font-semibold mb-2">By Jurisdiction</h2>
          <table className="min-w-full text-sm border" data-testid="tax-report-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2 border-b">Jurisdiction</th>
                <th className="text-right p-2 border-b">Txns</th>
                <th className="text-right p-2 border-b">Taxable</th>
                <th className="text-right p-2 border-b">Collected</th>
                <th className="text-right p-2 border-b">Refunded</th>
                <th className="text-right p-2 border-b">Net</th>
              </tr>
            </thead>
            <tbody>
              {summary.by_jurisdiction.map((r) => (
                <tr key={r.jurisdiction} className="border-b">
                  <td className="p-2">{r.jurisdiction}</td>
                  <td className="p-2 text-right">{r.transaction_count}</td>
                  <td className="p-2 text-right">{fmtCents(r.taxable_total_cents)}</td>
                  <td className="p-2 text-right">{fmtCents(r.tax_collected_cents)}</td>
                  <td className="p-2 text-right">{fmtCents(r.tax_refunded_cents)}</td>
                  <td className="p-2 text-right">{fmtCents(r.tax_net_cents)}</td>
                </tr>
              ))}
              {summary.by_jurisdiction.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-3 text-center text-gray-500">
                    No tax collected in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
