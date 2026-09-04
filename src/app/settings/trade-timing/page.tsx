'use client';

// filepath: p2p-kids-admin/src/app/settings/trade-timing/page.tsx
// TFV2-001: Admin UI for trade timing configuration
// Reads/writes the TradeTimingConfig keys this page manages (timing windows,
// pickup & payout, cancel-request escalation, SP release, and the consolidated
// fee params). Shared validation lives in src/lib/tradeTimingValidation.ts and
// is imported by BOTH this page and its mirror test (Dev Task 91 — restores the
// F03/F05/F06/F08/F10 sections that drifted off this page).

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { TradeTimingConfig } from '@/types/config';
import {
  getAdminConfigMeta,
  formatUpdatedMeta,
  type AdminConfigMetaRow,
} from '@/lib/settingsAudit';
import { validateTradeTimingSettings } from '@/lib/tradeTimingValidation';
import SettingsLinkBanner from '@/components/settings/SettingsLinkBanner';
import LastUpdatedLabel from '@/components/settings/LastUpdatedLabel';

// Keys this page manages (renders + reads/writes). Legacy fee keys are loaded +
// surfaced read-only (audit) and excluded from save writes (F10).
type ManagedTradeTimingKey =
  | 'offer_timeout_hours'
  | 'offer_notif_1_hours_before'
  | 'offer_notif_2_hours_before'
  | 'auto_complete_hours'
  | 'auto_complete_notif_1_hours_before'
  | 'auto_complete_notif_2_hours_before'
  | 'pending_sp_release_days'
  | 'transaction_fee_subscriber_cents'
  | 'transaction_fee_non_subscriber_cents'
  | 'max_pending_offers_per_seller'
  | 'cancel_request_escalation_enabled'
  | 'cancel_request_response_timeout_hours'
  // N1/R2 — pickup countdown + payout buffer + pickup reminders (F05/F06)
  | 'pickup_window_hours'
  | 'pickup_notif_1_hours_before'
  | 'pickup_notif_2_hours_before'
  | 'payout_buffer_days'
  // Fee params consolidated from /config → FEES (single fee surface, F03)
  | 'platform_fee_seller_percentage'
  | 'platform_fee_seller_discount_percentage_kids_club_plus'
  | 'platform_fee_buyer_fixed_cents'
  | 'platform_fee_buyer_percentage'
  | 'charge_one_fee_per_bundle'
  // R1 — tiered buyer-fee engine (F08)
  | 'buyer_fee_active_member_cents'
  | 'buyer_fee_first_trade_cents'
  | 'buyer_fee_subsequent_percentage'
  | 'buyer_fee_subsequent_fixed_cents'
  | 'buyer_fee_subsequent_max_cents'
  | 'buyer_fee_label'
  // Legacy fee keys (audit only, read-only — F10)
  | 'transaction_fee_member_cents'
  | 'transaction_fee_non_member_cents'
  | 'platform_fee_seller_discount_percentage_freemium';

// Boolean keys (rendered by boolField) vs. the string key (buyer_fee_label,
// rendered by textField) vs. number keys (rendered by numField), so the
// settings state stays fully typed.
type ManagedTradeTimingBooleanKey =
  | 'cancel_request_escalation_enabled'
  | 'charge_one_fee_per_bundle';
type ManagedTradeTimingStringKey = 'buyer_fee_label';
type ManagedTradeTimingNumberKey = Exclude<
  ManagedTradeTimingKey,
  ManagedTradeTimingBooleanKey | ManagedTradeTimingStringKey
>;

// Legacy fee keys surfaced read-only for audit (F10). Loaded + displayed, but
// never written on Save (the current checkout does not read them).
const LEGACY_READ_ONLY_KEYS: ReadonlySet<string> = new Set([
  'transaction_fee_member_cents',
  'transaction_fee_non_member_cents',
  'platform_fee_seller_discount_percentage_freemium',
]);

