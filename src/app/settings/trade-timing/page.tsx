'use client';

// filepath: p2p-kids-admin/src/app/settings/trade-timing/page.tsx
// TFV2-001: Admin UI for trade timing configuration
// Reads/writes the 8 TradeTimingConfig keys from admin_config table.

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { TradeTimingConfig } from '@/types/config';

const DEFAULT_CONFIG: TradeTimingConfig = {
  offer_timeout_hours: 48,
  offer_notif_1_hours_before: 24,
  offer_notif_2_hours_before: 6,
  auto_complete_hours: 72,
  auto_complete_notif_hours_before: 24,
  pending_sp_release_days: 3,
  transaction_fee_member_cents: 150,
  transaction_fee_non_member_cents: 250,
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

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_config')
        .select('key, value')
        .in('key', Object.keys(DEFAULT_CONFIG));

      if (error) throw error;

      const parsed: Partial<TradeTimingConfig> = {};
      data?.forEach((row: { key: string; value: string }) => {
        if (row.key in DEFAULT_CONFIG && !isNaN(Number(row.value))) {
          (parsed as any)[row.key] = Number(row.value);
        }
      });

      setSettings((prev) => ({ ...prev, ...parsed }));
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
    if (settings.auto_complete_notif_hours_before >= settings.auto_complete_hours) {
      e.auto_complete_notif_hours_before = `Must be less than auto-complete window (${settings.auto_complete_hours}h)`;
    }
    if (settings.pending_sp_release_days < 1) {
      e.pending_sp_release_days = 'Must be at least 1 day';
    }
    if (settings.transaction_fee_member_cents < 0) {
      e.transaction_fee_member_cents = 'Cannot be negative';
    }
    if (settings.transaction_fee_non_member_cents < 0) {
      e.transaction_fee_non_member_cents = 'Cannot be negative';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validateSettings()) return;

    setSaving(true);
    setSuccess(null);

    try {
      for (const [key, value] of Object.entries(settings)) {
        const { error } = await supabase.rpc('upsert_admin_config_setting', {
          p_key: key,
          p_value: String(value),
          p_category: 'trade_timing',
          p_data_type: 'number',
          p_is_secret: false,
          p_is_active: true,
        });
        if (error) throw error;
      }

      // Audit log
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        await supabase.from('admin_audit_log').insert({
          admin_id: user.id,
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
          value={settings[key]}
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
          Configure offer expiry windows, auto-complete timing, SP release schedules, and transaction fees.
        </p>
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
            'auto_complete_notif_hours_before',
            'Auto-Complete Reminder',
            'Send reminder this many hours before auto-complete fires (must be < window).',
            'hours before auto-complete'
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
            'transaction_fee_member_cents',
            'Kids Club+ Member Fee',
            'Platform fee for Kids Club+ subscribers in cents (e.g. 150 = $1.50).',
            'cents',
            0
          )}
          {numField(
            'transaction_fee_non_member_cents',
            'Free-Tier User Fee',
            'Platform fee for free-tier users in cents (e.g. 250 = $2.50).',
            'cents',
            0
          )}
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
