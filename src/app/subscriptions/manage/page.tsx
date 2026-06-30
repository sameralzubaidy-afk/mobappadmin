'use client';

// filepath: p2p-kids-admin/src/app/subscriptions/manage/page.tsx

import { useState, useEffect, FormEvent } from 'react';
import type {
  SubscriptionWithProfile,
  SubscriptionMetrics,
  SubscriptionStatus,
  GracePeriodConfig,
} from '@/types/subscriptions';

// Allow overriding the admin API host when the UI runs from a different origin.
const ADMIN_API_BASE_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL?.replace(/\/$/, '') || '';

const buildAdminApiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return ADMIN_API_BASE_URL ? `${ADMIN_API_BASE_URL}${normalizedPath}` : normalizedPath;
};

const describeAdminApiConnectionIssue = (endpoint: string, err: any) => {
  if (!err?.message?.includes('Failed to fetch')) {
    return null;
  }

  const advice = ADMIN_API_BASE_URL
    ? 'Confirm NEXT_PUBLIC_ADMIN_API_URL points to the admin backend you started.'
    : 'Start the admin server locally (npm run dev -p 3001) so this endpoint becomes reachable from the UI.';

  return `Unable to reach ${buildAdminApiUrl(endpoint)}. ${advice}`;
};

export default function SubscriptionManagementPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithProfile[]>([]);
  const [metrics, setMetrics] = useState<SubscriptionMetrics | null>(null);
  const [gracePeriodConfig, setGracePeriodConfig] = useState<GracePeriodConfig>({
    grace_period_days: 90,
    grace_reminder_thresholds: [60, 30, 7, 1],
  });
  
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  // Grace period config edit state
  const [editGraceDays, setEditGraceDays] = useState('90');
  const [editReminderThresholds, setEditReminderThresholds] = useState('60, 30, 7, 1');

  // Admin actions state
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '';

  useEffect(() => {
    loadSubscriptions();
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    loadGracePeriodConfig();
  }, []);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = searchInput.trim();
    if (trimmed === searchTerm) {
      return;
    }
    setSearchTerm(trimmed);
  };

  const handleClearSearch = () => {
    if (!searchTerm && searchInput === '') {
      return;
    }
    setSearchInput('');
    setSearchTerm('');
  };

  const loadSubscriptions = async () => {
    setLoading(true);
    setError(null);
    try {
      const subscriptionsEndpoint = buildAdminApiUrl('/api/admin/subscriptions');
      const params = new URLSearchParams({
        status: searchTerm ? 'all' : statusFilter,
        ts: Date.now().toString(),
      });

      if (searchTerm) {
        params.set('search', searchTerm);
      }

      const res = await fetch(`${subscriptionsEndpoint}?${params.toString()}`, {
        cache: 'no-store',
        headers: {
          'x-admin-secret': adminSecret,
        },
      });
      const json = await res.json();
      
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Failed to fetch subscriptions');
      }

      setSubscriptions(json.subscriptions || []);
      setMetrics(json.metrics || null);
    } catch (err: any) {
      const connectionHint = describeAdminApiConnectionIssue('/api/admin/subscriptions', err);
      setError(connectionHint || err.message || 'Failed to load subscriptions');
      console.error('[SubscriptionManagement] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadGracePeriodConfig = async () => {
    try {
      const configEndpoint = buildAdminApiUrl('/api/admin/config');
      const res = await fetch(`${configEndpoint}?ts=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      
      if (json.error) {
        console.error('[GracePeriodConfig] Load error:', json.error);
        return;
      }

      const configData = json.data || [];
      const graceDaysItem = configData.find((c: any) => c.key === 'grace_period_days');
      const thresholdsItem = configData.find((c: any) => c.key === 'grace_reminder_thresholds');

      if (graceDaysItem) {
        const days = parseInt(graceDaysItem.value, 10);
        setGracePeriodConfig(prev => ({ ...prev, grace_period_days: days }));
        setEditGraceDays(graceDaysItem.value);
      }

      if (thresholdsItem) {
        try {
          const thresholds = JSON.parse(thresholdsItem.value);
          setGracePeriodConfig(prev => ({ ...prev, grace_reminder_thresholds: thresholds }));
          setEditReminderThresholds(thresholds.join(', '));
        } catch (parseErr) {
          console.error('[GracePeriodConfig] Parse error for thresholds:', parseErr);
        }
      }
    } catch (err: any) {
      console.error('[GracePeriodConfig] Load error:', err);
      const connectionHint = describeAdminApiConnectionIssue('/api/admin/config', err);
      if (connectionHint) {
        setConfigError(connectionHint);
      }
    }
  };

  const handleSaveGracePeriodDays = async () => {
    setConfigSaving(true);
    setConfigError(null);
    setConfigSuccess(null);

    try {
      const days = parseInt(editGraceDays, 10);
      
      if (isNaN(days) || days < 1) {
        throw new Error('Grace period days must be a positive integer');
      }

      const configEndpoint = buildAdminApiUrl('/api/admin/config');
      const res = await fetch(configEndpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({
          key: 'grace_period_days',
          value: String(days),
        }),
      });

      const json = await res.json();
      
      if (!res.ok || json.error) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      setGracePeriodConfig(prev => ({ ...prev, grace_period_days: days }));
      setConfigSuccess('Grace period days updated successfully');
      setTimeout(() => setConfigSuccess(null), 5000);
    } catch (err: any) {
      const connectionHint = describeAdminApiConnectionIssue('/api/admin/config', err);
      setConfigError(connectionHint || err.message || 'Failed to save grace period days');
      console.error('[GracePeriodConfig] Save error:', err);
    } finally {
      setConfigSaving(false);
    }
  };

  const handleSaveReminderThresholds = async () => {
    setConfigSaving(true);
    setConfigError(null);
    setConfigSuccess(null);

    try {
      // Parse comma-separated values
      const thresholds = editReminderThresholds
        .split(',')
        .map(s => parseInt(s.trim(), 10))
        .filter(n => !isNaN(n) && n > 0);

      if (thresholds.length === 0) {
        throw new Error('Reminder thresholds must contain at least one positive integer');
      }

      const configEndpoint = buildAdminApiUrl('/api/admin/config');
      const res = await fetch(configEndpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({
          key: 'grace_reminder_thresholds',
          value: JSON.stringify(thresholds),
        }),
      });

      const json = await res.json();
      
      if (!res.ok || json.error) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      setGracePeriodConfig(prev => ({ ...prev, grace_reminder_thresholds: thresholds }));
      setConfigSuccess('Reminder thresholds updated successfully');
      setTimeout(() => setConfigSuccess(null), 5000);
    } catch (err: any) {
      const connectionHint = describeAdminApiConnectionIssue('/api/admin/config', err);
      setConfigError(connectionHint || err.message || 'Failed to save reminder thresholds');
      console.error('[GracePeriodConfig] Save error:', err);
    } finally {
      setConfigSaving(false);
    }
  };

  const formatPrice = (cents: number | null): string => {
    if (cents === null || cents === undefined) return '$0.00';
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadgeClass = (status: SubscriptionStatus): string => {
    const baseClass = 'px-2 py-1 text-xs font-semibold rounded-full';
    switch (status) {
      case 'active':
        return `${baseClass} bg-green-100 text-green-800`;
      case 'trial':
        return `${baseClass} bg-blue-100 text-blue-800`;
      case 'grace_period':
        return `${baseClass} bg-yellow-100 text-yellow-800`;
      case 'cancelled':
        return `${baseClass} bg-orange-100 text-orange-800`;
      case 'expired':
        return `${baseClass} bg-red-100 text-red-800`;
      case 'paused':
        return `${baseClass} bg-gray-100 text-gray-800`;
      default:
        return `${baseClass} bg-gray-100 text-gray-600`;
    }
  };

  const handleAdminAction = async (
    action: 'manually_cancel' | 'extend_trial' | 'reactivate',
    userId: string,
    additionalData?: { days?: number; reason?: string }
  ) => {
    const actionKey = `${action}-${userId}`;
    setActionInProgress(actionKey);
    setActionError(null);
    setActionSuccess(null);

    try {
      const actionEndpoint = buildAdminApiUrl('/api/admin/subscriptions/actions');
      const res = await fetch(actionEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({
          action,
          user_id: userId,
          ...additionalData,
        }),
      });

      const json = await res.json();
      
      if (!res.ok || json.error) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      setActionSuccess(json.message || 'Action completed successfully');
      setTimeout(() => setActionSuccess(null), 5000);
      
      // Reload subscriptions
      await loadSubscriptions();
    } catch (err: any) {
      const connectionHint = describeAdminApiConnectionIssue('/api/admin/subscriptions/actions', err);
      setActionError(connectionHint || err.message || 'Action failed');
      console.error('[AdminAction] Error:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const confirmCancelSubscription = (userId: string, userName: string) => {
    if (window.confirm(`Are you sure you want to manually cancel subscription for ${userName}?`)) {
      handleAdminAction('manually_cancel', userId, { reason: 'admin_override' });
    }
  };

  const confirmExtendTrial = (userId: string, userName: string) => {
    const daysStr = window.prompt(`Enter number of days to extend trial for ${userName}:`, '7');
    if (daysStr) {
      const days = parseInt(daysStr, 10);
      if (!isNaN(days) && days > 0 && days <= 90) {
        handleAdminAction('extend_trial', userId, { days });
      } else {
        alert('Invalid number of days. Must be between 1 and 90.');
      }
    }
  };

  const confirmReactivateSubscription = (userId: string, userName: string) => {
    if (window.confirm(`Are you sure you want to manually reactivate subscription for ${userName}? This will set status to active.`)) {
      handleAdminAction('reactivate', userId, { reason: 'admin_reactivation' });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">Subscription Management</h1>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8" data-testid="subscription-metrics">
          <div className="bg-white p-4 rounded-lg shadow border">
            <p className="text-sm text-gray-600 mb-1">MRR</p>
            <p className="text-2xl font-bold text-green-600" data-testid="metric-mrr">
              {formatPrice(metrics.mrr)}
            </p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow border">
            <p className="text-sm text-gray-600 mb-1">Active Subscribers</p>
            <p className="text-2xl font-bold" data-testid="metric-active">
              {metrics.activeSubscribers}
            </p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow border">
            <p className="text-sm text-gray-600 mb-1">Trial Users</p>
            <p className="text-2xl font-bold text-blue-600" data-testid="metric-trial">
              {metrics.trialUsers}
            </p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow border">
            <p className="text-sm text-gray-600 mb-1">Grace Period</p>
            <p className="text-2xl font-bold text-yellow-600" data-testid="metric-grace">
              {metrics.gracePeriodUsers}
            </p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow border">
            <p className="text-sm text-gray-600 mb-1">Churn Rate</p>
            <p className="text-2xl font-bold text-red-600" data-testid="metric-churn">
              {metrics.churnRate.toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* Grace Period Configuration */}
      <div className="bg-white p-6 rounded-lg shadow border mb-8" data-testid="grace-period-config">
        <h2 className="text-xl font-bold mb-4">Grace Period Configuration</h2>
        <p className="text-sm text-gray-600 mb-6">
          Configure grace period duration and reminder notification thresholds. Changes affect all users entering grace period after save.
        </p>

        {configSuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm" data-testid="config-success">
            ✓ {configSuccess}
          </div>
        )}

        {configError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm" data-testid="config-error">
            ✗ {configError}
          </div>
        )}        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Grace Period Days */}
          <div>
            <label htmlFor="grace-days-input" className="block text-sm font-medium text-gray-700 mb-2">
              Grace Period Days
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Number of days users have to re-subscribe before their Swap Points are deleted. Default: 90 days.
            </p>
            <div className="flex gap-2">
              <input
                id="grace-days-input"
                data-testid="grace-days-input"
                type="number"
                min="1"
                max="365"
                value={editGraceDays}
                onChange={(e) => setEditGraceDays(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={configSaving}
              />
              <button
                onClick={handleSaveGracePeriodDays}
                disabled={configSaving || editGraceDays === String(gracePeriodConfig.grace_period_days)}
                data-testid="save-grace-days-btn"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {configSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Current: {gracePeriodConfig.grace_period_days} days
            </p>
          </div>

          {/* Reminder Thresholds */}
          <div>
            <label htmlFor="reminder-thresholds-input" className="block text-sm font-medium text-gray-700 mb-2">
              Reminder Thresholds (days before expiry)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Comma-separated list of days when reminder notifications are sent. Example: 60, 30, 7, 1
            </p>
            <div className="flex gap-2">
              <input
                id="reminder-thresholds-input"
                data-testid="reminder-thresholds-input"
                type="text"
                value={editReminderThresholds}
                onChange={(e) => setEditReminderThresholds(e.target.value)}
                placeholder="60, 30, 7, 1"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={configSaving}
              />
              <button
                onClick={handleSaveReminderThresholds}
                disabled={configSaving}
                data-testid="save-reminder-thresholds-btn"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {configSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Current: {gracePeriodConfig.grace_reminder_thresholds.join(', ')}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow border mb-6">
        {actionSuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm" data-testid="action-success">
            ✓ {actionSuccess}
          </div>
        )}

        {actionError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm" data-testid="action-error">
            ✗ {actionError}
          </div>
        )}

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {['all', 'trial', 'active', 'grace_period', 'cancelled', 'expired', 'free'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                data-testid={`filter-${status}`}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </button>
            ))}
          </div>

          <form
            className="flex flex-wrap gap-2 items-center"
            onSubmit={handleSearchSubmit}
            aria-label="Search subscriptions"
          >
            <label htmlFor="subscription-search" className="sr-only">
              Search subscriptions by name, email, or user ID
            </label>
            <input
              id="subscription-search"
              data-testid="subscription-search-input"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name, email, or user ID"
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[220px]"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="subscription-search-submit"
            >
              Search
            </button>
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Clear
              </button>
            )}
          </form>
        </div>

        {searchTerm && (
          <p className="mt-2 text-xs text-gray-500">Showing results for &ldquo;{searchTerm}&rdquo;</p>
        )}
      </div>

      {/* Subscriptions Table */}
      {loading && (
        <div className="text-center py-12" data-testid="loading-state">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading subscriptions...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6" data-testid="error-state">
          <p className="text-red-800 font-medium">Error: {error}</p>
        </div>
      )}

      {!loading && !error && subscriptions.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-8 text-center" data-testid="empty-state">
          <p className="text-gray-600">No subscriptions found for the selected filter.</p>
        </div>
      )}

      {!loading && !error && subscriptions.length > 0 && (
        <div className="bg-white rounded-lg shadow border overflow-x-auto" data-testid="subscriptions-table">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Period End
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Grace Ends
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {subscriptions.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">
                      {sub.profile?.display_name || sub.user_id?.substring(0, 8) || 'No Name'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {sub.profile?.email || 'No Email'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-gray-500" data-testid={`user-id-${sub.user_id}`}>
                      {sub.user_id}
                    </p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={getStatusBadgeClass(sub.status)}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {sub.display_price_cents !== null && sub.display_price_cents !== undefined
                      ? formatPrice(sub.display_price_cents)
                      : (sub.tier?.display_name || 'N/A')
                    }
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      {sub.status === 'trial' && (
                        <button
                          onClick={() => confirmExtendTrial(sub.user_id, sub.profile?.display_name || 'User')}
                          disabled={actionInProgress === `extend_trial-${sub.user_id}`}
                          data-testid={`btn-extend-trial-${sub.user_id}`}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionInProgress === `extend_trial-${sub.user_id}` ? 'Processing...' : 'Extend Trial'}
                        </button>
                      )}
                      
                      {['active', 'trial'].includes(sub.status) && (
                        <button
                          onClick={() => confirmCancelSubscription(sub.user_id, sub.profile?.display_name || 'User')}
                          disabled={actionInProgress === `manually_cancel-${sub.user_id}`}
                          data-testid={`btn-cancel-${sub.user_id}`}
                          className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionInProgress === `manually_cancel-${sub.user_id}` ? 'Processing...' : 'Cancel'}
                        </button>
                      )}
                      
                      {['cancelled', 'grace_period', 'expired', 'paused'].includes(sub.status) && (
                        <button
                          onClick={() => confirmReactivateSubscription(sub.user_id, sub.profile?.display_name || 'User')}
                          disabled={actionInProgress === `reactivate-${sub.user_id}`}
                          data-testid={`btn-reactivate-${sub.user_id}`}
                          className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionInProgress === `reactivate-${sub.user_id}` ? 'Processing...' : 'Reactivate'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {sub.current_period_end || sub.trial_end_date || sub.trial_ends_at
                      ? formatDate(sub.current_period_end || sub.trial_end_date || sub.trial_ends_at)
                      : 'N/A'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {sub.grace_ends_at ? formatDate(sub.grace_ends_at) : (sub.status === 'grace_period' ? 'TBD' : 'N/A')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {formatDate(sub.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
