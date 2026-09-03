// File: p2p-kids-admin/src/app/components/IDBadgeAnalytics.tsx
'use client';

import React, { useEffect, useState } from 'react';

interface IDBadgeStats {
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  avg_review_time_hours: number;
  approval_rate: number;
}

const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '';

export default function IDBadgeAnalytics() {
  const [stats, setStats] = useState<IDBadgeStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/admin/id-badges/stats', {
          cache: 'no-store',
          headers: { 'x-admin-secret': adminSecret },
        });
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching ID badge stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) return <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">Loading ID Badge Stats...</div>;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">🪪 ID Badge Analytics</h2>
        <a href="/id-badges" className="text-blue-600 text-sm hover:underline">
          View Queue &rarr;
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg">
          <p className="text-sm text-yellow-600 font-medium mb-1">Pending Approval</p>
          <p className="text-2xl font-bold text-yellow-800">{stats?.pending_count || 0}</p>
        </div>

        <div className="p-4 bg-green-50 border border-green-100 rounded-lg">
          <p className="text-sm text-green-600 font-medium mb-1">Total Approved</p>
          <p className="text-2xl font-bold text-green-800">{stats?.approved_count || 0}</p>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-sm text-blue-600 font-medium mb-1">Approval Rate</p>
          <p className="text-2xl font-bold text-blue-800">{stats?.approval_rate.toFixed(1) || 0}%</p>
        </div>

        <div className="p-4 bg-primary-50 border border-primary-100 rounded-lg">
          <p className="text-sm text-primary-600 font-medium mb-1">Avg Review Time</p>
          <p className="text-2xl font-bold text-primary-800">{stats?.avg_review_time_hours.toFixed(1) || 0}h</p>
        </div>
      </div>
    </div>
  );
}
