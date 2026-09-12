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

/** Wire data_type per key — used when writing through upsert_admin_config_setting. */
const DATA_TYPE_BY_KEY: Record<string, string> = {
  [KEYS.ENABLED]: 'boolean',
  [KEYS.RATE]: 'number',
  [KEYS.SUB_TAX]: 'boolean',
  [KEYS.JUR]: 'string',
  [KEYS.FEE_IN_BASE]: 'boolean',
};

/**
 * FIX-Task-20 item 0: values are normalized into the SAME form that gets persisted,
 * so the save path can diff "what the admin sees" against "what the DB holds" and
 * write ONLY the keys that actually changed. Rate is compared as the stored decimal
 * fraction (0.0635), not the percent string in the input (6.35).
 */
function normalizeConfig(state: State): Record<string, string> {
  const pct = parseFloat(state.ratePercent);
  return {
    [KEYS.ENABLED]: String(state.enabled),
    [KEYS.RATE]: Number.isNaN(pct) ? '' : (pct / 100).toFixed(4),
    [KEYS.SUB_TAX]: String(state.subscriptionTaxable),
    [KEYS.JUR]: (state.jurisdiction ?? '').trim(),
    [KEYS.FEE_IN_BASE]: String(state.includeFeeInTaxBase),
  };
}

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
  // FIX-Task-20 item 0: the snapshot the diff is computed against. `null` means
  // "not loaded yet" — never treat that as "everything is false".
  const [baseline, setBaseline] = useState<State | null>(null);
  // Keys the read RPC did not return. Saving while this is non-empty could
  // overwrite them with wrong values, so Save is blocked instead.
  const [unresolvedKeys, setUnresolvedKeys] = useState<string[]>([]);
  // Explicit confirmation gate for turning the platform-wide switch OFF.
  const [confirmDisableOpen, setConfirmDisableOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    // A fresh read supersedes any stale error (e.g. a previous partial read).
    setErr(null);
    // Use SECURITY DEFINER RPC to bypass RLS on admin_config
    const { data, error } = await supabase.rpc('fn_get_admin_config_values', {
      p_keys: Object.values(KEYS),
    });
    setLoading(false);
    if (error) {
      // Never surface a raw fetch/PostgREST message to an admin (FIX-Task-20 copy
      // standard). Saving is already blocked while the read is unresolved.
      console.error('[TaxSettings] load failed:', error);
      setErr(
        "We couldn't load the current tax settings. Reload this page to try again — saving is disabled until the values load."
      );
      return;
    }
    const map = new Map<string, string>();
    (data ?? []).forEach((r: any) => map.set(r.out_key, r.out_value));

    // FIX-Task-20 item 0 (root cause 2): a key the RPC did NOT return must never be
    // silently coerced to `false`/`0`. That coercion is exactly how an admin editing
    // an unrelated field could persist `sales_tax_enabled = false` — the form showed
    // OFF for a setting that was actually ON, and Save wrote the whole form back.
    // Instead: record the gap, warn, and block saving until a clean read happens.
    const missing = Object.values(KEYS).filter((k) => !map.has(k));
    setUnresolvedKeys(missing);
    if (missing.length > 0) {
      setErr(
        `Could not read ${missing.length} of ${Object.values(KEYS).length} tax settings (${missing.join(
          ', '
        )}). Reload this page before saving — saving now could overwrite them with the wrong values.`
      );
    }

    const rateFraction = parseFloat(map.get(KEYS.RATE) ?? '0') || 0;
    const next: State = {
      enabled: (map.get(KEYS.ENABLED) ?? 'false') === 'true',
      ratePercent: (rateFraction * 100).toFixed(2),
      subscriptionTaxable: (map.get(KEYS.SUB_TAX) ?? 'false') === 'true',
      jurisdiction: map.get(KEYS.JUR) ?? 'CT',
      includeFeeInTaxBase: (map.get(KEYS.FEE_IN_BASE) ?? 'false') === 'true',
    };
    setState(next);
    // The loaded values become the diff baseline (see changedKeys below).
    setBaseline(next);
    // Same "Last updated" metadata the /config hub shows for these keys.
    const metaRows = await getAdminConfigMeta(supabase, Object.values(KEYS));
    // getAdminConfigMeta swallows its own errors (returns {} on failure), so only
    // replace the provenance when we actually got rows back.
    if (Object.keys(metaRows).length > 0) setMeta(metaRows);
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // FIX-Task-20 item 0: which keys actually differ from what was loaded. Derived (not
  // stored) so the diff can never drift from the form values the admin is looking at.
  const changedKeys = useMemo(() => {
    if (!baseline) return [] as string[];
    const base = normalizeConfig(baseline);
    const current = normalizeConfig(state);
    return Object.values(KEYS).filter((k) => current[k] !== base[k]);
  }, [baseline, state]);

  const killSwitchWillDisable = !!baseline && baseline.enabled && !state.enabled;
  const canSave = !saving && unresolvedKeys.length === 0;

  /**
   * Writes ONLY the supplied keys. Nothing else on the page is touched, so an admin
   * editing the rate can no longer persist an unrelated (possibly stale) kill-switch
   * value. Mode of `keysToWrite` defaults to the computed diff.
   */
  const persistChanges = async (keysToWrite: string[] = changedKeys) => {
    setSaving(true);
    try {
      // Record the acting admin so admin_config.updated_by is set — the same
      // audit source the /config hub uses.
      const adminId = await getCurrentAdminId(supabase);
      const current = normalizeConfig(state);
      for (const key of keysToWrite) {
        const { error } = await supabase.rpc('upsert_admin_config_setting', {
          p_key: key,
          p_value: current[key],
          p_category: 'tax',
          p_data_type: DATA_TYPE_BY_KEY[key] ?? 'string',
          p_is_secret: false,
          p_is_active: true,
          p_admin_id: adminId ?? null,
        });
        if (error) throw error;
      }
      // best-effort audit — records only the keys that were actually written
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) {
        const previous = baseline ? normalizeConfig(baseline) : {};
        await supabase.from('admin_audit_log').insert({
          admin_id: user.id,
          action: 'update_tax_settings',
          entity_type: 'admin_config',
          changes: {
            changed_keys: keysToWrite,
            before: Object.fromEntries(keysToWrite.map((k) => [k, previous[k] ?? null])),
            after: Object.fromEntries(keysToWrite.map((k) => [k, current[k]])),
          },
        });
      }
      setMsg(
        `Saved ${keysToWrite.length} ${keysToWrite.length === 1 ? 'setting' : 'settings'}: ${keysToWrite.join(
          ', '
        )}.`
      );
      setTimeout(() => setMsg(null), 6000);
      // FIX-Task-20 item 14: refresh the per-key provenance so a flip is visible
      // immediately, and re-baseline so the dirty diff resets correctly.
      const metaRows = await getAdminConfigMeta(supabase, Object.values(KEYS));
      // A failed refresh (CORS/network) must not wipe labels that were already
      // correct — getAdminConfigMeta returns {} on error.
      if (Object.keys(metaRows).length > 0) setMeta(metaRows);
      setBaseline(state);
    } catch (e: any) {
      setErr(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    setErr(null);
    setMsg(null);
    const pct = parseFloat(state.ratePercent);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      setErr('Default tax rate must be a percent between 0 and 100.');
      return;
    }
    if (unresolvedKeys.length > 0) {
      setErr('Reload this page before saving — some current tax settings could not be read.');
      return;
    }
    if (changedKeys.length === 0) {
      setMsg('No changes to save.');
      setTimeout(() => setMsg(null), 4000);
      return;
    }
    // FIX-Task-20 item 0: disabling tax platform-wide is the single most dangerous
    // edit on this page, so it gets its own explicit confirmation step.
    if (killSwitchWillDisable) {
      setConfirmDisableOpen(true);
      return;
    }
    await persistChanges();
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

      {/* TAX-009: Warning banner when global tax is disabled.
          FIX-Task-21 item 3 (QA finding N5): this banner rendered applied-tense copy
          ("Sales tax is currently OFF") straight from PENDING form state, so simply
          un-ticking the switch claimed tax was already off while the platform was
          still collecting it. Only the loaded baseline says what is actually in force:
            · baseline ON  + form OFF => pending  (will be turned off on save)
            · baseline OFF            => applied  (is currently OFF)
          The `tax-disabled-warning` test id is kept on both variants so the existing
          banner assertions still find it, and the applied-tense sentence returns as
          soon as the change is saved (persistChanges re-baselines the form). */}
      {!state.enabled && (
        <div
          className="flex items-center gap-2 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded p-3 mb-4"
          data-testid="tax-disabled-warning"
        >
          <span className="text-lg">⚠️</span>
          <span className="text-sm">
            {baseline?.enabled ? (
              <>
                <strong>Sales tax will be turned OFF on save.</strong> Tax is still being
                applied to new offers and checkouts until you press Save Settings.
              </>
            ) : (
              <>
                <strong>Sales tax is currently OFF.</strong> No tax will be applied to any
                transactions across all nodes until you enable it and save.
              </>
            )}
          </span>
        </div>
      )}

      {err && (
        <div className="text-red-600 mb-3" data-testid="tax-settings-error">
          {err}
        </div>
      )}
      {msg && (
        <div className="text-green-600 mb-3" data-testid="tax-settings-message">
          {msg}
        </div>
      )}

      <div className="space-y-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={state.enabled}
            onChange={(e) => setState({ ...state, enabled: e.target.checked })}
            data-testid="tax-enabled-toggle"
          />
          <span>Enable sales tax globally</span>
          {/* FIX-Task-20 item 14: make a pending flip self-evident at a glance. */}
          {!!baseline && baseline.enabled !== state.enabled && (
            <span
              className="text-xs font-medium text-red-600"
              data-testid="tax-enabled-pending-change"
            >
              will change on save
            </span>
          )}
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

        {/* FIX-Task-20 item 0: show exactly what will be written before the admin commits. */}
        {unresolvedKeys.length > 0 && (
          <p className="text-xs text-red-600" data-testid="tax-settings-unresolved">
            Could not read: {unresolvedKeys.join(', ')} — reload before saving.
          </p>
        )}
        {changedKeys.length > 0 && (
          <p className="text-xs text-gray-600" data-testid="tax-settings-dirty-count">
            Unsaved changes ({changedKeys.length}): {changedKeys.join(', ')}
          </p>
        )}

        <button
          onClick={save}
          disabled={!canSave}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          data-testid="tax-settings-save"
        >
          {/* FIX-Task-21 item 7: put the blast radius ON the button, not only in the
              line above it — "Save 1 change" is visible even if the dirty-count line
              scrolls out of view. Label still contains "Save" so existing locators work. */}
          {saving
            ? 'Saving…'
            : changedKeys.length > 0
              ? `Save ${changedKeys.length} ${changedKeys.length === 1 ? 'change' : 'changes'}`
              : 'Save Settings'}
        </button>
      </div>

      {/* FIX-Task-20 item 0: separate, explicit confirmation before tax collection is
          switched off platform-wide. Cancel aborts the entire save (no partial write). */}
      {confirmDisableOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div
            className="bg-white rounded shadow-lg max-w-md w-full p-5"
            data-testid="tax-killswitch-confirm-modal"
          >
            <h2 className="text-lg font-semibold text-red-700 mb-2">
              Turn off sales tax for the whole platform?
            </h2>
            <p className="text-sm text-gray-700 mb-3">
              This stops tax collection <strong>on every node</strong> for every new offer
              and checkout, until you turn it back on. Buyers will be charged{' '}
              <strong>$0.00 tax</strong> on new orders. Trades that already exist keep the
              tax they were created with.
            </p>
            {changedKeys.filter((k) => k !== KEYS.ENABLED).length > 0 && (
              <p className="text-sm text-gray-700 mb-3">
                Your other pending change
                {changedKeys.filter((k) => k !== KEYS.ENABLED).length === 1 ? '' : 's'} (
                {changedKeys.filter((k) => k !== KEYS.ENABLED).join(', ')}) will be saved at
                the same time.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  // The label is "Keep tax on", so abandoning the confirmation must also
                  // abandon the pending kill-switch change — otherwise the form keeps
                  // showing OFF while the platform is still ON. Any OTHER pending edits
                  // stay dirty and can still be saved.
                  setState((prev) => ({ ...prev, enabled: baseline?.enabled ?? prev.enabled }));
                  setConfirmDisableOpen(false);
                  setMsg('Sales tax was left ON. No changes were saved.');
                  setTimeout(() => setMsg(null), 6000);
                }}
                className="px-3 py-2 rounded border text-sm"
                data-testid="tax-killswitch-confirm-cancel"
              >
                Keep tax on
              </button>
              <button
                onClick={async () => {
                  setConfirmDisableOpen(false);
                  await persistChanges(changedKeys);
                }}
                disabled={saving}
                className="px-3 py-2 rounded bg-red-600 text-white text-sm disabled:opacity-50"
                data-testid="tax-killswitch-confirm-accept"
              >
                Turn off sales tax
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
