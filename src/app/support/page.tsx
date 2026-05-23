'use client';
// File: p2p-kids-admin/src/app/support/page.tsx
// Admin page — support messages table with filters and pagination.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CheckCircle, Eye, RefreshCw } from 'lucide-react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface SupportMessage {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: 'unread' | 'read';
  created_at: string;
  updated_at: string;
  profiles: {
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

type StatusFilter = 'all' | 'unread' | 'read';

const PAGE_SIZE = 20;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function SupportMessagesPage() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [markingRead, setMarkingRead] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await fetch(`/api/support${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch support messages');
      const data: SupportMessage[] = await res.json();
      setMessages(data);
      setError(null);
      setCurrentPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // ── Mark as read ───────────────────────────

  const markAsRead = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      setMarkingRead(id);
      const res = await fetch(`/api/support/${id}/read`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to mark as read');
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: 'read' } : m))
      );
    } catch (err) {
      console.error('[SupportPage] markAsRead error', err);
    } finally {
      setMarkingRead(null);
    }
  };

  // ── Pagination ─────────────────────────────

  const totalPages = Math.ceil(messages.length / PAGE_SIZE);
  const paginated = messages.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const unreadCount = messages.filter((m) => m.status === 'unread').length;

  // ── Render ─────────────────────────────────

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Support Messages
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            User-submitted help requests from the mobile app
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <span
              className="text-sm font-semibold px-3 py-1 rounded-full"
              style={{ background: '#FEF3C7', color: '#92400E' }}
            >
              {unreadCount} unread
            </span>
          )}
          <button
            onClick={fetchMessages}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              opacity: loading ? 0.5 : 1,
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex gap-2 mb-5">
        {(['all', 'unread', 'read'] as StatusFilter[]).map((s) => {
          const label = s === 'all' ? 'All Messages' : s.charAt(0).toUpperCase() + s.slice(1);
          const count =
            s === 'all'
              ? messages.length
              : messages.filter((m) => m.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors"
              style={{
                background: statusFilter === s ? 'var(--brand-primary)' : 'var(--card-bg)',
                color: statusFilter === s ? '#fff' : 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
              }}
            >
              {label}
              {!loading && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                  style={{
                    background: statusFilter === s ? 'rgba(255,255,255,0.25)' : 'var(--content-bg)',
                    color: statusFilter === s ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
          <RefreshCw size={24} className="animate-spin mx-auto mb-3 opacity-50" />
          Loading support messages…
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div
          className="p-4 rounded-lg text-sm"
          style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}
        >
          {error}
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && messages.length === 0 && (
        <div className="text-center py-20" style={{ color: 'var(--text-secondary)' }}>
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium text-base">No support messages</p>
          <p className="text-sm mt-1">
            {statusFilter !== 'all'
              ? `No ${statusFilter} messages found.`
              : 'No messages have been submitted yet.'}
          </p>
        </div>
      )}

      {/* ── Table ── */}
      {!loading && !error && messages.length > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--border-color)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              {/* Head */}
              <thead>
                <tr style={{ background: 'var(--content-bg)', borderBottom: '1px solid var(--border-color)' }}>
                  {['Status', 'User', 'Email', 'Phone', 'Subject', 'Date', 'Actions'].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Body */}
              <tbody>
                {paginated.map((msg, i) => {
                  const isUnread = msg.status === 'unread';
                  const isMarking = markingRead === msg.id;

                  return (
                    <tr
                      key={msg.id}
                      style={{
                        background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--content-bg)',
                        borderBottom: '1px solid var(--border-color)',
                      }}
                    >
                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
                          style={
                            isUnread
                              ? { background: '#DCFCE7', color: '#166534' }
                              : { background: 'var(--content-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }
                          }
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: isUnread ? '#22C55E' : 'var(--text-secondary)' }}
                          />
                          {isUnread ? 'Unread' : 'Read'}
                        </span>
                      </td>

                      {/* User */}
                      <td className="px-4 py-3">
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {msg.profiles?.name ?? <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                        </span>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {msg.profiles?.email ?? '—'}
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {msg.profiles?.phone ?? '—'}
                      </td>

                      {/* Subject */}
                      <td className="px-4 py-3" style={{ maxWidth: 260 }}>
                        <span
                          className="block font-medium truncate"
                          style={{ color: 'var(--text-primary)' }}
                          title={msg.subject}
                        >
                          {msg.subject}
                        </span>
                        <span
                          className="block text-xs mt-0.5 truncate"
                          style={{ color: 'var(--text-secondary)' }}
                          title={msg.message}
                        >
                          {msg.message}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {formatDate(msg.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {/* View link */}
                          <Link
                            href={`/support/${msg.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                            style={{
                              background: 'var(--brand-primary)',
                              color: '#fff',
                            }}
                          >
                            <Eye size={13} />
                            View
                          </Link>

                          {/* Mark as read — only for unread */}
                          {isUnread && (
                            <button
                              onClick={(e) => markAsRead(msg.id, e)}
                              disabled={isMarking}
                              title="Mark as read"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-opacity"
                              style={{
                                background: '#DCFCE7',
                                color: '#166534',
                                opacity: isMarking ? 0.5 : 1,
                                border: 'none',
                                cursor: isMarking ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <CheckCircle size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderTop: '1px solid var(--border-color)', background: 'var(--content-bg)' }}
            >
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, messages.length)} of {messages.length}
              </p>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity"
                  style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    opacity: currentPage === 1 ? 0.4 : 1,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  ← Prev
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                      acc.push('...');
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === '...' ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-2 text-sm"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p as number)}
                        className="w-8 h-8 rounded-lg text-sm font-medium"
                        style={{
                          background: currentPage === p ? 'var(--brand-primary)' : 'var(--card-bg)',
                          border: '1px solid var(--border-color)',
                          color: currentPage === p ? '#fff' : 'var(--text-secondary)',
                        }}
                      >
                        {p}
                      </button>
                    )
                  )}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity"
                  style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    opacity: currentPage === totalPages ? 0.4 : 1,
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  }}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
