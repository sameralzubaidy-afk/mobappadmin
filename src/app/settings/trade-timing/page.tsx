'use client';

// filepath: p2p-kids-admin/src/app/settings/trade-timing/page.tsx
// TFV2-001: Admin UI for trade timing configuration
// Reads/writes the 8 TradeTimingConfig keys from admin_config table.

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { TradeTimingConfig } from '@/types/config';
import {
  getAdminConfigMeta,
  formatUpdatedMeta,
  type AdminConfigMetaRow,
} from '@/lib/settingsAudit';
import SettingsLinkBanner from '@/components/settings/SettingsLinkBanner';
import LastUpdatedLabel from '@/components/settings/LastUpdatedLabel';

const DEFAULT_CONFIG: TradeTimingConfig = {
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
  // N1 Configurability (new keys; defaults match 20260809000004_n1_configurability.sql):
  pickup_window_hours: 72,
  // R2 (2026-08-10): pickup-window reminder thresholds (buyer-only). Defaults match
  // the seed in 20260810000001_r2_auth_capture_countdown.sql (24h / 2h).
  pickup_notif_1_hours_before: 24,
  pickup_notif_2_hours_before: 2,
  payout_buffer_days: 2,
  // Fee params consolidated from /config → FEES (buyer fee + bundle toggle).
  // Defaults match the admin_config seeds in 20250113_create_admin_config.sql
  // (buyer fixed 25¢, buyer % 2.5) and 316_charge_one_fee_per_bundle_config.sql (OFF).
  platform_fee_buyer_fixed_cents: 25,
  platform_fee_buyer_percentage: 2.5,
  charge_one_fee_per_bundle: false,
  // R1 — Tiered Buyer-Fee Engine (first-trade protection). SEED defaults only —
  // the live values live in admin_config (fees) and are read at checkout by
  // fn_get_buyer_fee_for_checkout. Active members + first-trade users pay a flat
  // fee; free users with 1+ completed trades pay % of cash + fixed, capped.
  buyer_fee_active_member_cents: 149,
  buyer_fee_first_trade_cents: 149,
  buyer_fee_subsequent_percentage: 5.0,
  buyer_fee_subsequent_fixed_cents: 199,
  buyer_fee_subsequent_max_cents: 499,
  buyer_fee_label: 'Safety & Platform Fee',
  // B2: Seller fee per tier. Defaults match the admin_config seeds in
  // 20250113_create_admin_config.sql (free=5, subscriber=0). Both are editable here.
  platform_fee_seller_percentage: 5,
  platform_fee_seller_discount_percentage_kids_club_plus: 0,
  // LEGACY fee keys (consolidated from /config so Trade Timing is the single fee
  // surface). NOT read by current checkout — kept editable for audit only.
  // Defaults match the 20260528 seeds (member=99, non_member=299) and the
  // 20250113 seed (freemium seller discount=0).
  transaction_fee_member_cents: 99,
  transaction_fee_non_member_cents: 299,
  platform_fee_seller_discount_percentage_freemium: 0,
};

