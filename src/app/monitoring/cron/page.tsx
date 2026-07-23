'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Cron job descriptions (source of truth for the Info tab) ──────────────
const CRON_JOB_INFO: Record<string, { description: string }> = {
  'award-tenure-badges-daily': {
    description: 'Awards subscription tenure badges based on days since subscription creation.',
  },
  'trial-reminders-daily': {
    description: 'Sends daily trial reminder notifications to users whose trial is expiring.',
  },
  'trial-conversion-daily': {
    description: 'Checks for expired trials and converts/downgrades subscriptions accordingly.',
  },
  'check-offer-timeouts': {
    description: 'Expires stale pending trade offers that have exceeded the 24h offer window.',
  },
  'trade-notifications': {
    description: 'Checks for notification-eligible trades and sends push/email notifications.',
  },
  'cpsc-daily-import': {
    description: 'Fetches daily recall data from the CPSC API to flag unsafe items.',
  },
  'process-expired-offers': {
    description: 'Auto-declines competing offers when one offer is accepted, and cleans up expired offers.',
  },
  'auto-complete': {
    description: 'Auto-completes eligible in-progress trades after the configured window.',
  },
  'release-pending-sp': {
    description: 'Releases pending SP to seller wallets after the configured release delay.',
  },
  'grace-period-cron': {
    description: 'Checks grace periods for cancelled subscriptions and sends reminders.',
  },
  'cleanup-expired-reset-tokens': {
    description: 'Marks expired password reset tokens as used.',
  },
  'mark-expired-referrals': {
    description: 'Marks referrals older than 60 days as expired.',
  },
  'cleanup-expired-sessions': {
    description: 'Marks expired auth sessions as expired.',
  },
  'expire-saved-carts': {
    description: 'Auto-expires saved carts based on configured expiry days.',
  },
  'send-message-emails': {
    description: 'Sends email notifications for unread messages.',
  },
  'message-cleanup': {
    description: 'Cleans up old message history to manage database size.',
  },
  'process_sp_expiration': {
    description: 'Expires SP batches past their expiration date and updates wallet balances.',
  },
};

// ── Cron expression helpers ───────────────────────────────────────────────

