'use client';

/**
 * File: p2p-kids-admin/src/app/tax/nodes/page.tsx
 * MODULE-15.3-PART3 TAX-007
 *
 * Admin UI: per-node sales-tax configuration.
 * - tax_rate is stored as DECIMAL fraction (0.0635) but edited as percent (6.35).
 * - Writes via RPC `update_node_tax_config` (admin-gated server-side).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { resolveAdminEmails } from '@/lib/settingsAudit';
import SettingsLinkBanner from '@/components/settings/SettingsLinkBanner';
// FIX-Task-23 item 2: shared browser client.
import { supabaseBrowser } from '@/lib/supabase/client';

interface NodeRow {
  id: string;
  name: string;
  tax_rate: number | null;
  tax_jurisdiction: string | null;
  tax_enabled: boolean | null;
}

interface EditState {
  ratePercent: string;
  jurisdiction: string;
  enabled: boolean;
}

interface NodeAuditMeta {
  updatedAt: string | null;
  editor: string | null;
}

export default function TaxNodesPage() {
  // FIX-Task-23 item 2: shared browser client (the memo preserves stable identity).
  const supabase = useMemo(() => supabaseBrowser, []);
  const [rows, setRows] = useState<NodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  // FIX-Task-20 F8: inline error state replacing native alert() — a browser alert
  // cannot be styled, blocks the page, and wedges browser automation until dismissed.
  const [pageError, setPageError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  // Last-edited metadata per node, sourced from admin_audit_log
  // (action='update_node_tax_config') — the same audit trail used elsewhere.
  const [nodeMeta, setNodeMeta] = useState<Record<string, NodeAuditMeta>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('nodes')
      .select('id, name, tax_rate, tax_jurisdiction, tax_enabled')
      .order('name', { ascending: true });
    if (error) {
      // FIX-Task-20 F8: inline error, not alert().
      setPageError(`We couldn't load the node list: ${error.message}`);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as NodeRow[];
    setRows(list);
    const initial: Record<string, EditState> = {};
    list.forEach((n) => {
      initial[n.id] = {
        ratePercent: ((n.tax_rate ?? 0) * 100).toFixed(2),
        jurisdiction: n.tax_jurisdiction ?? '',
        enabled: !!n.tax_enabled,
      };
    });
    setEdits(initial);

    // Load the latest update_node_tax_config audit row per node so each row
    // can show "Last updated · <ts> · by <editor>".
    await loadNodeMeta();
    setLoading(false);
  };

  const loadNodeMeta = async () => {
    try {
      const { data: auditRows } = await supabase
        .from('admin_audit_log')
        .select('admin_id, entity_id, created_at')
        .eq('action', 'update_node_tax_config')
        .order('created_at', { ascending: false });
      const latest: Record<string, { updatedAt: string; adminId: string }> = {};
      (auditRows ?? []).forEach(
        (r: { admin_id: string; entity_id: string; created_at: string }) => {
          if (r.entity_id && !latest[r.entity_id]) {
            latest[r.entity_id] = {
              updatedAt: r.created_at,
              adminId: r.admin_id,
            };
          }
        }
      );
      const emails = await resolveAdminEmails(
        supabase,
        Object.values(latest).map((m) => m.adminId)
      );
      const meta: Record<string, NodeAuditMeta> = {};
      Object.entries(latest).forEach(([nodeId, m]) => {
        meta[nodeId] = {
          updatedAt: m.updatedAt,
          editor: emails[m.adminId] ?? m.adminId,
        };
      });
      setNodeMeta(meta);
    } catch (err) {
      console.error('[TaxNodes] loadNodeMeta failed:', err);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearRowError = (id: string) =>
    setRowErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const setRowError = (id: string, message: string) =>
    setRowErrors((prev) => ({ ...prev, [id]: message }));

  const save = async (id: string) => {
    const e = edits[id];
    if (!e) return;
    clearRowError(id);
    const pct = parseFloat(e.ratePercent);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      // FIX-Task-20 F8: inline validation (was alert()).
      setRowError(id, 'Tax rate must be a number between 0 and 100 (percent).');
      return;
    }
    setSavingId(id);
    const { data, error } = await supabase.rpc('update_node_tax_config', {
      p_node_id: id,
      p_tax_rate: pct / 100,
      p_tax_jurisdiction: e.jurisdiction || null,
      p_tax_enabled: e.enabled,
    });
    setSavingId(null);
    if (error) {
      setRowError(id, `We couldn't save this node's tax settings: ${error.message}`);
      return;
    }
    const r = data as { success: boolean; error?: { message: string } };
    if (!r?.success) {
      setRowError(
        id,
        `We couldn't save this node's tax settings: ${r?.error?.message ?? 'unknown error'}.`
      );
      return;
    }
    await load();
  };

  const filtered = rows.filter(
    (r) =>
      !filter ||
      r.name.toLowerCase().includes(filter.toLowerCase()) ||
      (r.tax_jurisdiction ?? '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="p-6" data-testid="tax-nodes-page">
      <h1 className="text-2xl font-semibold mb-2">Sales Tax — Per Node</h1>
      <p className="text-sm text-gray-600 mb-4">
        Configure tax rate and jurisdiction for each node. Rate is shown as a percent.
      </p>

      {/* Cross-link: global sales-tax switches live in /config → Tax */}
      <div className="mb-4">
        <SettingsLinkBanner
          message="Global sales-tax settings live in Config → Tax. This page manages per-node rates only."
          href="/config?tab=tax"
          linkLabel="Open Config → Tax"
          testId="tax-nodes-config-link"
        />
      </div>

      <input
        type="text"
        placeholder="Filter by name or jurisdiction…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="border rounded px-3 py-2 mb-4 w-full max-w-md"
        data-testid="tax-nodes-filter"
      />

      {/* FIX-Task-20 F8: page-level inline error banner (same pattern as /tax/rules). */}
      {pageError && (
        <div
          className="bg-red-50 border border-red-300 text-red-700 rounded p-3 mb-4 flex items-start justify-between gap-4"
          data-testid="tax-nodes-error"
          role="alert"
        >
          <span className="text-sm">{pageError}</span>
          <button
            type="button"
            onClick={() => setPageError(null)}
            className="text-red-700 font-bold leading-none"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {loading ? (
        <div>Loading…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border" data-testid="tax-nodes-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2 border-b">Node</th>
                <th className="text-left p-2 border-b">Tax Rate (%)</th>
                <th className="text-left p-2 border-b">Jurisdiction</th>
                <th className="text-left p-2 border-b">Enabled</th>
                <th className="text-left p-2 border-b">Last Updated</th>
                <th className="text-left p-2 border-b">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((n) => {
                const e = edits[n.id];
                if (!e) return null;
                return (
                  <tr key={n.id} className="border-b" data-testid={`tax-node-row-${n.id}`}>
                    <td className="p-2">{n.name}</td>
                    <td className="p-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={e.ratePercent}
                        onChange={(ev) =>
                          setEdits((p) => ({
                            ...p,
                            [n.id]: { ...e, ratePercent: ev.target.value },
                          }))
                        }
                        className="border rounded px-2 py-1 w-24"
                        data-testid={`tax-rate-input-${n.id}`}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={e.jurisdiction}
                        onChange={(ev) =>
                          setEdits((p) => ({
                            ...p,
                            [n.id]: { ...e, jurisdiction: ev.target.value },
                          }))
                        }
                        placeholder="e.g. CT"
                        className="border rounded px-2 py-1 w-32"
                        data-testid={`tax-jur-input-${n.id}`}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={e.enabled}
                        onChange={(ev) =>
                          setEdits((p) => ({
                            ...p,
                            [n.id]: { ...e, enabled: ev.target.checked },
                          }))
                        }
                        data-testid={`tax-enabled-input-${n.id}`}
                      />
                    </td>
                    <td
                      className="p-2 text-xs"
                      data-testid={`tax-node-last-updated-${n.id}`}
                    >
                      {nodeMeta[n.id]?.updatedAt ? (
                        <>
                          {new Date(nodeMeta[n.id].updatedAt!).toLocaleString()}
                          <br />
                          <span className="text-gray-500">
                            by {nodeMeta[n.id].editor}
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="p-2">
                      <button
                        disabled={savingId === n.id}
                        onClick={() => save(n.id)}
                        className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
                        data-testid={`tax-save-${n.id}`}
                      >
                        {savingId === n.id ? 'Saving…' : 'Save'}
                      </button>
                      {/* FIX-Task-20 F8: per-row inline error, in place of alert(). */}
                      {rowErrors[n.id] && (
                        <div
                          className="text-red-600 text-xs mt-1 max-w-[18rem]"
                          data-testid={`tax-node-error-${n.id}`}
                          role="alert"
                        >
                          {rowErrors[n.id]}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