export default function TradeTimingSettingsPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const [settings, setSettings] = useState<TradeTimingConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);
  // Last-updated metadata per key (admin_config.updated_at + updated_by).
  const [meta, setMeta] = useState<Record<string, AdminConfigMetaRow>>({});
  // R1 — Buyer fee-tier distribution stats (how many users are in each tier).
  const [feeTierStats, setFeeTierStats] = useState<
    Array<{ fee_state: string; user_count: number; fee_tier: string }>
  >([]);
  const [feeTierStatsLoading, setFeeTierStatsLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  // R1 — Fee-tier distribution (BP-49: send x-admin-secret on /api/admin/* fetches).
  const loadFeeTierStats = useCallback(async () => {
    setFeeTierStatsLoading(true);
    try {
      const res = await fetch('/api/admin/fee-tier-stats', {
        headers: { 'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '' },
      });
      const json = await res.json();
      if (json.success) setFeeTierStats(json.data ?? []);
    } catch (err) {
      console.error('[TradeTimingSettings] fee-tier stats load error:', err);
    } finally {
      setFeeTierStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeeTierStats();
  }, [loadFeeTierStats]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // Use SECURITY DEFINER RPC to bypass RLS on admin_config
      const { data, error } = await supabase.rpc('fn_get_admin_config_values', {
        p_keys: Object.keys(DEFAULT_CONFIG),
      });

      if (error) throw error;

      const parsed: Partial<TradeTimingConfig> = {};
      data?.forEach((row: { out_key: string; out_value: string }) => {
        // Boolean keys store 'true'/'false' strings — parse them separately.
        if (row.out_key === 'charge_one_fee_per_bundle') {
          (parsed as any)[row.out_key] = row.out_value === 'true';
        } else if (row.out_key in DEFAULT_CONFIG && !isNaN(Number(row.out_value))) {
          (parsed as any)[row.out_key] = Number(row.out_value);
        }
      });

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
    const e: Record<string, string> = {};

    if (settings.offer_timeout_hours < 1) {
      e.offer_timeout_hours = 'Must be at least 1 hour';
    }
    if (settings.offer_notif_1_hours_before >= settings.offer_timeout_hours) {
      e.offer_notif_1_hours_before = `Must be less than offer timeout (${settings.offer_timeout_hours}h)`;
    }
    if (settings.offer_notif_2_hours_before >= settings.offer_notif_1_hours_before) {
      e.offer_notif_2_hours_before = `Must be less than first reminder (${settings.offer_notif_1_hours_before}h)`;
    }
    if (settings.offer_notif_2_hours_before < 1) {
      e.offer_notif_2_hours_before = 'Must be at least 1 hour';
    }
    if (settings.auto_complete_hours < 1) {
      e.auto_complete_hours = 'Must be at least 1 hour';
    }
    if (settings.auto_complete_notif_1_hours_before < 1) {
      e.auto_complete_notif_1_hours_before = 'Must be at least 1 hour';
    }
    if (settings.auto_complete_notif_1_hours_before >= settings.auto_complete_hours) {
      e.auto_complete_notif_1_hours_before = `Must be less than auto-complete window (${settings.auto_complete_hours}h)`;
    }
    if (settings.auto_complete_notif_2_hours_before < 1) {
      e.auto_complete_notif_2_hours_before = 'Must be at least 1 hour';
    }
    if (settings.auto_complete_notif_2_hours_before >= settings.auto_complete_notif_1_hours_before) {
      e.auto_complete_notif_2_hours_before = `Must be less than first auto-complete reminder (${settings.auto_complete_notif_1_hours_before}h)`;
    }
    if (settings.pending_sp_release_days < 1) {
      e.pending_sp_release_days = 'Must be at least 1 day';
    }
    if (settings.transaction_fee_subscriber_cents < 0) {
      e.transaction_fee_subscriber_cents = 'Cannot be negative';
    }
    if (settings.transaction_fee_non_subscriber_cents < 0) {
      e.transaction_fee_non_subscriber_cents = 'Cannot be negative';
    }
    if (
      settings.platform_fee_seller_percentage < 0 ||
      settings.platform_fee_seller_percentage > 100
    ) {
      e.platform_fee_seller_percentage = 'Must be between 0 and 100';
    }
    if (
      settings.platform_fee_seller_discount_percentage_kids_club_plus < 0 ||
      settings.platform_fee_seller_discount_percentage_kids_club_plus > 100
    ) {
      e.platform_fee_seller_discount_percentage_kids_club_plus = 'Must be between 0 and 100';
    }
    // Legacy fee keys (audit-only; not read by current checkout).
    if (settings.transaction_fee_member_cents < 0) {
      e.transaction_fee_member_cents = 'Cannot be negative';
    }
    if (settings.transaction_fee_non_member_cents < 0) {
      e.transaction_fee_non_member_cents = 'Cannot be negative';
    }
    if (
      settings.platform_fee_seller_discount_percentage_freemium < 0 ||
      settings.platform_fee_seller_discount_percentage_freemium > 100
    ) {
      e.platform_fee_seller_discount_percentage_freemium = 'Must be between 0 and 100';
    }
    if (settings.max_pending_offers_per_seller < 1) {
      e.max_pending_offers_per_seller = 'Must be at least 1';
    }
    if (settings.max_pending_offers_per_seller > 10) {
      e.max_pending_offers_per_seller = 'Maximum is 10 offers per seller';
    }
    // N1 Configurability — pickup countdown + payout buffer ranges.
    if (settings.pickup_window_hours < 1) {
      e.pickup_window_hours = 'Must be at least 1 hour';
    }
    if (settings.pickup_window_hours > 168) {
      e.pickup_window_hours = 'Maximum is 168 hours (7 days)';
    }
    // R2 pickup reminders — must be ordered and inside the pickup window.
    if (settings.pickup_notif_1_hours_before < 1) {
      e.pickup_notif_1_hours_before = 'Must be at least 1 hour';
    }
    if (settings.pickup_notif_1_hours_before >= settings.pickup_window_hours) {
      e.pickup_notif_1_hours_before = `Must be less than pickup window (${settings.pickup_window_hours}h)`;
    }
    if (settings.pickup_notif_2_hours_before < 1) {
      e.pickup_notif_2_hours_before = 'Must be at least 1 hour';
    }
    if (settings.pickup_notif_2_hours_before >= settings.pickup_notif_1_hours_before) {
      e.pickup_notif_2_hours_before = `Must be less than first pickup reminder (${settings.pickup_notif_1_hours_before}h)`;
    }
    // R2 (2026-08-10): 7-day Stripe authorization guardrail — HARD BLOCK.
    // Offer + pickup windows must total under 168h so capture always precedes the
    // 7-day authorization expiry. Mirrors fn_validate_trade_timing_config.
    if (settings.offer_timeout_hours + settings.pickup_window_hours > 167) {
      const total = settings.offer_timeout_hours + settings.pickup_window_hours;
      const msg = `Offer + pickup (${total}h) must stay under 168h (Stripe's 7-day authorization limit). Lower one window.`;
      e.offer_timeout_hours = msg;
      e.pickup_window_hours = msg;
    }
    if (settings.payout_buffer_days < 0) {
      e.payout_buffer_days = 'Cannot be negative';
    }
    if (settings.payout_buffer_days > 30) {
      e.payout_buffer_days = 'Maximum is 30 days';
    }
    // Buyer fee params (consolidated from /config → FEES).
    if (settings.platform_fee_buyer_fixed_cents < 0) {
      e.platform_fee_buyer_fixed_cents = 'Cannot be negative';
    }
    if (
      settings.platform_fee_buyer_percentage < 0 ||
      settings.platform_fee_buyer_percentage > 100
    ) {
      e.platform_fee_buyer_percentage = 'Must be between 0 and 100';
    }
    // R1 — Tiered Buyer-Fee Engine validation.
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
    if (settings.buyer_fee_subsequent_max_cents < settings.buyer_fee_subsequent_fixed_cents) {
      e.buyer_fee_subsequent_max_cents = 'Must be at least the fixed fee';
    }
    if (settings.buyer_fee_label.trim() === '') {
      e.buyer_fee_label = 'Cannot be empty';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // N1 single-source: the /config hub groups keys by category, so the NEW keys
  // save under their canonical category (trade / fees) matching their admin_config
  // seeds. Existing keys keep the legacy 'feature_flags' bucket so they don't
  // shift between /config tabs (behavior-preserving).
  const CONFIG_CATEGORIES: Record<string, string> = {
    pickup_window_hours: 'trade',
    pickup_notif_1_hours_before: 'trade',
    pickup_notif_2_hours_before: 'trade',
    payout_buffer_days: 'fees',
    // Fee params consolidated from /config → FEES.
    platform_fee_buyer_fixed_cents: 'fees',
    platform_fee_buyer_percentage: 'fees',
    charge_one_fee_per_bundle: 'fees',
    // R1 — Tiered Buyer-Fee Engine params live in the fees category.
    buyer_fee_active_member_cents: 'fees',
    buyer_fee_first_trade_cents: 'fees',
    buyer_fee_subsequent_percentage: 'fees',
    buyer_fee_subsequent_fixed_cents: 'fees',
    buyer_fee_subsequent_max_cents: 'fees',
    buyer_fee_label: 'fees',
    // Legacy fee keys — keep in 'fees' to match their admin_config seeds.
    transaction_fee_member_cents: 'fees',
    transaction_fee_non_member_cents: 'fees',
    platform_fee_seller_discount_percentage_freemium: 'fees',
  };

  // Boolean keys must save with data_type 'boolean' (admin_config data_type CHECK).
  const CONFIG_TYPES: Record<string, string> = {
    charge_one_fee_per_bundle: 'boolean',
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

      for (const [key, value] of Object.entries(settings)) {
        const { error } = await supabase.rpc('upsert_admin_config_setting', {
          p_key: key,
          p_value: String(value),
          p_category: CONFIG_CATEGORIES[key] ?? 'feature_flags',
          p_data_type: CONFIG_TYPES[key] ?? 'number',
          p_is_secret: false,
          p_is_active: true,
          p_admin_id: adminId,
        });
        if (error) throw error;
      }

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
    key: keyof TradeTimingConfig,
    label: string,
    description: string,
    unit: string,
    min = 1
  ) => (
    <div key={key} className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="flex items-center gap-3">
        <input
          type="number"
          value={settings[key] as number}
          onChange={(e) =>
            setSettings((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }))
          }
          className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          min={min}
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

  // Boolean toggle field for admin_config boolean keys (e.g. charge_one_fee_per_bundle).
  const boolField = (
    key: keyof TradeTimingConfig,
    label: string,
    description: string
  ) => (
    <div key={key} className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={settings[key] as boolean}
          onChange={(e) =>
            setSettings((prev) => ({ ...prev, [key]: e.target.checked }))
          }
          disabled={saving}
          data-testid={`input-${key}`}
        />
        <span className="text-sm text-gray-500">Enabled</span>
      </label>
      <p className="text-xs text-gray-500">{description}</p>
      <LastUpdatedLabel
        {...formatUpdatedMeta(meta[key as string])}
        testId={`last-updated-${key}`}
      />
    </div>
  );

  // Text field for string admin_config keys (e.g. buyer_fee_label).
  const textField = (
    key: keyof TradeTimingConfig,
    label: string,
    description: string
  ) => (
    <div key={key} className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
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
        <h1 className="text-[32px] font-bold leading-10 text-gray-900" style={{ letterSpacing: '-0.5px' }}>Trade Timing Settings</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Configure offer and pickup countdown windows, auto-complete timing, payout buffering, SP release schedules, and transaction fees.
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
            'Auto-Complete Window (legacy)',
            'Legacy fallback for the post-acceptance deadline. New trades use the Pickup Window above (pickup_window_hours). Kept for in-flight trades and backward compatibility.',
            'hours'
          )}
          {numField(
            'auto_complete_notif_1_hours_before',
            'First Auto-Complete Reminder',
            'Send the first reminder to the buyer this many hours before auto-complete (must be < window).',
            'hours before auto-complete'
          )}
          {numField(
            'auto_complete_notif_2_hours_before',
            'Final Auto-Complete Reminder',
            'Send the final reminder before auto-complete (must be < first reminder).',
            'hours before auto-complete'
          )}
        </section>

        {/* Pickup & Payout — N1 Configurability */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-3">
            Pickup &amp; Payout
          </h2>
          {numField(
            'pickup_window_hours',
            'Pickup Window',
            'Hours a buyer has to confirm pickup/meetup once a trade is ready (1–168). Drives the post-acceptance auto-complete deadline (R2). Combined with the offer window it must stay under 168h (7-day Stripe limit).',
            'hours'
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
            'Days a completed trade payout sits as a buffer before release to the seller (0 = immediate, max 30). Tunable now; enforcement lands with the payout requirement.',
            'days',
            0
          )}
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
          {numField(
            'platform_fee_seller_percentage',
            'Seller Fee % — Free Tier',
            'Seller platform fee for FREE (non-subscriber) sellers, as a % of the cash portion (item price − SP). Example: 5 = 5% (default).',
            '%',
            0
          )}
          {numField(
            'platform_fee_seller_discount_percentage_kids_club_plus',
            'Seller Fee % — Kids Club+',
            'Seller platform fee for Kids Club+ (subscriber) sellers, as an ABSOLUTE % of the cash portion (item price − SP). This is the rate itself, not a discount. Seeded default 0; set to 5 for a uniform 5% seller fee across tiers.',
            '%',
            0
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
            0
          )}
          {boolField(
            'charge_one_fee_per_bundle',
            'Charge One Fee Per Bundle',
            'When enabled, a bundle charges the platform fee once instead of once per item. Single-item trades are unaffected. Applies to both free-tier and subscriber fixed fees.'
          )}
          <div className="border-t border-gray-100 pt-4 mt-2 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800">
              Tiered Buyer Fee — R1 (first-trade protection)
            </h3>
            <p className="text-xs text-gray-500">
              Resolved at checkout by buyer fee-tier: active members and free users on their first trade pay a flat fee; free users with 1+ completed trades pay a percentage of the cash portion + a fixed fee, capped at the maximum. Swap Points never reduce the fee base. All values are dynamic — changes apply to new checkouts immediately.
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
              0
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
          <div className="border-t border-gray-100 pt-4 mt-2 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800">Legacy fee keys (audit only)</h3>
            <p className="text-xs text-gray-500">
              These keys were seeded under the old naming scheme and are NOT read by the
              current checkout. They are surfaced here (single source) so no fee key is
              editable on two pages. Changes have no effect on live trades — kept for
              backward-compatibility auditing only.
            </p>
            {numField(
              'transaction_fee_member_cents',
              'Legacy Member Fee (cents)',
              'Legacy: not used by current checkout. Replaced by "Kids Club+ Member Fee" (transaction_fee_subscriber_cents).',
              'cents',
              0
            )}
            {numField(
              'transaction_fee_non_member_cents',
              'Legacy Non-Member Fee (cents)',
              'Legacy: not used by current checkout. Replaced by "Free-Tier User Fee" (transaction_fee_non_subscriber_cents).',
              'cents',
              0
            )}
            {numField(
              'platform_fee_seller_discount_percentage_freemium',
              'Legacy Seller Discount % — Free',
              'Legacy: not used by current checkout. Replaced by "Seller Fee % — Free Tier" (platform_fee_seller_percentage, absolute per-tier, BP-38).',
              '%',
              0
            )}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
            <p className="text-xs text-amber-800">
              ⚠️ Fee changes take effect on all new trades immediately. Existing pending trades are unaffected.
            </p>
          </div>
        </section>

        {/* R1 — Fee-Tier Distribution: how many users are in each buyer-fee tier. */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-3">
            Buyer Fee-Tier Distribution
          </h2>
          <p className="text-xs text-gray-500">
            How many users are in each buyer-fee tier (flat vs percentage). Flat = active members + free users on their first trade; Percentage = free users with 1+ completed trades. Updated on load.
          </p>
          {feeTierStatsLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : feeTierStats.length === 0 ? (
            <p className="text-sm text-gray-500">No fee-tier data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-3">Tier</th>
                    <th className="py-2 pr-3">Fee State</th>
                    <th className="py-2">Users</th>
                  </tr>
                </thead>
                <tbody>
                  {feeTierStats.map((row) => (
                    <tr key={row.fee_state} className="border-b border-gray-50">
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            row.fee_tier === 'flat'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {row.fee_tier === 'flat' ? 'Flat fee' : 'Percentage fee'}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        {row.fee_state.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2 font-medium">
                        {row.user_count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
