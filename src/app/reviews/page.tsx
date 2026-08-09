'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SubReport {
  id: string;
  reporter_id: string;
  reporter_name: string | null;
  reason: string;
  description: string | null;
  created_at: string;
}

interface ReviewReport {
  id: string; // This is the review_id we use as a key
  review_id: string;
  report_count: number;
  is_hidden: boolean;
  review_status: string; // active | pending_review | reviewed | hidden
  created_at: string;
  review?: {
    id: string;
    reviewee_id: string;
    reviewer_id: string;
    reviewer_name: string | null;
    reviewer_avatar_url: string | null;
    reviewee_name: string | null;
    reviewee_avatar_url: string | null;
    rating: number;
    comment: string;
    is_anonymous: boolean;
    created_at: string;
  };
  reports: SubReport[];
}

type ReasonFilter = 'all' | 'spam' | 'offensive' | 'false_info' | 'other';
type StatusFilter = 'all' | 'pending_review' | 'reviewed' | 'hidden' | 'visible';
type SortKey = 'reports' | 'newest' | 'oldest';

const ITEMS_PER_PAGE = 10;

const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '';

export default function ReviewModerationPage() {
  const [reports, setReports] = useState<ReviewReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('reports');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);

  useEffect(() => {
    fetchReportedReviews();
  }, []);

  const fetchReportedReviews = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/reviews/reported', {
        cache: 'no-store', // Extra insurance against browser caching
        headers: {
          'Cache-Control': 'no-cache',
          'x-admin-secret': adminSecret,
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
    if (!confirm('This will remove the review and notify everyone who reported it. Continue?')) return;
    
    try {
      const response = await fetch(`/api/reviews/${reviewId}/hide`, {
        method: 'POST',
        headers: {
          'x-admin-secret': adminSecret,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to hide review');
      }
      
      // Update local state to reflect the hidden status immediately
      setReports(prevReports =>
        prevReports.map(r =>
          r.review_id === reviewId ? { ...r, is_hidden: true, review_status: 'hidden' } : r
        )
      );
    } catch (err) {
      alert('Error hiding review: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const keepReport = async (reviewId: string) => {
    if (!confirm('This will keep the review visible, reject all reports, and notify everyone who reported it. Continue?')) return;

    try {
      const response = await fetch(`/api/reviews/${reviewId}/keep`, {
        method: 'POST',
        headers: {
          'x-admin-secret': adminSecret,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to keep review');
      }
      
      // Update local state to reflect the kept status immediately
      setReports(prevReports =>
        prevReports.map(r =>
          r.review_id === reviewId
            ? { ...r, is_hidden: false, review_status: 'reviewed', report_count: 0, reports: [] }
            : r
        )
      );
    } catch (err) {
      alert('Error keeping review: ' + (err instanceof Error ? err.message : 'Unknown error'));
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

  const formatStatus = (status: string | undefined, isHidden: boolean) => {
    if (isHidden) return 'Hidden';
    switch (status) {
      case 'pending_review': return 'Pending Review';
      case 'reviewed': return 'Reviewed';
      case 'hidden': return 'Hidden';
      default: return 'Visible';
    }
  };

  const formatDate = (ts: string) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDateTime = (ts: string) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return `${formatDate(ts)} ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  };

  const getLatestReportDate = (reports: SubReport[]) => {
    if (!reports.length) return '';
    return reports.reduce((latest, r) =>
      new Date(r.created_at) > new Date(latest) ? r.created_at : latest,
      reports[0].created_at
    );
  };

  const getUniqueReasons = (subReports: SubReport[]) => {
    const reasons = Array.from(new Set(subReports.map(r => r.reason)));
    return reasons.map(r => formatReason(r)).join(', ');
  };

  // Filter reports by reason
  const filteredByReason = reasonFilter === 'all'
    ? reports
    : reports.filter(r => r.reports.some(report => report.reason === reasonFilter));

  // Filter reports by moderation status (review_status aware)
  const filteredByStatus = statusFilter === 'all'
    ? filteredByReason
    : filteredByReason.filter(r => {
        const status = r.review_status || (r.is_hidden ? 'hidden' : 'active');
        switch (statusFilter) {
          case 'hidden': return status === 'hidden' || r.is_hidden;
          case 'visible': return !r.is_hidden;
          case 'pending_review': return status === 'pending_review' && !r.is_hidden;
          case 'reviewed': return status === 'reviewed' && !r.is_hidden;
          default: return true;
        }
      });

  // Text search across review content, parties, reasons, and reporters
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredBySearch = normalizedQuery === ''
    ? filteredByStatus
    : filteredByStatus.filter(r => {
        const haystack = [
          r.review?.comment || '',
          r.review?.reviewer_name || '',
          r.review?.reviewee_name || '',
          r.reports.map(x => formatReason(x.reason)).join(' '),
          r.reports.map(x => x.reporter_name || '').join(' '),
          String(r.report_count)
        ].join(' ').toLowerCase();
        return haystack.includes(normalizedQuery);
      });

  // Sort reviews (default: report count descending per TC-Q18)
  const sortedReports = [...filteredBySearch].sort((a, b) => {
    switch (sortKey) {
      case 'reports':
        return b.report_count - a.report_count;
      case 'newest':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'oldest':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      default:
        return 0;
    }
  });

  // Paginate filtered reports
  const totalPages = Math.ceil(sortedReports.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedReports = sortedReports.slice(startIndex, endIndex);

  // Reset to page 1 when any filter or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [reasonFilter, statusFilter, searchQuery, sortKey]);

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
          <p className="text-sm font-medium text-gray-500">
            {sortedReports.length} of {reports.length} reviews
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      {!loading && reports.length > 0 && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="review-search" className="block text-sm font-medium text-gray-700 mb-1">Search:</label>
              <input
                id="review-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by review, reviewer, reviewee, reason, reporter..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="reason-filter" className="block text-sm font-medium text-gray-700 mb-1">Filter by reason:</label>
              <select
                id="reason-filter"
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value as ReasonFilter)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Reports</option>
                <option value="spam">Spam</option>
                <option value="offensive">Offensive Content</option>
                <option value="false_info">False Information</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">Status:</label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending_review">Pending Review</option>
                <option value="reviewed">Reviewed</option>
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
            <div>
              <label htmlFor="sort-key" className="block text-sm font-medium text-gray-700 mb-1">Sort by:</label>
              <select
                id="sort-key"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="reports">Most Reports</option>
                <option value="newest">Newest Review</option>
                <option value="oldest">Oldest Review</option>
              </select>
            </div>
          </div>
        </div>
      )}

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
      ) : sortedReports.length === 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <p className="text-blue-800 font-semibold">No reviews match your filters</p>
          <p className="text-blue-700 text-sm mt-1">Try adjusting the reason/status filters or clearing the search.</p>
        </div>
      ) : (
        <>
          <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Review Content
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Reviewer / Reviewee
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Reports
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Reasons
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Reported
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
                  {paginatedReports.map((group) => (
                    <>
                      <tr key={group.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          {group.review ? (
                            <div className="max-w-md">
                              <div className="flex items-center gap-1 mb-1">
                                <span className="text-yellow-500 font-bold text-sm">★</span>
                                <span className="font-bold text-gray-900 text-sm">{group.review.rating}/5</span>
                              </div>
                              <p className="text-gray-700 text-sm italic line-clamp-3">"{group.review.comment}"</p>
                              <p className="text-[10px] text-gray-400 mt-1">Review ID: {group.review_id}</p>
                              <p className="text-[10px] text-gray-400">Reviewer ID: {group.review.reviewer_id}</p>
                            </div>
                          ) : (
                            <span className="text-red-500 italic text-sm">Review content missing (ID: {group.review_id})</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {group.review ? (
                            <div className="text-sm space-y-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Reviewer</span>
                                <span className="font-medium text-gray-800">
                                  {group.review.reviewer_name || 'Unknown'}
                                </span>
                                {group.review.is_anonymous && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                                    Anonymous
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Reviewee</span>
                                <span className="font-medium text-gray-800">
                                  {group.review.reviewee_name || 'Unknown'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic text-sm">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1.5">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                              🚩 {group.report_count}
                            </span>
                            <span className="text-xs text-gray-500">
                              {group.report_count} report{group.report_count === 1 ? '' : 's'}
                            </span>
                            <button
                              onClick={() => setExpandedReview(expandedReview === group.id ? null : group.id)}
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              {expandedReview === group.id ? 'Hide' : 'Show'} Details
                            </button>
                          </div>
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs text-gray-600">
                            <p className="font-medium text-gray-700">Review: {formatDate(group.created_at)}</p>
                            <p className="mt-1 text-gray-500">
                              Latest report: {formatDateTime(getLatestReportDate(group.reports))}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {formatStatus(group.review_status, group.is_hidden) === 'Hidden' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                              Hidden
                            </span>
                          ) : formatStatus(group.review_status, group.is_hidden) === 'Pending Review' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                              Pending Review
                            </span>
                          ) : formatStatus(group.review_status, group.is_hidden) === 'Reviewed' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                              Reviewed ✓
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                              Visible
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2 flex-wrap">
                            <button
                              onClick={() => keepReport(group.review_id)}
                              className="text-green-600 hover:text-green-900 bg-green-50 px-3 py-1.5 rounded-md transition-colors text-xs"
                              title="Keep Review (Reject Reports)"
                            >
                              Keep
                            </button>
                            <button
                              onClick={() => hideReview(group.review_id)}
                              className="text-red-600 hover:text-red-900 bg-red-50 px-3 py-1.5 rounded-md transition-colors text-xs"
                              title="Hide Review"
                            >
                              Hide
                            </button>
                            {/* Ban User action removed */}
                          </div>
                        </td>
                      </tr>
                      {/* Reporter Details Expansion */}
                      {expandedReview === group.id && (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 bg-gray-50">
                            <div className="text-sm space-y-4">
                              {group.review && (
                                <div className="bg-white border border-gray-200 rounded-lg p-4">
                                  <h4 className="font-semibold text-gray-900 mb-2">Full Review</h4>
                                  <div className="flex flex-wrap items-center gap-1 mb-2">
                                    <span className="text-yellow-500 font-bold text-sm">★</span>
                                    <span className="font-bold text-gray-900 text-sm">{group.review.rating}/5</span>
                                    <span className="text-xs text-gray-500 ml-2">
                                      {group.review.reviewer_name || 'Unknown'} → {group.review.reviewee_name || 'Unknown'}
                                    </span>
                                    <span className="text-xs text-gray-400">· {formatDateTime(group.created_at)}</span>
                                  </div>
                                  <p className="text-gray-800 text-sm whitespace-pre-wrap break-words">
                                    "{group.review.comment || 'No comment provided.'}"
                                  </p>
                                </div>
                              )}
                              <div>
                                <h4 className="font-semibold text-gray-900 mb-3">Report Details ({group.reports.length} reports)</h4>
                                <div className="space-y-3">
                                {group.reports.map((report, idx) => (
                                  <div key={report.id} className="bg-white border border-gray-200 rounded-lg p-3">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <p className="text-xs text-gray-500">Report #{idx + 1}</p>
                                        <p className="text-xs text-gray-500 mt-1">
                                          Reporter: <span className="font-medium text-gray-700">{report.reporter_name || 'Unknown'}</span>
                                          <span className="text-gray-400"> (ID: {report.reporter_id})</span>
                                        </p>
                                        <p className="font-medium text-gray-900 mt-2">Reason: {formatReason(report.reason)}</p>
                                        {report.description && (
                                          <p className="text-gray-700 mt-2 italic">"{report.description}"</p>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-400">
                                        {formatDateTime(report.created_at)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white border border-gray-200 rounded-lg mt-6 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-700">
                  Showing {startIndex + 1}-{Math.min(endIndex, sortedReports.length)} of {sortedReports.length} reviews
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm font-medium text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
