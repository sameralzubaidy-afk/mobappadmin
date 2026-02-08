// File: p2p-kids-admin/src/app/id-badges/page.tsx
// TASK BADGE-010: Admin ID Badge Queue Page
// Module: MODULE-10-ID-BADGE-VERIFICATION-V2.md

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface IDVerificationRequest {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  node_id: string;
  nodes?: { zip_code: string };
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason?: string;
  rejection_notes?: string;
  approval_notes?: string;
}

interface Stats {
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  avg_review_time_hours: number;
  approval_rate: number;
}

export default function IDBadgeQueuePage() {
  const [requests, setRequests] = useState<IDVerificationRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadRequests();
    loadStats();
  }, [filter]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/admin/id-badges?${params}`, {
        cache: 'no-store'
      });
      const data = await response.json();
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/id-badges/stats', {
        cache: 'no-store'
      });
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimeout) clearTimeout(searchTimeout);
    
    const timeout = setTimeout(() => {
      loadRequests();
    }, 300);
    setSearchTimeout(timeout);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString() + ' ' +
           new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">ID Badge Verification</h1>

      {/* Stats Section */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
            <p className="text-sm text-gray-600">Pending Review</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending_count}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded p-4">
            <p className="text-sm text-gray-600">Approved</p>
            <p className="text-2xl font-bold text-green-600">{stats.approved_count}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <p className="text-sm text-gray-600">Rejected</p>
            <p className="text-2xl font-bold text-red-600">{stats.rejected_count}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <p className="text-sm text-gray-600">Avg Review Time</p>
            <p className="text-2xl font-bold text-blue-600">{stats.avg_review_time_hours.toFixed(1)}h</p>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="mb-6 flex gap-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1 px-4 py-2 border rounded"
        />
      </div>

      <div className="mb-4 flex gap-2">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded font-medium ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Requests Table */}
      <div className="overflow-x-auto border rounded">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Node</th>
              <th className="px-4 py-3 text-left">Submitted</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-3 text-center">
                  Loading...
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-3 text-center text-gray-500">
                  No requests found
                </td>
              </tr>
            ) : (
              requests.map((req) => (
                <tr key={req.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {req.first_name} {req.last_name}
                  </td>
                  <td className="px-4 py-3">{req.email}</td>
                  <td className="px-4 py-3">{req.phone_number || '-'}</td>
                  <td className="px-4 py-3">{req.nodes?.zip_code || '-'}</td>
                  <td className="px-4 py-3">{formatDate(req.submitted_at)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        req.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : req.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {req.status === 'pending' ? (
                      <Link
                        href={`/id-badges/${req.id}/review`}
                        className="text-blue-600 hover:underline"
                      >
                        Review
                      </Link>
                    ) : (
                      <Link
                        href={`/id-badges/${req.id}/details`}
                        className="text-gray-600 hover:underline"
                      >
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