// Key → canonical admin_config category (single-source with /config tabs).
// Unlisted keys fall back to 'feature_flags' (behavior-preserving — they were
// seeded/edited under that bucket). Restored keys use their seed categories.
const CONFIG_CATEGORIES: Record<string, string> = {
  pickup_window_hours: 'trade',
  pickup_notif_1_hours_before: 'trade',
  pickup_notif_2_hours_before: 'trade',
  payout_buffer_days: 'fees',
  platform_fee_buyer_fixed_cents: 'fees',
  platform_fee_buyer_percentage: 'fees',
  charge_one_fee_per_bundle: 'fees',
  buyer_fee_active_member_cents: 'fees',
  buyer_fee_first_trade_cents: 'fees',
  buyer_fee_subsequent_percentage: 'fees',
  buyer_fee_subsequent_fixed_cents: 'fees',
  buyer_fee_subsequent_max_cents: 'fees',
  buyer_fee_label: 'fees',
  transaction_fee_member_cents: 'fees',
  transaction_fee_non_member_cents: 'fees',
  platform_fee_seller_discount_percentage_freemium: 'fees',
};

const DEFAULT_CONFIG: Pick<TradeTimingConfig, ManagedTradeTimingKey> = {
  offer_timeout_hours: 48,
  offer_notif_1_hours_before: 24,
  offer_notif_2_hours_before: 6,
  auto_complete_hours: 72,
  auto_complete_notif_1_hours_before: 24,
  auto_complete_notif_2_hours_before: 2,
  pending_sp_release_days: 3,
  transaction_fee_subscriber_cents: 150,
  transaction_fee_non_subscriber_cents: 250,
  max_pending_offers_per_seller: 3,
  // Cancel-request defaults (BP-13: link to the seed in
  // 20260901000000_cancel_request_flow.sql — 48h / enabled).
  cancel_request_escalation_enabled: true,
  cancel_request_response_timeout_hours: 48,
  // N1/R2 (20260809000004 / 20260810000001 seeds): 72 / 24 / 2 / 2.
  pickup_window_hours: 72,
  pickup_notif_1_hours_before: 24,
  pickup_notif_2_hours_before: 2,
  payout_buffer_days: 2,
  // Fee params (20250113 + 316 seeds): seller free=5/KCP=0, buyer fixed=25/2.5%,
  // bundle-fee OFF.
  platform_fee_seller_percentage: 5,
  platform_fee_seller_discount_percentage_kids_club_plus: 0,
  platform_fee_buyer_fixed_cents: 25,
  platform_fee_buyer_percentage: 2.5,
  charge_one_fee_per_bundle: false,
  // R1 tiered buyer-fee engine (20260810000009 seeds): 149 / 149 / 5.0 / 199 /
  // 499 / label.
  buyer_fee_active_member_cents: 149,
  buyer_fee_first_trade_cents: 149,
  buyer_fee_subsequent_percentage: 5.0,
  buyer_fee_subsequent_fixed_cents: 199,
  buyer_fee_subsequent_max_cents: 499,
  buyer_fee_label: 'Safety & Platform Fee',
  // Legacy audit-only (20260528 / 20250113 seeds): 99 / 299 / 0.
  transaction_fee_member_cents: 99,
  transaction_fee_non_member_cents: 299,
  platform_fee_seller_discount_percentage_freemium: 0,
};

