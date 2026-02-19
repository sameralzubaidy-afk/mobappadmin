'use client';

import { useState, useEffect } from 'react';

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

export default function CronMonitoringPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'jobs' | 'runs'>('jobs');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [lookbackHours, setLookbackHours] = useState(48);

  useEffect(() => {
    fetchData();
  }, [timezone, lookbackHours]);

  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      // Fetch jobs
      const jobsRes = await fetch(
        `/api/admin/cron-jobs?includeInactive=true&timezone=${encodeURIComponent(timezone)}`
      );
      if (!jobsRes.ok) throw new Error(`Failed to fetch jobs: ${jobsRes.statusText}`);
      const jobsData = await jobsRes.json();
      setJobs(jobsData.data || []);

      // Fetch runs
      const runsRes = await fetch(
        `/api/admin/cron-runs?lookbackHours=${lookbackHours}&limit=500&timezone=${encodeURIComponent(timezone)}`
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
            <option>America/Los_Angeles</option>
            <option>America/New_York</option>
            <option>America/Chicago</option>
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

      {/* Jobs Tab */}
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
                jobs.map((job) => (
                  <tr key={job.jobid} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{job.jobname}</div>
                      <div className="text-xs text-gray-500 mt-1 max-w-md truncate">
                        {job.command}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600">{job.schedule}</td>
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

      {/* Footer */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-900">
          <strong>Timezone:</strong> Currently showing times in <strong>{timezone}</strong>. Adjust timezone selector to view times in your local timezone.
        </p>
      </div>
    </div>
  );
}
