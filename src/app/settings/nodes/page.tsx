'use client';

// filepath: p2p-kids-admin/src/app/settings/nodes/page.tsx

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  getAdminConfigMeta,
  formatUpdatedMeta,
  type AdminConfigMetaRow,
} from '@/lib/settingsAudit';
import SettingsLinkBanner from '@/components/settings/SettingsLinkBanner';
import LastUpdatedLabel from '@/components/settings/LastUpdatedLabel';

interface NodeSettings {
  default_radius_miles: number;
  max_assignment_distance_miles: number;
  allow_user_radius_adjustment: boolean;
  min_user_radius_miles: number;
  max_user_radius_miles: number;
  distance_warning_threshold_miles: number;
}

export default function NodeSettingsPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const [settings, setSettings] = useState<NodeSettings>({
    default_radius_miles: 10,
    max_assignment_distance_miles: 50,
    allow_user_radius_adjustment: true,
    min_user_radius_miles: 5,
    max_user_radius_miles: 25,
    distance_warning_threshold_miles: 50,
  });
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
        p_keys: [
          'default_radius_miles',
          'max_assignment_distance_miles',
          'allow_user_radius_adjustment',
          'min_user_radius_miles',
          'max_user_radius_miles',
          'distance_warning_threshold_miles',
        ],
      });

      if (error) throw error;

      // Convert array to object
      const settingsObj: any = {};
      data?.forEach((item: { out_key: string; out_value: string }) => {
        const value = item.out_value;
        // Parse boolean and number values
        if (value === 'true' || value === 'false') {
          settingsObj[item.out_key] = value === 'true';
        } else if (!isNaN(Number(value))) {
          settingsObj[item.out_key] = Number(value);
        } else {
          settingsObj[item.out_key] = value;
        }
      });

      setSettings((prev) => ({ ...prev, ...settingsObj }));

      // Same "Last updated" metadata the /config hub shows for these keys.
      const metaRows = await getAdminConfigMeta(supabase, [
        'default_radius_miles',
        'max_assignment_distance_miles',
        'allow_user_radius_adjustment',
        'min_user_radius_miles',
        'max_user_radius_miles',
        'distance_warning_threshold_miles',
      ]);
      setMeta(metaRows);
    } catch (error: any) {
      console.error('Failed to load settings:', error);
      alert(`Failed to load settings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const validateSettings = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (settings.default_radius_miles < 1 || settings.default_radius_miles > 100) {
      newErrors.default_radius_miles = 'Default radius must be between 1 and 100 miles';
    }

    if (settings.max_assignment_distance_miles < settings.default_radius_miles) {
      newErrors.max_assignment_distance_miles =
        'Max assignment distance must be >= default radius';
    }

    if (settings.allow_user_radius_adjustment) {
      if (settings.min_user_radius_miles < 1 || settings.min_user_radius_miles > settings.max_user_radius_miles) {
        newErrors.min_user_radius_miles = 'Min radius must be between 1 and max radius';
      }
      if (settings.max_user_radius_miles > 100) {
        newErrors.max_user_radius_miles = 'Max radius cannot exceed 100 miles';
      }
    }

    if (settings.distance_warning_threshold_miles < 1 || settings.distance_warning_threshold_miles > 200) {
      newErrors.distance_warning_threshold_miles = 'Warning threshold must be between 1 and 200 miles';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateSettings()) {
      alert('Please fix validation errors before saving');
      return;
    }

    setSaving(true);
    setSuccess(null);

    try {
      // Record the acting admin so admin_config.updated_by is set — the same
      // audit source the /config hub uses.
      const adminUser = await supabase.auth.getUser();
      const adminId = adminUser.data.user?.id ?? null;

      // Save each setting to admin_config
      const updates = Object.entries(settings).map(([key, value]) => ({
        key,
        value: String(value),
        category: 'feature_flags',
        data_type: typeof value === 'boolean' ? 'boolean' : 'number',
        is_secret: false,
        is_active: true,
      }));

      for (const { key, value, category, data_type, is_secret, is_active } of updates) {
        // Use RPC function for atomic upsert
        const { data, error } = await supabase.rpc('upsert_admin_config_setting', {
          p_key: key,
          p_value: value,
          p_category: category,
          p_data_type: data_type,
          p_is_secret: is_secret,
          p_is_active: is_active,
          p_admin_id: adminId,
        });

        if (error) {
          console.error(`Failed to upsert ${key}:`, error);
          throw error;
        }

        console.log(`✅ Upserted ${key}:`, data);
      }

      // Log admin action
      if (adminId) {
        await supabase.from('admin_audit_log').insert({
          admin_id: adminId,
          action: 'update_node_settings',
          entity_type: 'admin_config',
          changes: settings,
        });
      }

      setSuccess('Node settings saved successfully!');
      setTimeout(() => setSuccess(null), 5000);
    } catch (error: any) {
      console.error('Save settings error:', error);
      alert('Failed to save settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading node settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Node Settings</h1>
        <p className="text-gray-600 mt-2">
          Configure default node behavior, assignment rules, and user preferences
        </p>
      </div>

      {/* Cross-link: these settings share the same admin_config rows as /config */}
      <div className="mb-6">
        <SettingsLinkBanner
          message="Related settings also live in Config → Feature Flags."
          href="/config?tab=feature_flags"
          linkLabel="Open Config → Feature Flags"
          testId="node-settings-config-link"
        />
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800 font-medium">{success}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        {/* Default Radius */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Default Search Radius (miles) *
          </label>
          <input
            type="number"
            value={settings.default_radius_miles}
            onChange={(e) =>
              setSettings({ ...settings, default_radius_miles: parseInt(e.target.value) || 0 })
            }
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min="1"
            max="100"
            disabled={saving}
          />
          <p className="text-gray-500 text-sm mt-1">
            Default radius for item searches within nodes
          </p>
          {errors.default_radius_miles && (
            <p className="text-red-600 text-sm mt-1">{errors.default_radius_miles}</p>
          )}
          <LastUpdatedLabel
            {...formatUpdatedMeta(meta.default_radius_miles)}
            testId="last-updated-default_radius_miles"
          />
        </div>

        {/* Max Assignment Distance */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Assignment Distance (miles) *
          </label>
          <input
            type="number"
            value={settings.max_assignment_distance_miles}
            onChange={(e) =>
              setSettings({
                ...settings,
                max_assignment_distance_miles: parseInt(e.target.value) || 0,
              })
            }
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min="1"
            max="200"
            disabled={saving}
          />
          <p className="text-gray-500 text-sm mt-1">
            Maximum distance to assign user to a node. Warn if exceeded.
          </p>
          {errors.max_assignment_distance_miles && (
            <p className="text-red-600 text-sm mt-1">
              {errors.max_assignment_distance_miles}
            </p>
          )}
          <LastUpdatedLabel
            {...formatUpdatedMeta(meta.max_assignment_distance_miles)}
            testId="last-updated-max_assignment_distance_miles"
          />
        </div>

        {/* Distance Warning Threshold */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Distance Warning Threshold (miles) *
          </label>
          <input
            type="number"
            value={settings.distance_warning_threshold_miles}
            onChange={(e) =>
              setSettings({
                ...settings,
                distance_warning_threshold_miles: parseInt(e.target.value) || 0,
              })
            }
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min="1"
            max="200"
            disabled={saving}
          />
          <p className="text-gray-500 text-sm mt-1">
            Log warning to Sentry if nearest node is this far away
          </p>
          {errors.distance_warning_threshold_miles && (
            <p className="text-red-600 text-sm mt-1">
              {errors.distance_warning_threshold_miles}
            </p>
          )}
          <LastUpdatedLabel
            {...formatUpdatedMeta(meta.distance_warning_threshold_miles)}
            testId="last-updated-distance_warning_threshold_miles"
          />
        </div>

        {/* Allow User Radius Adjustment */}
        <div className="border-t pt-6">
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              checked={settings.allow_user_radius_adjustment}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  allow_user_radius_adjustment: e.target.checked,
                })
              }
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={saving}
            />
            <label className="ml-2 block text-sm font-medium text-gray-900">
              Allow users to adjust search radius
            </label>
          </div>
          <p className="text-gray-500 text-sm mb-4">
            If enabled, users can customize their search radius within min/max limits
          </p>

          {settings.allow_user_radius_adjustment && (
            <div className="grid grid-cols-2 gap-4 ml-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min User Radius (miles)
                </label>
                <input
                  type="number"
                  value={settings.min_user_radius_miles}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      min_user_radius_miles: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                  max="100"
                  disabled={saving}
                />
                {errors.min_user_radius_miles && (
                  <p className="text-red-600 text-sm mt-1">
                    {errors.min_user_radius_miles}
                  </p>
                )}
                <LastUpdatedLabel
                  {...formatUpdatedMeta(meta.min_user_radius_miles)}
                  testId="last-updated-min_user_radius_miles"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max User Radius (miles)
                </label>
                <input
                  type="number"
                  value={settings.max_user_radius_miles}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      max_user_radius_miles: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                  max="100"
                  disabled={saving}
                />
                {errors.max_user_radius_miles && (
                  <p className="text-red-600 text-sm mt-1">
                    {errors.max_user_radius_miles}
                  </p>
                )}
                <LastUpdatedLabel
                  {...formatUpdatedMeta(meta.max_user_radius_miles)}
                  testId="last-updated-max_user_radius_miles"
                />
              </div>
            </div>
          )}
          <LastUpdatedLabel
            {...formatUpdatedMeta(meta.allow_user_radius_adjustment)}
            testId="last-updated-allow_user_radius_adjustment"
          />
        </div>

        {/* Example Usage */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            📘 Example Usage
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>
              • New users are assigned to nearest node within{' '}
              <strong>{settings.max_assignment_distance_miles} miles</strong>
            </li>
            <li>
              • Item searches default to <strong>{settings.default_radius_miles} miles</strong>{' '}
              from user's node
            </li>
            {settings.allow_user_radius_adjustment && (
              <li>
                • Users can adjust search radius between{' '}
                <strong>
                  {settings.min_user_radius_miles}-{settings.max_user_radius_miles} miles
                </strong>
              </li>
            )}
            {!settings.allow_user_radius_adjustment && (
              <li>• Users cannot adjust search radius (admin-controlled)</li>
            )}
            <li>
              • Warnings logged if user assigned to node{' '}
              <strong>&gt; {settings.distance_warning_threshold_miles} miles</strong> away
            </li>
          </ul>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