export default function TradeTimingSettingsPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const [settings, setSettings] = useState<Pick<TradeTimingConfig, ManagedTradeTimingKey>>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);
  // Last-updated metadata per key (admin_config.updated_at + updated_by).
  const [meta, setMeta] = useState<Record<string, AdminConfigMetaRow>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // Use SECURITY DEFINER RPC to bypass RLS on admin_config
      const { data, error } = await supabase.rpc('fn_get_admin_config_values', {
        p_keys: Object.keys(DEFAULT_CONFIG),
      });

      if (error) throw error;

      const parsed: Partial<TradeTimingConfig> = {};
      data?.forEach(
        (row: { out_key: string; out_value: string; out_data_type?: string }) => {
          if (!(row.out_key in DEFAULT_CONFIG)) return;
          // Values come back as TEXT regardless of admin_config.data_type.
          // Re-hydrate by the stored data_type so booleans ('true'/'false'),
          // strings (buyer_fee_label) and numbers all land correctly.
          if (row.out_data_type === 'boolean') {
            (parsed as Record<string, unknown>)[row.out_key] =
              row.out_value === 'true';
          } else if (row.out_data_type === 'string') {
            (parsed as Record<string, string>)[row.out_key] = row.out_value;
          } else if (!isNaN(Number(row.out_value))) {
            (parsed as Record<string, number>)[row.out_key] =
              Number(row.out_value);
          }
        }
      );

      setSettings((prev) => ({ ...prev, ...parsed }));

      // Same "Last updated" metadata the /config hub shows for these keys.
      const metaRows = await getAdminConfigMeta(
        supabase,
        Object.keys(DEFAULT_CONFIG)
      );
      setMeta(metaRows);
    } catch (err: any) {
      console.error('[TradeTimingSettings] load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const validateSettings = (): boolean => {
    // Shared validator — single source of truth shared with the mirror test
    // (src/lib/tradeTimingValidation.ts). Covers offer/auto-complete ordering,
    // fee params, pickup window + reminders, the R2 ≤167h guardrail, payout
    // buffer, and the cancel-request timeout.
    const e = validateTradeTimingSettings(settings);

    // max_pending_offers_per_seller is page-managed but has no mirror-test rule
    // (kept local to where it renders).
    if (settings.max_pending_offers_per_seller < 1) {
      e.max_pending_offers_per_seller = 'Must be at least 1';
    }
    if (settings.max_pending_offers_per_seller > 10) {
      e.max_pending_offers_per_seller = 'Maximum is 10 offers per seller';
    }

    // R1 — Tiered Buyer-Fee Engine (page-only; no mirror-test rule).
    if (settings.buyer_fee_active_member_cents < 0) {
      e.buyer_fee_active_member_cents = 'Cannot be negative';
    }
    if (settings.buyer_fee_first_trade_cents < 0) {
      e.buyer_fee_first_trade_cents = 'Cannot be negative';
    }
    if (
      settings.buyer_fee_subsequent_percentage < 0 ||
      settings.buyer_fee_subsequent_percentage > 100
    ) {
      e.buyer_fee_subsequent_percentage = 'Must be between 0 and 100';
    }
    if (settings.buyer_fee_subsequent_fixed_cents < 0) {
      e.buyer_fee_subsequent_fixed_cents = 'Cannot be negative';
    }
    if (
      settings.buyer_fee_subsequent_max_cents <
      settings.buyer_fee_subsequent_fixed_cents
    ) {
      e.buyer_fee_subsequent_max_cents = 'Must be at least the fixed fee';
    }
    if (settings.buyer_fee_label.trim() === '') {
      e.buyer_fee_label = 'Cannot be empty';
    }

    // Legacy fee keys are read-only audit fields — never validated/blocking.
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validateSettings()) return;

    setSaving(true);
    setSuccess(null);

    try {
      // Record the acting admin so admin_config.updated_by is set — the same
      // audit source the /config hub uses.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const adminId = user?.id ?? null;

      // Build the write list from the editable settings. Legacy fee keys are
      // read-only audit fields — excluded so Save never touches them (F10).
      // data_type mirrors what admin_config stores (boolean/string/number).
      const booleanKeys: ReadonlySet<string> = new Set([
        'cancel_request_escalation_enabled',
        'charge_one_fee_per_bundle',
      ]);
      const stringKeys: ReadonlySet<string> = new Set(['buyer_fee_label']);

      const writes: Array<{
        key: string;
        value: string;
        data_type: string;
        category: string;
      }> = Object.entries(settings)
        .filter(([key]) => !LEGACY_READ_ONLY_KEYS.has(key))
        .map(([key, value]) => ({
          key,
          value: String(value),
          data_type: booleanKeys.has(key)
            ? 'boolean'
            : stringKeys.has(key)
              ? 'string'
              : 'number',
          category: CONFIG_CATEGORIES[key] ?? 'feature_flags',
        }));

      // DEV-TASK-106: single transactional batch call. The old per-key loop
      // validated each key against the *stored* paired value (order-dependent
      // R2 guardrail — e.g. offer 48→100 + pickup 72→67 in one Save failed).
      // The batch RPC validates the intended FINAL state once and writes
      // everything atomically, so a valid save succeeds and a genuinely
      // invalid final state is still hard-blocked server-side.
      const { error } = await supabase.rpc('upsert_admin_config_settings_batch', {
        p_items: writes.map((w) => ({
          key: w.key,
          value: w.value,
          category: w.category,
          data_type: w.data_type,
          is_secret: false,
          is_active: true,
        })),
        p_admin_id: adminId,
      });
      if (error) throw error;

      // Audit log
      if (adminId) {
        await supabase.from('admin_audit_log').insert({
          admin_id: adminId,
          action: 'update_trade_timing_settings',
          entity_type: 'admin_config',
          changes: settings,
        });
      }

      setSuccess('Trade timing settings saved successfully!');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error('[TradeTimingSettings] save error:', err);
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const numField = (
    key: ManagedTradeTimingNumberKey,
    label: string,
    description: string,
    unit: string,
    min = 1,
    max?: number
  ) => (
    <div key={key} className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="flex items-center gap-3">
        <input
          type="number"
          value={settings[key]}
          onChange={(e) =>
            setSettings((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }))
          }
          className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          min={min}
          max={max}
          disabled={saving}
          data-testid={`input-${key}`}
        />
        <span className="text-sm text-gray-500">{unit}</span>
      </div>
      <p className="text-xs text-gray-500">{description}</p>
      {errors[key] && (
        <p className="text-xs text-red-600" data-testid={`error-${key}`}>
          {errors[key]}
        </p>
      )}
      <LastUpdatedLabel
        {...formatUpdatedMeta(meta[key as string])}
        testId={`last-updated-${key}`}
      />
    </div>
  );

  const boolField = (
    key: ManagedTradeTimingBooleanKey,
    label: string,
    description: string
  ) => (
    <div key={key} className="space-y-1">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <input
          type="checkbox"
          checked={settings[key]}
          onChange={(e) =>
            setSettings((prev) => ({ ...prev, [key]: e.target.checked }))
          }
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
          disabled={saving}
          data-testid={`input-${key}`}
        />
        {label}
      </label>
      <p className="text-xs text-gray-500 pl-6">{description}</p>
      {errors[key] && (
        <p className="text-xs text-red-600 pl-6" data-testid={`error-${key}`}>
          {errors[key]}
        </p>
      )}
      <div className="pl-6">
        <LastUpdatedLabel
          {...formatUpdatedMeta(meta[key])}
          testId={`last-updated-${key}`}
        />
      </div>
    </div>
  );

  // Text field for string-valued admin_config keys (e.g. buyer_fee_label).
  const textField = (
    key: ManagedTradeTimingStringKey,
    label: string,
    description: string
  ) => (
    <div key={key} className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label} <span className="text-red-500">*</span>
      </label>
      <input
        type="text"
        value={String(settings[key] ?? '')}
        onChange={(e) =>
          setSettings((prev) => ({ ...prev, [key]: e.target.value }))
        }
        className="w-72 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        disabled={saving}
        data-testid={`input-${key}`}
      />
      <p className="text-xs text-gray-500">{description}</p>
      {errors[key] && (
        <p className="text-xs text-red-600" data-testid={`error-${key}`}>
          {errors[key]}
        </p>
      )}
      <LastUpdatedLabel
        {...formatUpdatedMeta(meta[key])}
        testId={`last-updated-${key}`}
      />
    </div>
  );

  // Read-only display for legacy fee keys (F10) — audit surface, not editable.
  const readOnlyField = (
    key: ManagedTradeTimingNumberKey,
    label: string,
    description: string,
    unit: string
  ) => (
    <div key={key} className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label} <span className="text-gray-400 font-normal">(read-only)</span>
      </label>
      <div className="flex items-center gap-3">
        <input
          type="number"
          value={settings[key]}
          disabled
          className="w-36 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500"
          data-testid={`readonly-${key}`}
        />
        <span className="text-sm text-gray-500">{unit}</span>
      </div>
      <p className="text-xs text-gray-500">{description}</p>
      <LastUpdatedLabel
        {...formatUpdatedMeta(meta[key as string])}
        testId={`last-updated-${key}`}
      />
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">Loading trade timing settings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Trade Timing Settings</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Configure offer expiry, pickup &amp; payout timing, auto-complete, buyer cancel-request escalation, SP release schedules, and transaction fees.
        </p>
      </div>

      {/* Cross-link: these settings share the same admin_config rows as /config */}
      <div className="mb-6">
        <SettingsLinkBanner
          message="Related settings also live in Config → Trade / Feature Flags."
          href="/config?tab=trade"
          linkLabel="Open Config → Trade"
          testId="trade-timing-config-link"
        />
      </div>

      {success && (
        <div
          className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6"
          data-testid="success-banner"
        >
          <p className="text-green-800 text-sm font-medium">{success}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Offer Expiry */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-3">
            Offer Expiry
          </h2>
          {numField(
            'offer_timeout_hours',
            'Offer Timeout',
            'Hours before an unanswered offer auto-declines.',
            'hours'
          )}
          {numField(
            'offer_notif_1_hours_before',
            'First Expiry Reminder',
            'Send first reminder this many hours before offer expires (must be < timeout).',
            'hours before expiry'
          )}
          {numField(
            'offer_notif_2_hours_before',
            'Second Expiry Reminder',
            'Send second reminder before offer expires (must be < first reminder).',
            'hours before expiry'
          )}
        </section>

        {/* Offer Limits */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-3">
            Offer Limits
          </h2>
          {numField(
            'max_pending_offers_per_seller',
            'Max Offers Per Seller',
            'Maximum number of open (pending) offers a buyer can have with a single seller. Bundle offers count as 1. Applies immediately — no app restart needed.',
            'offers'
          )}
        </section>

        {/* Auto-Complete */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-3">
            Auto-Complete
          </h2>
          {numField(
            'auto_complete_hours',
            'Auto-Complete Window',
            'Hours after trade enters in_progress before it auto-completes.',
            'hours'
          )}
          {numField(
            'auto_complete_notif_1_hours_before',
            'First Auto-Complete Reminder',
            'Send first reminder this many hours before auto-complete fires (must be < window).',
            'hours before auto-complete'
          )}
          {numField(
            'auto_complete_notif_2_hours_before',
            'Final Auto-Complete Reminder',
            'Send final reminder before auto-complete fires (must be < first reminder).',
            'hours before auto-complete'
          )}
        </section>

        {/* Pickup & Payout — N1 Configurability + R2 guardrail (F05/F06) */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-3">
            Pickup &amp; Payout
          </h2>
          {numField(
            'pickup_window_hours',
            'Pickup Window',
            'Hours a buyer has to confirm pickup/meetup once a trade is ready (1–168). Drives the post-acceptance auto-complete deadline (R2). Combined with the offer window it must stay under 168h (Stripe’s 7-day authorization limit).',
            'hours',
            1,
            168
          )}
          {numField(
            'pickup_notif_1_hours_before',
            'First Pickup Reminder',
            'Send the first reminder to the buyer this many hours before the pickup window ends (must be < pickup window).',
            'hours before deadline'
          )}
          {numField(
            'pickup_notif_2_hours_before',
            'Final Pickup Reminder',
            'Send the final reminder to the buyer before the pickup window ends (must be < first reminder).',
            'hours before deadline'
          )}
          {numField(
            'payout_buffer_days',
            'Payout Buffer',
            'Days a completed trade payout sits as a buffer before release to the seller (0 = immediate, max 30).',
            'days',
            0,
            30
          )}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-xs text-blue-800">
              R2 guardrail: Offer Timeout + Pickup Window must total under 168h
              (Stripe’s 7-day authorization limit). The UI hard-blocks a save
              that exceeds it — lower one window.
            </p>
          </div>
        </section>

        {/* Buyer Cancel Requests */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-3">
            Buyer Cancel Requests
          </h2>
          {boolField(
            'cancel_request_escalation_enabled',
            'Escalate to Admin',
            'When enabled, a seller decline — or no response within the timeout — sends the buyer’s cancellation request to the admin Action Center for review. When disabled, a declined request simply ends with the trade continuing (no admin review).'
          )}
          {numField(
            'cancel_request_response_timeout_hours',
            'Response Timeout',
            'Hours a seller has to respond to a buyer’s cancellation request before it auto-escalates to admin (validated 1–336).',
            'hours',
            1,
            336
          )}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-xs text-blue-800">
              These control buyer-initiated cancellation requests on in-progress
              trades (single-item and bundles). Changes take effect immediately —
              the app reads them from admin_config on each request/response.
            </p>
          </div>
        </section>

        {/* Swap Points */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-3">
            Swap Points
          </h2>
          {numField(
            'pending_sp_release_days',
            'SP Pending Release',
            'Days earned SP remains pending before being released to available balance.',
            'days'
          )}
        </section>

        {/* Transaction Fees */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-3">
            Transaction Fees
          </h2>
          {numField(
            'transaction_fee_subscriber_cents',
            'Kids Club+ Member Fee',
            'Platform fee for Kids Club+ subscribers in cents (e.g. 150 = $1.50).',
            'cents',
            0
          )}
          {numField(
            'transaction_fee_non_subscriber_cents',
            'Free-Tier User Fee',
            'Platform fee for free-tier users in cents (e.g. 250 = $2.50).',
            'cents',
            0
          )}
          <div className="border-t border-gray-100 pt-4 space-y-5">
            <h3 className="text-sm font-semibold text-gray-800">
              Seller &amp; Buyer Platform Fees
            </h3>
            {numField(
              'platform_fee_seller_percentage',
              'Seller Fee % — Free Tier',
              'Seller platform fee for FREE (non-subscriber) sellers, as a % of the cash portion (item price − SP). Example: 5 = 5% (default).',
              '%',
              0,
              100
            )}
            {numField(
              'platform_fee_seller_discount_percentage_kids_club_plus',
              'Seller Fee % — Kids Club+',
              'Seller platform fee for Kids Club+ (subscriber) sellers, as an ABSOLUTE % of the cash portion (item price − SP). This is the rate itself, not a discount.',
              '%',
              0,
              100
            )}
            {numField(
              'platform_fee_buyer_fixed_cents',
              'Buyer Platform Fee — Fixed',
              'Fixed buyer platform fee in cents (e.g. 25 = $0.25). Applies to each trade; shown in the buyer fee preview.',
              'cents',
              0
            )}
            {numField(
              'platform_fee_buyer_percentage',
              'Buyer Platform Fee %',
              'Buyer platform fee as a % of item price (e.g. 2.5 = 2.5%). Shown in the buyer fee preview.',
              '%',
              0,
              100
            )}
            {boolField(
              'charge_one_fee_per_bundle',
              'Charge One Fee Per Bundle',
              'When enabled, a bundle charges the platform fee once instead of per item. Single-item trades are unaffected. Applies to both free-tier and subscriber fixed fees.'
            )}
          </div>
          <div className="border-t border-gray-100 pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800">
              Tiered Buyer Fee — R1 (first-trade protection)
            </h3>
            <p className="text-xs text-gray-500">
              Resolved at checkout by buyer fee-tier: active members and free
              users on their first trade pay a flat fee; free users with 1+
              completed trades pay a percentage of the cash portion + a fixed
              fee, capped at the maximum. Swap Points never reduce the fee base.
              All values are dynamic — changes apply to new checkouts
              immediately.
            </p>
            {numField(
              'buyer_fee_active_member_cents',
              'Flat Fee — Active Members',
              'Flat fee (cents) for active members (trial or paid). Example: 149 = $1.49.',
              'cents',
              0
            )}
            {numField(
              'buyer_fee_first_trade_cents',
              'Flat Fee — First Trade',
              'Flat fee (cents) for free users on their first trade. Consumed only when the trade is successfully captured and completed.',
              'cents',
              0
            )}
            {numField(
              'buyer_fee_subsequent_percentage',
              'Percentage — Free users (1+ completed trades)',
              'Percentage of the cash portion (order total minus Swap Points) for free users with 1+ completed trades. Example: 5 = 5%.',
              '%',
              0,
              100
            )}
            {numField(
              'buyer_fee_subsequent_fixed_cents',
              'Fixed Fee — Free users (1+ completed trades)',
              'Fixed fee component (cents) for free users with 1+ completed trades. Example: 199 = $1.99.',
              'cents',
              0
            )}
            {numField(
              'buyer_fee_subsequent_max_cents',
              'Maximum Total Fee (cap)',
              'Cap (cents) on the TOTAL fee (fixed + percentage) for free users with 1+ completed trades. Must be ≥ fixed fee. Example: 499 = $4.99.',
              'cents',
              0
            )}
            {textField(
              'buyer_fee_label',
              'Fee Display Label',
              'Label shown to buyers on checkout / order summary (e.g. "Safety & Platform Fee").'
            )}
          </div>
          <div className="border-t border-gray-100 pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800">
              Legacy fee keys (audit only)
            </h3>
            <p className="text-xs text-gray-500">
              These keys were seeded under the old naming scheme and are NOT
              read by the current checkout. Surfaced here read-only for audit —
              changes have no effect on live trades.
            </p>
            {readOnlyField(
              'transaction_fee_member_cents',
              'Legacy Member Fee (cents)',
              'Legacy: not used by current checkout. Replaced by "Kids Club+ Member Fee" (transaction_fee_subscriber_cents).',
              'cents'
            )}
            {readOnlyField(
              'transaction_fee_non_member_cents',
              'Legacy Non-Member Fee (cents)',
              'Legacy: not used by current checkout. Replaced by "Free-Tier User Fee" (transaction_fee_non_subscriber_cents).',
              'cents'
            )}
            {readOnlyField(
              'platform_fee_seller_discount_percentage_freemium',
              'Legacy Seller Discount % — Free',
              'Legacy: not used by current checkout. Replaced by "Seller Fee % — Free Tier" (platform_fee_seller_percentage, absolute per-tier, BP-38).',
              '%'
            )}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
            <p className="text-xs text-amber-800">
              ⚠️ Fee changes take effect on all new trades immediately. Existing pending trades are unaffected.
            </p>
          </div>
        </section>
      </div>

      {/* Actions */}
      <div className="mt-8 flex justify-end gap-3">
        <button
          onClick={loadSettings}
          disabled={saving}
          className="px-5 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          data-testid="reset-button"
        >
          Reset
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          data-testid="save-button"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
