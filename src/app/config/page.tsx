'use client';

// filepath: p2p-kids-admin/src/app/config/page.tsx

import { useState, useEffect } from 'react';
import type { AdminConfigItem, SMSRateLimitStats } from '@/types/config';

export default function ConfigPage() {
    const [config, setConfig] = useState<AdminConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState<boolean | null>(null);

  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '';

  const loadConfigFromApi = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/config');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      
      // Filter out any invalid items (missing key or value)
      const validConfig = (json.data || []).filter((item: any) => item && item.key && item.value !== undefined);
      
      setConfig(validConfig);
      // read can_write flag from server
      setCanWrite(!!json.can_write);
      const initial: Record<string, string> = {};
      validConfig.forEach((item: any) => (initial[item.key] = item.value));
      setEditValues(initial);
    } catch (err: any) {
      setError(err.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigFromApi();
  }, []);

  const handleSave = async (key: string) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      console.log(`[Config Save] Attempting to save ${key} with value:`, editValues[key]);
      
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({ key, value: editValues[key] }),
      });
      
      console.log(`[Config Save] Response status:`, res.status);
      const json = await res.json();
      console.log(`[Config Save] Response body:`, json);
      
      if (!res.ok || json.error) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      
      setSuccess(`Successfully updated ${key}`);
      console.log(`[Config Save] ✅ Success! Updated: ${key} = ${editValues[key]}`);
      
      // Reload config from API
      await loadConfigFromApi();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to save configuration';
      console.error(`[Config Save] ❌ Error:`, errorMsg, err);
      setError(errorMsg);
    } finally {
      setSaving(false);
    }
  };



  const getConfigDescription = (key: string): string => {
    const descriptions: Record<string, string> = {
      sms_rate_limit_per_hour: 'Maximum number of SMS verification codes that can be sent per hour per phone number. Helps prevent SMS spam and abuse.',
      verification_code_expiry_minutes: 'How long verification codes remain valid before expiring (in minutes).',
      max_verification_attempts: 'Maximum number of incorrect code attempts before requiring a new code.',
    };
    return descriptions[key] || '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">System Configuration</h1>
      <p className="text-gray-600 mb-8">
        Manage system-wide settings and rate limits
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 font-medium">Error</p>
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800 font-medium">{success}</p>
        </div>
      )}

      {/* Read-only banner when service key missing */}
      {canWrite === false && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 font-medium">Read-Only Mode</p>
          <p className="text-sm text-yellow-700 mb-3">Server is not configured with a Supabase <code>service_role</code> key. Changes will not persist to the production project.</p>

          <p className="text-sm text-yellow-700 mb-3">To enable authoritative writes:</p>
          <ol className="list-decimal list-inside text-sm text-yellow-700 mb-3">
            <li>Set <code>SUPABASE_SERVICE_ROLE_KEY</code> (server env) to your Supabase service role key.</li>
            <li>Set <code>ADMIN_UI_SECRET</code> (server env) to a long random string.</li>
            <li>Restart the admin server (or redeploy) to pick up environment variables.</li>
          </ol>

          <div className="flex items-center space-x-3">
            <button
              onClick={async () => {
                const snippet = `# SERVER (DO NOT COMMIT)\nSUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here\nADMIN_UI_SECRET=some-long-secret\n# (Local dev only) optionally: NEXT_PUBLIC_ADMIN_UI_SECRET=some-long-secret`;
                try {
                  await navigator.clipboard.writeText(snippet);
                  alert('Setup snippet copied to clipboard');
                } catch (e) {
                  // fallback: open a small prompt
                  prompt('Copy and paste the following into your admin server env (.env.local):', snippet);
                }
              }}
              className="px-3 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
            >
              Copy setup snippet
            </button>
            <a
              href="https://supabase.com/docs/guides/auth#service-role" target="_blank" rel="noreferrer"
              className="text-sm text-yellow-800 underline"
            >
              Supabase service role docs
            </a>
          </div>
        </div>
      )}

      {/* SMS Rate Limit Stats */}
      <SMSRateLimitStats />

      {/* Configuration Items - Grouped by Category */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Configuration Settings</h2>
          <p className="text-sm text-gray-600 mt-1">{config.length} settings organized by category</p>
        </div>
        
        {Object.entries(
          config.reduce((acc, item) => {
            const category = (item as any).category || 'general';
            if (!acc[category]) acc[category] = [];
            acc[category].push(item);
            return acc;
          }, {} as Record<string, any[]>)
        ).sort().map(([category, items]) => (
          <div key={category}>
            {/* Category Header */}
            <div className="px-6 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 capitalize">
                {category.replace(/_/g, ' ')}
              </h3>
              <p className="text-xs text-gray-600 mt-1">{items.length} settings</p>
            </div>
            
            {/* Category Items */}
            <div className="divide-y divide-gray-200">
              {items.map((item) => {
                if (!item || !item.key) return null;
                return (
                <div key={item.key} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 mr-4">
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    {item.key.split('_').map((word: string) => 
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')}
                  </label>
                  <p className="text-sm text-gray-600 mb-3">
                    {getConfigDescription(item.key) || item.description}
                  </p>
                  <div className="flex items-center space-x-3">
                    <input
                      type="text"
                      value={editValues[item.key] || ''}
                      onChange={(e) => 
                        setEditValues({ ...editValues, [item.key]: e.target.value })
                      }
                      className="flex-1 max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={saving || canWrite === false}
                    />
                    <button
                      onClick={() => handleSave(item.key)}
                      disabled={saving || editValues[item.key] === item.value || canWrite === false}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving ? 'Saving...' : (canWrite === false ? 'Read-only' : 'Save')}
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Last updated: {new Date(item.updated_at).toLocaleString()}
              </div>
            </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Help Section */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          Configuration Guidelines
        </h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>• <strong>SMS Rate Limit:</strong> Recommended range is 5-15 per hour. Too low may frustrate users, too high risks abuse.</li>
          <li>• <strong>Code Expiry:</strong> Standard is 10 minutes. Shorter times increase security but may inconvenience users.</li>
          <li>• <strong>Max Attempts:</strong> 3 attempts is industry standard. Prevents brute force while allowing for typos.</li>
          <li>• All changes are logged in the audit trail for compliance and security review.</li>
        </ul>
      </div>
    </div>
  );
}

function SMSRateLimitStats() {
  const [stats, setStats] = useState<SMSRateLimitStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStatsFromApi = async () => {
    try {
      const res = await fetch('/api/admin/sms-stats');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setStats(json);
    } catch (err) {
      console.error('Failed to load SMS stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatsFromApi();
    const interval = setInterval(loadStatsFromApi, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">SMS Usage Statistics</h2>
        <button
          onClick={loadStatsFromApi}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Refresh
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-600 font-medium mb-1">Today Total</p>
          <p className="text-3xl font-bold text-blue-900">{stats?.totalSentToday || 0}</p>
          <p className="text-xs text-blue-600 mt-1">SMS sent today</p>
        </div>
        
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-green-600 font-medium mb-1">Last Hour</p>
          <p className="text-3xl font-bold text-green-900">{stats?.totalSentThisHour || 0}</p>
          <p className="text-xs text-green-600 mt-1">SMS sent this hour</p>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-sm text-purple-600 font-medium mb-1">Unique Phones</p>
          <p className="text-3xl font-bold text-purple-900">{stats?.uniquePhonesThisHour || 0}</p>
          <p className="text-xs text-purple-600 mt-1">This hour</p>
        </div>
        
        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-sm text-red-600 font-medium mb-1">Rate Limited</p>
          <p className="text-3xl font-bold text-red-900">{stats?.rateLimitedAttempts || 0}</p>
          <p className="text-xs text-red-600 mt-1">Blocked attempts</p>
        </div>
      </div>
    </div>
  );
}
