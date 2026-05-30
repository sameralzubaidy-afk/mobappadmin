'use client';

/**
 * File: p2p-kids-admin/src/app/tax/settings/page.tsx
 * MODULE-15.3-PART3 TAX-009
 *
 * Global sales-tax settings stored in admin_config (category='tax').
 * Keys:
 *   sales_tax_enabled          boolean
 *   default_sales_tax_rate     number (DECIMAL fraction, e.g. 0.0635 = 6.35%)
 *   subscription_fee_taxable   boolean
 *   tax_remittance_jurisdiction string
 */
import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface State {
  enabled: boolean;
  ratePercent: string;
  subscriptionTaxable: boolean;
  jurisdiction: string;
}

const KEYS = {
  ENABLED: 'sales_tax_enabled',
  RATE: 'default_sales_tax_rate',
  SUB_TAX: 'subscription_fee_taxable',
  JUR: 'tax_remittance_jurisdiction',
} as const;

export default function TaxSettingsPage() {
  const supabase = useMemo(
    () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      ),
    []
  );
  const [state, setState] = useState<State>({
    enabled: false,
    ratePercent: '0.00',
    subscriptionTaxable: false,
    jurisdiction: 'CT',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_config')
      .select('key, value')
      .in('key', Object.values(KEYS));
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    const map = new Map<string, string>();
    (data ?? []).forEach((r: any) => map.set(r.key, r.value));
    const rateFraction = parseFloat(map.get(KEYS.RATE) ?? '0') || 0;
    setState({
      enabled: (map.get(KEYS.ENABLED) ?? 'false') === 'true',
      ratePercent: (rateFraction * 100).toFixed(2),
      subscriptionTaxable: (map.get(KEYS.SUB_TAX) ?? 'false') === 'true',
      jurisdiction: map.get(KEYS.JUR) ?? 'CT',
    });
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setErr(null);
    setMsg(null);
    const pct = parseFloat(state.ratePercent);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      setErr('Default tax rate must be a percent between 0 and 100.');
      return;
    }
    setSaving(true);
    try {
      const writes: Array<{ key: string; value: string; data_type: string }> = [
        { key: KEYS.ENABLED, value: String(state.enabled), data_type: 'boolean' },
        { key: KEYS.RATE, value: (pct / 100).toFixed(4), data_type: 'number' },
        { key: KEYS.SUB_TAX, value: String(state.subscriptionTaxable), data_type: 'boolean' },
        { key: KEYS.JUR, value: state.jurisdiction || '', data_type: 'string' },
      ];
      for (const w of writes) {
        const { error } = await supabase.rpc('upsert_admin_config_setting', {
          p_key: w.key,
          p_value: w.value,
          p_category: 'tax',
          p_data_type: w.data_type,
          p_is_secret: false,
          p_is_active: true,
        });
        if (error) throw error;
      }
      // best-effort audit
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) {
        await supabase.from('admin_audit_log').insert({
          admin_id: user.id,
          action: 'update_tax_settings',
          entity_type: 'admin_config',
          changes: { ...state, ratePercent: pct },
        });
      }
      setMsg('Tax settings saved.');
      setTimeout(() => setMsg(null), 4000);
    } catch (e: any) {
      setErr(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 max-w-2xl" data-testid="tax-settings-page">
      <h1 className="text-2xl font-semibold mb-2">Sales Tax — Global Settings</h1>
      <p className="text-sm text-gray-600 mb-4">
        Master switches that apply across all nodes. Per-node rates override the default.
      </p>

      {/* TAX-009: Warning banner when global tax is disabled */}
      {!state.enabled && (
        <div
          className="flex items-center gap-2 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded p-3 mb-4"
          data-testid="tax-disabled-warning"
        >
          <span className="text-lg">⚠️</span>
          <span className="text-sm">
            <strong>Sales tax is currently OFF.</strong> No tax will be applied to any
            transactions across all nodes until you enable it and save.
          </span>
        </div>
      )}

      {err && <div className="text-red-600 mb-3">{err}</div>}
      {msg && <div className="text-green-600 mb-3">{msg}</div>}

      <div className="space-y-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={state.enabled}
            onChange={(e) => setState({ ...state, enabled: e.target.checked })}
            data-testid="tax-enabled-toggle"
          />
          <span>Enable sales tax globally</span>
        </label>

        <label className="flex flex-col text-sm">
          Default tax rate (%)
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={state.ratePercent}
            onChange={(e) => setState({ ...state, ratePercent: e.target.value })}
            className="border rounded px-2 py-1 w-32"
            data-testid="tax-default-rate"
          />
          <span className="text-xs text-gray-500 mt-1">
            Stored as fraction. e.g. 6.35 % → 0.0635
          </span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={state.subscriptionTaxable}
            onChange={(e) =>
              setState({ ...state, subscriptionTaxable: e.target.checked })
            }
            data-testid="tax-subscription-toggle"
          />
          <span>Tax Kids Club+ subscription fees</span>
        </label>

        <label className="flex flex-col text-sm">
          Remittance jurisdiction
          <input
            type="text"
            value={state.jurisdiction}
            onChange={(e) => setState({ ...state, jurisdiction: e.target.value })}
            className="border rounded px-2 py-1 w-32"
            data-testid="tax-jurisdiction"
          />
        </label>

        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          data-testid="tax-settings-save"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
