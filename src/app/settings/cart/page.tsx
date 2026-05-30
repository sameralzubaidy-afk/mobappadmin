'use client';

// filepath: p2p-kids-admin/src/app/settings/cart/page.tsx
// CART-017: Admin UI for cart configuration
// Reads/writes cart_min_value_cents, cart_max_saved_carts, cart_saved_expiry_days
// from the admin_config table via upsert_admin_config_setting RPC.

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

interface CartConfig {
  cart_min_value_cents: number;
  cart_max_saved_carts: number;
  cart_saved_expiry_days: number;
}

const DEFAULT_CONFIG: CartConfig = {
  cart_min_value_cents: 2000,  // $20.00
  cart_max_saved_carts: 3,
  cart_saved_expiry_days: 7,
};

export default function CartSettingsPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const [settings, setSettings] = useState<CartConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_config')
        .select('key, value')
        .in('key', Object.keys(DEFAULT_CONFIG));

      if (error) throw error;

      const parsed: Partial<CartConfig> = {};
      (data ?? []).forEach((row: { key: string; value: string }) => {
        if (row.key in DEFAULT_CONFIG && !isNaN(Number(row.value))) {
          (parsed as Record<string, number>)[row.key] = Number(row.value);
        }
      });

      setSettings((prev) => ({ ...prev, ...parsed }));
    } catch (err: unknown) {
      console.error('[CartSettings] load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (settings.cart_min_value_cents < 0) {
      e.cart_min_value_cents = 'Minimum cart value cannot be negative';
    }
    if (settings.cart_max_saved_carts < 1 || settings.cart_max_saved_carts > 10) {
      e.cart_max_saved_carts = 'Must be between 1 and 10';
    }
    if (settings.cart_saved_expiry_days < 1 || settings.cart_saved_expiry_days > 365) {
      e.cart_saved_expiry_days = 'Must be between 1 and 365 days';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    setSuccess(null);

    try {
      const entries: Array<[keyof CartConfig, number]> = [
        ['cart_min_value_cents', settings.cart_min_value_cents],
        ['cart_max_saved_carts', settings.cart_max_saved_carts],
        ['cart_saved_expiry_days', settings.cart_saved_expiry_days],
      ];

      for (const [key, value] of entries) {
        const { error } = await supabase.rpc('upsert_admin_config_setting', {
          p_key: key,
          p_value: String(value),
          p_description: null,
        });
        if (error) throw new Error(`Failed to save ${key}: ${error.message}`);
      }

      setSuccess('Cart settings saved successfully!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setErrors({ _save: message });
    } finally {
      setSaving(false);
    }
  };

  const handleMinValueChange = (dollars: string) => {
    const parsed = parseFloat(dollars);
    setSettings((prev) => ({
      ...prev,
      cart_min_value_cents: isNaN(parsed) ? 0 : Math.round(parsed * 100),
    }));
  };

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Loading cart settings…</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Cart Settings</h1>
      <p className="text-sm text-gray-500 mb-8">
        Configure cart rules enforced across iOS and Android apps.
        Changes take effect immediately (fetched from admin_config at checkout).
      </p>

      {success && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
          {success}
        </div>
      )}

      {errors._save && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {errors._save}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">

        {/* Minimum Cart Value */}
        <div className="p-6">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Minimum Cart Value ($)
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Checkout is blocked until the cart subtotal reaches this amount.
            Current stored value: {settings.cart_min_value_cents}¢
          </p>
          <input
            type="number"
            min="0"
            step="0.01"
            value={(settings.cart_min_value_cents / 100).toFixed(2)}
            onChange={(e) => handleMinValueChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            data-testid="cart-min-value-input"
          />
          {errors.cart_min_value_cents && (
            <p className="mt-1 text-xs text-red-600">{errors.cart_min_value_cents}</p>
          )}
        </div>

        {/* Max Saved Carts */}
        <div className="p-6">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Max Saved Carts per User
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Users who exceed this limit will see a SAVED_CART_LIMIT_REACHED error.
          </p>
          <input
            type="number"
            min="1"
            max="10"
            step="1"
            value={settings.cart_max_saved_carts}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                cart_max_saved_carts: parseInt(e.target.value, 10) || 1,
              }))
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            data-testid="cart-max-saved-carts-input"
          />
          {errors.cart_max_saved_carts && (
            <p className="mt-1 text-xs text-red-600">{errors.cart_max_saved_carts}</p>
          )}
        </div>

        {/* Saved Cart Expiry */}
        <div className="p-6">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Saved Cart Expiry (days)
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Saved carts older than this many days are automatically deleted (R-08).
            The cleanup job reads this setting.
          </p>
          <input
            type="number"
            min="1"
            max="365"
            step="1"
            value={settings.cart_saved_expiry_days}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                cart_saved_expiry_days: parseInt(e.target.value, 10) || 7,
              }))
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            data-testid="cart-saved-expiry-days-input"
          />
          {errors.cart_saved_expiry_days && (
            <p className="mt-1 text-xs text-red-600">{errors.cart_saved_expiry_days}</p>
          )}
        </div>
      </div>

      <div className="mt-6 flex gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
          data-testid="save-cart-settings-button"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        <button
          onClick={loadSettings}
          disabled={saving || loading}
          className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
