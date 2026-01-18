'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SubReport {
  id: string;
  reporter_id: string;
  reason: string;
  description: string | null;
  created_at: string;
}

interface ReviewReport {
  id: string; // This is the review_id we use as a key
  review_id: string;
  report_count: number;
  is_hidden: boolean;
  created_at: string;
  review?: {
    id: string;
    reviewee_id: string;
    reviewer_id: string;
    rating: number;
    comment: string;
  };
  reports: SubReport[];
}

export default function ReviewModerationPage() {
  const [reports, setReports] = useState<ReviewReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReportedReviews();
  }, []);

  const fetchReportedReviews = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/reviews/reported', {
        cache: 'no-store', // Extra insurance against browser caching
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch reported reviews');
      }
      
      const data = await response.json();
      setReports(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const hideReview = async (reviewId: string) => {
    if (!confirm('Are you sure you want to hide this review?')) return;
    
    try {
      const response = await fetch(`/api/reviews/${reviewId}/hide`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to hide review');
      }
      
      // Update local state to reflect the hidden status immediately
      setReports(prevReports =>
        prevReports.map(r =>
          r.review_id === reviewId ? { ...r, is_hidden: true } : r
        )
      );
    } catch (err) {
      alert('Error hiding review: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const approveReport = async (reviewId: string) => {
    if (!confirm('This will unhide the review and delete all associated reports. Continue?')) return;

    try {
      const response = await fetch(`/api/reviews/${reviewId}/approve`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to approve review');
      }
      
      // Update local state to reflect the approved status immediately
      setReports(prevReports =>
        prevReports.map(r =>
          r.review_id === reviewId
            ? { ...r, is_hidden: false, report_count: 0, reports: [] }
            : r
        )
      );
    } catch (err) {
      alert('Error approving review: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const formatReason = (reason: string) => {
    switch (reason) {
      case 'spam': return 'Spam';
      case 'offensive': return 'Offensive Content';
      case 'false_info': return 'False Information';
      default: return reason.charAt(0).toUpperCase() + reason.slice(1);
    }
  };

  const getUniqueReasons = (subReports: SubReport[]) => {
    const reasons = Array.from(new Set(subReports.map(r => r.reason)));
    return reasons.map(r => formatReason(r)).join(', ');
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <Link href="/" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to Dashboard
        </Link>
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-bold mb-2">Review Moderation</h1>
            <p className="text-gray-600">
              Review and moderate reported reviews from the community.
            </p>
          </div>
          <p className="text-sm font-medium text-gray-500">{reports.length} reviews flagged</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading reported reviews...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
          <button
            onClick={fetchReportedReviews}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <p className="text-green-800 font-semibold">✓ No reported reviews</p>
          <p className="text-green-700 text-sm mt-1">All reviews are following community guidelines.</p>
        </div>
      ) : (
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Review Content
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Reports
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Reasons
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reports.map((group) => (
                  <tr key={group.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      {group.review ? (
                        <div className="max-w-md">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-yellow-500 font-bold text-sm">★</span>
                            <span className="font-bold text-gray-900 text-sm">{group.review.rating}/5</span>
                          </div>
                          <p className="text-gray-700 text-sm italic line-clamp-3">"{group.review.comment}"</p>
                          <p className="text-[10px] text-gray-400 mt-1">ID: {group.review_id}</p>
                        </div>
                      ) : (
                        <span className="text-red-500 italic text-sm">Review content missing (ID: {group.review_id})</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                        🚩 {group.report_count}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 max-w-xs">
                        {group.reports.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {Array.from(new Set(group.reports.map(r => r.reason))).map((reason, idx) => (
                              <span key={idx} className="bg-gray-100 px-2 py-0.5 rounded text-[11px] font-medium">
                                {formatReason(reason)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">No reasons logged</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {group.is_hidden ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                          Hidden
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                          Visible
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => approveReport(group.review_id)}
                          className="text-green-600 hover:text-green-900 bg-green-50 px-3 py-1.5 rounded-md transition-colors"
                          title="Approve Review (Dismiss Reports)"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => hideReview(group.review_id)}
                          className="text-red-600 hover:text-red-900 bg-red-50 px-3 py-1.5 rounded-md transition-colors"
                          title="Delete/Hide Review"
                        >
                          Delete/Hide
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