/** Parse a cron expression into human-readable frequency text. */
function describeCronSchedule(schedule: string): string {
  if (!schedule) return '—';
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return schedule;

  const [min, hour, dom, , dow] = parts;

  // Every N minutes: */N * * * *
  if (min.startsWith('*/') && hour === '*' && dom === '*' && dow === '*') {
    const n = parseInt(min.slice(2), 10);
    if (n === 5) return 'Every 5 minutes';
    if (n === 10) return 'Every 10 minutes';
    if (n === 15) return 'Every 15 minutes';
    if (n === 30) return 'Every 30 minutes';
    return `Every ${n} minutes`;
  }

  // Every N hours: 0 */N * * *
  if (min === '0' && hour.startsWith('*/') && dom === '*' && dow === '*') {
    const n = parseInt(hour.slice(2), 10);
    if (n === 1) return 'Every hour';
    if (n === 2) return 'Every 2 hours';
    if (n === 6) return 'Every 6 hours';
    if (n === 12) return 'Every 12 hours';
    if (n === 24) return 'Daily';
    return `Every ${n} hours`;
  }

  // Every hour on specific minute: N * * * *
  if (!min.includes('*') && min !== '0' && hour === '*' && dom === '*' && dow === '*') {
    return `At minute ${min} past every hour`;
  }

  // Daily at specific time: N H * * *
  if (!min.includes('*') && !hour.includes('*') && dom === '*' && dow === '*') {
    const h = parseInt(hour, 10);
    const m = parseInt(min, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const minStr = m > 0 ? `:${m.toString().padStart(2, '0')}` : '';
    return `Daily at ${h12}${minStr} ${ampm} UTC`;
  }

  return schedule;
}

/** Parse cron expression into { minutes, hours, days } fields for editing. */
function parseCronToFields(schedule: string): { preset: string; minutes: string; hours: string; days: string } {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return { preset: 'custom', minutes: '*', hours: '*', days: '*' };

  const [min, hour, dom] = parts;

  // Every N minutes
  if (min.startsWith('*/') && hour === '*' && dom === '*') {
    return { preset: 'every-n-minutes', minutes: min.slice(2), hours: '*', days: '*' };
  }

  // Every N hours
  if (min === '0' && hour.startsWith('*/') && dom === '*') {
    return { preset: 'every-n-hours', minutes: '0', hours: hour.slice(2), days: '*' };
  }

  // Daily at specific time
  if (dom === '*' && !hour.includes('*') && !min.includes('*')) {
    return { preset: 'daily', minutes: min, hours: hour, days: dom };
  }

  return { preset: 'custom', minutes: min, hours: hour, days: dom };
}

/** Build a cron expression from fields. */
function buildCronFromFields(preset: string, minutes: string, hours: string, days: string): string {
  switch (preset) {
    case 'every-n-minutes':
      return `*/${minutes} * * * *`;
    case 'every-n-hours':
      return `0 */${hours} * * *`;
    case 'daily':
      return `${minutes} ${hours} * * *`;
    default:
      return `${minutes} ${hours} ${days} * *`;
  }
}

// ── Preset options for the edit modal ─────────────────────────────────────
const SCHEDULE_PRESETS = [
  { value: 'every-n-minutes', label: 'Every N minutes' },
  { value: 'every-n-hours', label: 'Every N hours' },
  { value: 'daily', label: 'Daily at specific time' },
  { value: 'custom', label: 'Custom (5-field cron)' },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  command: string;
  active: boolean;
  last_status: string;
  last_return_message: string | null;
  last_start_time_utc: string | null;
  last_start_time_local: string | null;
  has_recent_run: boolean;
  appears_future_in_local_time: boolean;
}

interface CronRun {
  jobid: number;
  runid: number;
  status: string;
  return_message: string | null;
  start_time_utc: string;
  start_time_local: string;
  jobname: string;
  schedule: string;
}

const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '';

export default function CronMonitoringPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [timezone, setTimezone] = useState('America/New_York');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'jobs' | 'runs' | 'info'>('jobs');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [lookbackHours, setLookbackHours] = useState(48);

  // Edit modal state
  const [editJob, setEditJob] = useState<CronJob | null>(null);
  const [editPreset, setEditPreset] = useState<string>('every-n-minutes');
  const [editMinutes, setEditMinutes] = useState('*');
  const [editHours, setEditHours] = useState('*');
  const [editDays, setEditDays] = useState('*');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  // Run-now state
  const [runningJobId, setRunningJobId] = useState<number | null>(null);
  const [runResult, setRunResult] = useState<{ jobid: number; success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, [timezone, lookbackHours]);

  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      // Fetch jobs
      const jobsRes = await fetch(
        `/api/admin/cron-jobs?includeInactive=true&timezone=${encodeURIComponent(timezone)}`,
        { headers: { 'x-admin-secret': adminSecret } }
      );
      if (!jobsRes.ok) throw new Error(`Failed to fetch jobs: ${jobsRes.statusText}`);
      const jobsData = await jobsRes.json();
      setJobs(jobsData.data || []);

      // Fetch runs
      const runsRes = await fetch(
        `/api/admin/cron-runs?lookbackHours=${lookbackHours}&limit=500&timezone=${encodeURIComponent(timezone)}`,
        { headers: { 'x-admin-secret': adminSecret } }
      );
      if (!runsRes.ok) throw new Error(`Failed to fetch runs: ${runsRes.statusText}`);
      const runsData = await runsRes.json();
      setRuns(runsData.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load cron data');
    } finally {
      setLoading(false);
    }
  }

  // ── Edit modal handlers ────────────────────────────────────────────────

  function openEditModal(job: CronJob) {
    const fields = parseCronToFields(job.schedule);
    setEditJob(job);
    setEditPreset(fields.preset);
    setEditMinutes(fields.minutes);
    setEditHours(fields.hours);
    setEditDays(fields.days);
    setEditError(null);
    setEditSuccess(null);
    setEditSaving(false);
  }

  function closeEditModal() {
    setEditJob(null);
    setEditError(null);
    setEditSuccess(null);
    setEditSaving(false);
  }

  async function saveEditSchedule() {
    if (!editJob) return;

    setEditSaving(true);
    setEditError(null);
    setEditSuccess(null);

    try {
      const newSchedule = buildCronFromFields(editPreset, editMinutes, editHours, editDays);

      const res = await fetch(`/api/admin/cron-jobs/${editJob.jobid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({ schedule: newSchedule }),
      });

      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.error || `Failed to update (${res.status})`);
      }

      setEditSuccess(`Schedule updated to "${newSchedule}" — will apply on next cron cycle.`);

      // Refresh the job list so the new schedule shows immediately
      const jobsRes = await fetch(
        `/api/admin/cron-jobs?includeInactive=true&timezone=${encodeURIComponent(timezone)}`,
        { headers: { 'x-admin-secret': adminSecret } }
      );
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobs(jobsData.data || []);
      }

      // Auto-close after 2 seconds on success
      setTimeout(closeEditModal, 2000);
    } catch (err: any) {
      setEditError(err.message || 'Failed to save schedule');
    } finally {
      setEditSaving(false);
    }
  }

  // ── Run-now handler ────────────────────────────────────────────────────

  async function runJobNow(job: CronJob) {
    setRunningJobId(job.jobid);
    setRunResult(null);

    try {
      const res = await fetch(`/api/admin/cron-jobs/${job.jobid}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({ action: 'run-now' }),
      });

      const body = await res.json();
      const nowStr = new Date().toISOString();

      if (!res.ok) {
        setRunResult({ jobid: job.jobid, success: false, message: body.error || `Failed (${res.status})` });
      } else {
        const result = body.data || {};
        const detail = result.result || 'triggered';
        setRunResult({
          jobid: job.jobid,
          success: true,
          message: `"${job.jobname}" — ${detail}`,
        });

        // Optimistically update the job's status in local state so the table
        // reflects the trigger immediately. We do NOT auto-refresh because
        // net.http_post is async — the job_run_details entry won't update
        // until the Edge Function call completes, so a server refresh would
        // overwrite our optimistic update with the previous stale run.
        setJobs((prev) =>
          prev.map((j) =>
            j.jobid === job.jobid
              ? {
                  ...j,
                  last_status: 'succeeded',
                  last_return_message: detail,
                  last_start_time_utc: nowStr,
                  last_start_time_local: nowStr,
                  has_recent_run: true,
                }
              : j
          )
        );

      }
    } catch (err: any) {
      setRunResult({ jobid: job.jobid, success: false, message: err.message || 'Network error' });
    } finally {
      setRunningJobId(null);
    }

    // Auto-dismiss the result toast after 6 seconds
    setTimeout(() => setRunResult(null), 6000);
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">✓ Succeeded</span>;
      case 'failed':
        return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded">✗ Failed</span>;
      case 'never_run':
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded">○ Never Run</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded">{status}</span>;
    }
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '—';
    return new Date(timestamp).toLocaleString();
  };

  // Filter runs by status
  const filteredRuns = statusFilter === 'all'
    ? runs
    : runs.filter(run => run.status === statusFilter);

  // Get unique statuses from runs
  const uniqueStatuses = Array.from(new Set(runs.map(r => r.status)));

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">⏰ Cron Jobs Monitoring</h1>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading cron monitoring data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">⏰ Cron Jobs Monitoring</h1>
      <p className="text-gray-600 mb-6">
        View scheduled task status and recent execution history.
      </p>

      {/* Controls */}
      <div className="mb-6 flex gap-4 flex-wrap items-end">
        {/* Timezone Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option>UTC</option>
            <option>America/New_York</option>
            <option>America/Chicago</option>
            <option>America/Los_Angeles</option>
            <option>Europe/London</option>
            <option>Asia/Tokyo</option>
          </select>
        </div>

        {/* Time Period Shortcuts */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
          <div className="flex gap-2">
            <button
              onClick={() => setLookbackHours(24)}
              className={`px-3 py-2 text-sm rounded-md font-medium transition-colors ${
                lookbackHours === 24
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setLookbackHours(7 * 24)}
              className={`px-3 py-2 text-sm rounded-md font-medium transition-colors ${
                lookbackHours === 7 * 24
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Last 7d
            </button>
            <button
              onClick={() => setLookbackHours(14 * 24)}
              className={`px-3 py-2 text-sm rounded-md font-medium transition-colors ${
                lookbackHours === 14 * 24
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Last 14d
            </button>
            <button
              onClick={() => setLookbackHours(30 * 24)}
              className={`px-3 py-2 text-sm rounded-md font-medium transition-colors ${
                lookbackHours === 30 * 24
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Last 30d
            </button>
            <button
              onClick={() => setLookbackHours(365 * 24)}
              className={`px-3 py-2 text-sm rounded-md font-medium transition-colors ${
                lookbackHours === 365 * 24
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
          </div>
        </div>

        {/* Status Filter (only shown on Runs tab) */}
        {activeTab === 'runs' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Statuses</option>
              {uniqueStatuses.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('info')}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'info'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Info ({jobs.length})
        </button>
        <button
          onClick={() => setActiveTab('jobs')}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'jobs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Jobs ({jobs.length})
        </button>
        <button
          onClick={() => setActiveTab('runs')}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'runs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Recent Runs ({filteredRuns.length})
        </button>
      </div>

      {/* Info Tab — job descriptions + frequency */}
      {activeTab === 'info' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Job Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">What It Does</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Frequency</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Schedule</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Status</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-600">
                    No cron jobs found
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const info = CRON_JOB_INFO[job.jobname];
                  return (
                    <tr key={job.jobid} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{job.jobname}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-md">
                        {info?.description || (
                          <span className="text-gray-400 italic">No description available</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {describeCronSchedule(job.schedule)}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-500">
                        {job.schedule}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(job.last_status)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Jobs Tab — raw table with edit */}
      {activeTab === 'jobs' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Job Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Schedule</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Last Run (Local)</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Active</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-600">
                    No cron jobs found
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.jobid} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{job.jobname}</div>
                      <div className="text-xs text-gray-500 mt-1 max-w-md truncate">
                        {job.command}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-mono text-gray-600">{job.schedule}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {describeCronSchedule(job.schedule)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(job.last_status)}
                        {job.appears_future_in_local_time && (
                          <span title="Timestamp appears to be in the future (UTC/TZ mismatch?)" className="text-orange-600">
                            ⚠️
                          </span>
                        )}
                      </div>
                      {job.last_return_message && (
                        <div className="text-xs text-gray-500 mt-1">{job.last_return_message}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {formatTime(job.last_start_time_local)}
                    </td>
                    <td className="px-4 py-3">
                      {job.active ? (
                        <span className="text-green-600 font-medium">✓ Yes</span>
                      ) : (
                        <span className="text-gray-400">⊘ No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {job.active ? (
                          <>
                            <button
                              onClick={() => runJobNow(job)}
                              disabled={runningJobId === job.jobid}
                              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                                runningJobId === job.jobid
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-green-50 text-green-700 hover:bg-green-100'
                              }`}
                              title="Run this job immediately, outside its scheduled interval"
                            >
                              {runningJobId === job.jobid ? (
                                <><span className="inline-block w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></span> Running...</>
                              ) : (
                                <><span>▶</span> Run Now</>
                              )}
                            </button>
                            <button
                              onClick={() => openEditModal(job)}
                              className="px-3 py-1.5 text-xs font-medium rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                              ✏️ Schedule
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Runs Tab */}
      {activeTab === 'runs' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Job</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Start Time (Local)</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Message</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-600">
                    No cron runs found in the last 48 hours
                  </td>
                </tr>
              ) : (
                filteredRuns.map((run) => (
                  <tr key={`${run.jobid}-${run.runid}`} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{run.jobname}</div>
                      <div className="text-xs text-gray-500">ID: {run.jobid}</div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(run.status)}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {formatTime(run.start_time_local)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {run.return_message || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Run-Now Result Toast ──────────────────────────────────────────── */}
      {runResult && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm">
          <div
            className={`p-4 rounded-lg shadow-lg border text-sm ${
              runResult.success
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">{runResult.success ? '✅' : '❌'}</span>
              <div className="flex-1">
                <p className="font-medium">{runResult.success ? 'Job Triggered' : 'Failed to Run'}</p>
                <p className="text-xs mt-0.5 opacity-80">{runResult.message}</p>
              </div>
              <button
                onClick={() => setRunResult(null)}
                className="text-current opacity-50 hover:opacity-100 text-lg leading-none"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Schedule Modal ─────────────────────────────────────────── */}
      {editJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Edit Schedule</h2>
              <button
                onClick={closeEditModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            {/* Job name (read-only) */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Job
              </label>
              <p className="text-sm font-medium text-gray-900">{editJob.jobname}</p>
              <p className="text-xs text-gray-500 mt-0.5 font-mono truncate">{editJob.command}</p>
            </div>

            {/* Current schedule (read-only) */}
            <div className="mb-4 p-3 bg-gray-50 rounded-md">
              <span className="text-xs font-medium text-gray-500">Current schedule: </span>
              <span className="text-sm font-mono font-medium text-gray-800">{editJob.schedule}</span>
              <span className="text-sm text-gray-500 ml-2">
                ({describeCronSchedule(editJob.schedule)})
              </span>
            </div>

            {/* Preset selector */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Schedule Type
              </label>
              <select
                value={editPreset}
                onChange={(e) => setEditPreset(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {SCHEDULE_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Fields based on preset */}
            {editPreset === 'every-n-minutes' && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Every N minutes
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Every</span>
                  <input
                    type="number"
                    min={1}
                    max={59}
                    value={editMinutes}
                    onChange={(e) => setEditMinutes(e.target.value)}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm text-center"
                  />
                  <span className="text-sm text-gray-600">minutes</span>
                </div>
                <div className="mt-2 flex gap-2">
                  {[5, 10, 15, 30].map((n) => (
                    <button
                      key={n}
                      onClick={() => setEditMinutes(String(n))}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        editMinutes === String(n)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {n}min
                    </button>
                  ))}
                </div>
              </div>
            )}

            {editPreset === 'every-n-hours' && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Every N hours
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Every</span>
                  <input
                    type="number"
                    min={1}
                    max={23}
                    value={editHours}
                    onChange={(e) => setEditHours(e.target.value)}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm text-center"
                  />
                  <span className="text-sm text-gray-600">hours</span>
                </div>
                <div className="mt-2 flex gap-2">
                  {[1, 2, 6, 12].map((n) => (
                    <button
                      key={n}
                      onClick={() => setEditHours(String(n))}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        editHours === String(n)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {n}h
                    </button>
                  ))}
                </div>
              </div>
            )}

            {editPreset === 'daily' && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Daily at specific time (UTC)
                </label>
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">Hour (0-23)</span>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={editHours}
                      onChange={(e) => setEditHours(e.target.value)}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm text-center"
                    />
                  </div>
                  <span className="text-lg text-gray-400 mt-5">:</span>
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">Minute (0-59)</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={editMinutes}
                      onChange={(e) => setEditMinutes(e.target.value)}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm text-center"
                    />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {[
                    { label: 'Midnight', h: '0', m: '0' },
                    { label: '2 AM', h: '2', m: '0' },
                    { label: '6 AM', h: '6', m: '0' },
                    { label: '10 AM', h: '10', m: '0' },
                    { label: 'Noon', h: '12', m: '0' },
                  ].map((p) => (
                    <button
                      key={p.label}
                      onClick={() => { setEditHours(p.h); setEditMinutes(p.m); }}
                      className={`px-2 py-1 text-xs rounded-full transition-colors ${
                        editHours === p.h && editMinutes === p.m
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {editPreset === 'custom' && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Custom Cron Expression
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Format: <code className="bg-gray-100 px-1 rounded">minute hour day month weekday</code>
                  {' '}(<code className="bg-gray-100 px-1 rounded">*</code> = any)
                </p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <span className="text-[10px] text-gray-500 block">Min</span>
                    <input
                      value={editMinutes}
                      onChange={(e) => setEditMinutes(e.target.value)}
                      className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm font-mono text-center"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] text-gray-500 block">Hour</span>
                    <input
                      value={editHours}
                      onChange={(e) => setEditHours(e.target.value)}
                      className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm font-mono text-center"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] text-gray-500 block">Day</span>
                    <input
                      value={editDays}
                      onChange={(e) => setEditDays(e.target.value)}
                      className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm font-mono text-center"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Preview */}
            <div className="mb-5 p-3 bg-gray-50 rounded-md">
              <span className="text-xs font-medium text-gray-500">New schedule: </span>
              <span className="text-sm font-mono font-bold text-gray-900">
                {buildCronFromFields(editPreset, editMinutes, editHours, editDays)}
              </span>
              <span className="text-sm text-gray-500 ml-2">
                ({describeCronSchedule(buildCronFromFields(editPreset, editMinutes, editHours, editDays))})
              </span>
            </div>

            {/* Error / Success messages */}
            {editError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">{editError}</p>
              </div>
            )}
            {editSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-700">{editSuccess}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={closeEditModal}
                disabled={editSaving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEditSchedule}
                disabled={editSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {editSaving && (
                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                )}
                {editSaving ? 'Saving...' : '💾 Save Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-900">
          <strong>Timezone:</strong> All timestamps shown in <strong>{timezone}</strong> (default EST). Use the timezone selector above to switch.
        </p>
      </div>
    </div>
  );
}
