// File: p2p-kids-admin/src/app/disputes/page.tsx
// TFV2-017: Admin Disputes Queue — shows all trades in dispute_status IN ('reported', 'under_review')

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Suspense } from 'react';
import DisputeFilters from './DisputeFilters';

type Props = {
  searchParams: {
    status?: string;
  };
};

type DisputeTrade = {
  id: string;
  dispute_status: string;
  dispute_reason: string | null;
  dispute_opened_at: string | null;
  status: string;
  buyer_id: string;
  seller_id: string;
  listing?: { title: string | null; price: number | null } | null;
};

function getSLAHours(reportedAt: string | null): number {
  if (!reportedAt) return 0;
  return Math.round((Date.now() - new Date(reportedAt).getTime()) / (1000 * 60 * 60));
}

export default async function DisputesPage({ searchParams }: Props) {
  const statusFilter = searchParams.status || 'all';

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return <div className="p-6 text-red-600">Missing server configuration</div>;
  }

  let url = `${SUPABASE_URL}/rest/v1/trades?select=id,dispute_status,dispute_reason,dispute_opened_at,status,buyer_id,seller_id,listing:items(title,price)&order=dispute_opened_at.asc`;

  if (statusFilter === 'all') {
    // reported OR under_review
    url += '&or=(dispute_status.eq.reported,dispute_status.eq.under_review)';
  } else {
    url += `&dispute_status=eq.${statusFilter}`;
  }

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const disputes: DisputeTrade[] = res.ok ? await res.json() : [];

  const reportedCount = disputes.filter((d) => d.dispute_status === 'reported').length;
  const underReviewCount = disputes.filter((d) => d.dispute_status === 'under_review').length;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Disputes Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            {disputes.length} active dispute{disputes.length !== 1 ? 's' : ''} —{' '}
            <span className="text-orange-600 font-medium">{reportedCount} reported</span>,{' '}
            <span className="text-yellow-700 font-medium">{underReviewCount} under review</span>
          </p>
        </div>
      </div>

      <Suspense>
        <DisputeFilters initialStatus={statusFilter} />
      </Suspense>

      {disputes.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          No disputes found for the selected filter.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Trade ID</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Item</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Reported (age)</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {disputes.map((d) => {
                const slaHours = getSLAHours(d.dispute_opened_at);
                const slaBreached = slaHours > 24;
                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {d.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {d.listing?.title ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {d.dispute_reason ?? '—'}
                    </td>
                    <td className={`px-4 py-3 font-medium ${slaBreached ? 'text-red-600' : 'text-gray-600'}`}>
                      {slaHours}h ago
                      {slaBreached && (
                        <span className="ml-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">SLA!</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          d.dispute_status === 'under_review'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {d.dispute_status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/disputes/${d.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
