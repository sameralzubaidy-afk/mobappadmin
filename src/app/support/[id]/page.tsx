'use client';
// File: p2p-kids-admin/src/app/support/[id]/page.tsx
// Admin page — single support message detail view.

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Mail, Phone, User, Clock } from 'lucide-react';

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

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function SupportMessageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [message, setMessage] = useState<SupportMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [marked, setMarked] = useState(false);

  useEffect(() => {
    async function fetchMessage() {
      try {
        setLoading(true);
        const res = await fetch(`/api/support/${id}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Message not found');
        const data: SupportMessage = await res.json();
        setMessage(data);
        setMarked(data.status === 'read');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchMessage();
  }, [id]);

  const markAsRead = async () => {
    if (!message || marked) return;
    try {
      setMarking(true);
      const res = await fetch(`/api/support/${id}/read`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to mark as read');
      setMarked(true);
      setMessage((prev) => prev ? { ...prev, status: 'read' } : prev);
    } catch (err) {
      console.error('[SupportDetail] markAsRead error', err);
    } finally {
      setMarking(false);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24" style={{ color: 'var(--text-secondary)' }}>
        <div className="animate-spin w-6 h-6 border-2 border-current border-t-transparent rounded-full mr-3" />
        Loading message…
      </div>
    );
  }

  // ── Error / Not found ──
  if (error || !message) {
    return (
      <div>
        <Link
          href="/support"
          className="inline-flex items-center gap-2 text-sm mb-6"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={16} /> Back to Support
        </Link>
        <div
          className="p-4 rounded-lg text-sm"
          style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}
        >
          {error ?? 'Message not found.'}
        </div>
      </div>
    );
  }

  const isUnread = message.status === 'unread' && !marked;

  return (
    <div className="max-w-2xl">
      {/* ── Back + header ── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <Link
            href="/support"
            className="inline-flex items-center gap-1.5 text-sm mb-3 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft size={15} />
            Back to Support Messages
          </Link>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {message.subject}
          </h1>
        </div>

        {/* Status badge */}
        <span
          className="flex-shrink-0 mt-1 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
          style={
            isUnread
              ? { background: '#DCFCE7', color: '#166534' }
              : { background: 'var(--content-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }
          }
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: isUnread ? '#22C55E' : 'var(--text-secondary)' }}
          />
          {isUnread ? 'Unread' : 'Read'}
        </span>
      </div>

      {/* ── User info card ── */}
      <div
        className="rounded-xl p-5 mb-5"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--text-secondary)' }}>
          Submitted by
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow icon={<User size={15} />} label="Name" value={message.profiles?.name} />
          <InfoRow icon={<Mail size={15} />} label="Email" value={message.profiles?.email} />
          <InfoRow icon={<Phone size={15} />} label="Phone" value={message.profiles?.phone} />
          <InfoRow icon={<Clock size={15} />} label="Submitted" value={formatDate(message.created_at)} />
        </div>
      </div>

      {/* ── Message body card ── */}
      <div
        className="rounded-xl p-5 mb-5"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>
          Message
        </p>
        <p
          className="text-sm leading-relaxed whitespace-pre-wrap"
          style={{ color: 'var(--text-primary)' }}
        >
          {message.message}
        </p>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-3">
        {!marked ? (
          <button
            onClick={markAsRead}
            disabled={marking}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-opacity"
            style={{
              background: 'var(--brand-primary)',
              color: '#fff',
              opacity: marking ? 0.6 : 1,
              cursor: marking ? 'not-allowed' : 'pointer',
            }}
          >
            <CheckCircle size={15} />
            {marking ? 'Marking as read…' : 'Mark as Read'}
          </button>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-lg"
            style={{ background: '#DCFCE7', color: '#166534' }}
          >
            <CheckCircle size={15} />
            Marked as read
          </span>
        )}

        <button
          onClick={() => router.back()}
          className="px-4 py-2.5 rounded-lg text-sm font-medium"
          style={{
            background: 'var(--content-bg)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
          }}
        >
          Go Back
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-component
// ─────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
        {icon}
      </span>
      <div>
        <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </p>
        <p className="text-sm font-medium" style={{ color: value ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          {value ?? '—'}
        </p>
      </div>
    </div>
  );
}
