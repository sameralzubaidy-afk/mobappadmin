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
 *   include_fee_in_tax_base    boolean — tax-category-rules
 */
import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  getAdminConfigMeta,
  getCurrentAdminId,
  formatUpdatedMeta,
  type AdminConfigMetaRow,
} from '@/lib/settingsAudit';
import SettingsLinkBanner from '@/components/settings/SettingsLinkBanner';
import LastUpdatedLabel from '@/components/settings/LastUpdatedLabel';

interface State {
  enabled: boolean;
  ratePercent: string;
  subscriptionTaxable: boolean;
  jurisdiction: string;
  includeFeeInTaxBase: boolean;
}

const KEYS = {
  ENABLED: 'sales_tax_enabled',
  RATE: 'default_sales_tax_rate',
  SUB_TAX: 'subscription_fee_taxable',
  JUR: 'tax_remittance_jurisdiction',
  FEE_IN_BASE: 'include_fee_in_tax_base',
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
    includeFeeInTaxBase: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Last-updated metadata per key (admin_config.updated_at + updated_by).
  const [meta, setMeta] = useState<Record<string, AdminConfigMetaRow>>({});

  const load = async () => {
    setLoading(true);
    // Use SECURITY DEFINER RPC to bypass RLS on admin_config
    const { data, error } = await supabase.rpc('fn_get_admin_config_values', {
      p_keys: Object.values(KEYS),
    });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    const map = new Map<string, string>();
    (data ?? []).forEach((r: any) => map.set(r.out_key, r.out_value));
    const rateFraction = parseFloat(map.get(KEYS.RATE) ?? '0') || 0;
    setState({
      enabled: (map.get(KEYS.ENABLED) ?? 'false') === 'true',
      ratePercent: (rateFraction * 100).toFixed(2),
      subscriptionTaxable: (map.get(KEYS.SUB_TAX) ?? 'false') === 'true',
      jurisdiction: map.get(KEYS.JUR) ?? 'CT',
      includeFeeInTaxBase: (map.get(KEYS.FEE_IN_BASE) ?? 'false') === 'true',
    });
    // Same "Last updated" metadata the /config hub shows for these keys.
    const metaRows = await getAdminConfigMeta(supabase, Object.values(KEYS));
    setMeta(metaRows);
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
      // Record the acting admin so admin_config.updated_by is set — the same
      // audit source the /config hub uses.
      const adminId = await getCurrentAdminId(supabase);
      const writes: Array<{ key: string; value: string; data_type: string }> = [
        { key: KEYS.ENABLED, value: String(state.enabled), data_type: 'boolean' },
        { key: KEYS.RATE, value: (pct / 100).toFixed(4), data_type: 'number' },
        { key: KEYS.SUB_TAX, value: String(state.subscriptionTaxable), data_type: 'boolean' },
        { key: KEYS.JUR, value: state.jurisdiction || '', data_type: 'string' },
        { key: KEYS.FEE_IN_BASE, value: String(state.includeFeeInTaxBase), data_type: 'boolean' },
      ];
      for (const w of writes) {
        const { error } = await supabase.rpc('upsert_admin_config_setting', {
          p_key: w.key,
          p_value: w.value,
          p_category: 'tax',
          p_data_type: w.data_type,
          p_is_secret: false,
          p_is_active: true,
          p_admin_id: adminId ?? null,
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

      {/* DT71 (2026-08-31): config-propagation note — the sales tax toggle is read
          server-side per offer/checkout; other admin config values refresh on app
          foreground (5-min in-memory cache). No app relaunch required. */}
      <div
        className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 rounded p-3 mb-4"
        data-testid="tax-settings-propagation-note"
      >
        <span className="text-lg">ℹ️</span>
        <span className="text-sm">
          <strong>Changes apply without a relaunch.</strong> Sales-tax changes take
          effect on the next offer/checkout in the app. Other admin config values
          refresh when the app returns to the foreground (or within ~5 minutes).
        </span>
      </div>

      {/* Cross-link: these settings share the same admin_config rows as /config → Tax */}
      <div className="mb-4">
        <SettingsLinkBanner
          message="Related settings also live in Config → Tax."
          href="/config?tab=tax"
          linkLabel="Open Config → Tax"
          testId="tax-settings-config-link"
        />
      </div>

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
        <LastUpdatedLabel
          {...formatUpdatedMeta(meta[KEYS.ENABLED])}
          testId="last-updated-sales_tax_enabled"
        />

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
          <LastUpdatedLabel
            {...formatUpdatedMeta(meta[KEYS.RATE])}
            testId="last-updated-default_sales_tax_rate"
          />
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
        <LastUpdatedLabel
          {...formatUpdatedMeta(meta[KEYS.SUB_TAX])}
          testId="last-updated-subscription_fee_taxable"
        />

        <label className="flex flex-col text-sm">
          Remittance jurisdiction
          <input
            type="text"
            value={state.jurisdiction}
            onChange={(e) => setState({ ...state, jurisdiction: e.target.value })}
            className="border rounded px-2 py-1 w-32"
            data-testid="tax-jurisdiction"
          />
          <LastUpdatedLabel
            {...formatUpdatedMeta(meta[KEYS.JUR])}
            testId="last-updated-tax_remittance_jurisdiction"
          />
        </label>

        {/* tax-category-rules: include_fee_in_tax_base toggle */}
        <div className="border-t pt-4 mt-2">
          <h2 className="text-sm font-semibold text-gray-800 mb-2">
            Marketplace Fee Tax Base
          </h2>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.includeFeeInTaxBase}
              onChange={(e) =>
                setState({ ...state, includeFeeInTaxBase: e.target.checked })
              }
              data-testid="tax-fee-in-base-toggle"
            />
            <span>Include marketplace transaction fee in sales-tax base</span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-6">
            When enabled, the mandatory buyer platform fee ($0.99 / $2.99) is
            included in the taxable amount. This is a prospective-only setting —
            historical trades retain their original tax snapshot. Review CPA guidance
            before enabling.
          </p>
          <div className="mt-2">
            <LastUpdatedLabel
              {...formatUpdatedMeta(meta[KEYS.FEE_IN_BASE])}
              testId="last-updated-include_fee_in_tax_base"
            />
          </div>
        </div>

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
