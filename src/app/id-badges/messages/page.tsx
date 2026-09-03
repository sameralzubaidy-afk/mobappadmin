'use client';

// File: p2p-kids-admin/src/app/id-badges/messages/page.tsx

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { IDBadgeTabs } from '../IDBadgeTabs';

interface Message {
  id: string;
  message_key: string;
  message_text: string;
  description: string;
  supports_variables: boolean;
  updated_at?: string;
}

const TEMPLATE_VARIABLES = [
  { key: '{first_name}', desc: "User's first name" },
  { key: '{rejection_reason}', desc: 'Reason for rejection (e.g., "unclear photo")' },
  { key: '{admin_notes}', desc: 'Additional notes from admin' },
  { key: '{approval_timeframe_hours}', desc: 'Expected approval time (default: 24)' },
];

const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '';

export default function IDMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessageId, setSuccessMessageId] = useState<string | null>(null);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/id-badges/messages', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
      });

      if (!response.ok) {
        throw new Error(`Failed to load messages: ${response.statusText}`);
      }

      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error: any) {
      console.error('Error loading messages:', error);
      setError(error.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (message: Message) => {
    setEditingId(message.id);
    setEditText(message.message_text);
    setSuccessMessageId(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditText('');
  };

  const handleSave = async (messageId: string) => {
    if (!editText.trim()) {
      alert('Message text cannot be empty');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/id-badges/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
        body: JSON.stringify({ message_text: editText }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save message');
      }

      const data = await response.json();

      // Update local state
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, message_text: data.message.message_text, updated_at: data.message.updated_at } : msg
        )
      );

      setEditingId(null);
      setEditText('');
      setSuccessMessageId(messageId);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessageId(null), 3000);
    } catch (error: any) {
      console.error('Error saving message:', error);
      setError(error.message || 'Failed to save message');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600">Loading messages...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">ID Badge Verification</h1>

      <IDBadgeTabs />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Message Templates</h2>
        </div>
        <p className="mt-2 text-gray-600">
          Customize all user-facing messages in the ID badge verification system. Messages support template variables for personalization.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-700">⚠️ {error}</p>
        </div>
      )}

      {/* Template Variables Reference */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
        <h3 className="font-semibold text-blue-900 mb-2">📝 Template Variables</h3>
        <p className="text-sm text-blue-700 mb-2">Use these placeholders in your messages to personalize notifications:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {TEMPLATE_VARIABLES.map((variable) => (
            <div key={variable.key} className="text-sm">
              <code className="bg-blue-100 px-2 py-1 rounded text-blue-900 font-mono">{variable.key}</code>
              <span className="text-blue-700 ml-2">— {variable.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Messages List */}
      <div className="space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="border border-gray-300 rounded-lg p-4 bg-white shadow-sm">
            {/* Message Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-700">
                    {message.message_key}
                  </code>
                </h3>
                <p className="text-sm text-gray-600 mt-1">{message.description}</p>
                {message.supports_variables && (
                  <p className="text-xs text-blue-600 mt-1">✓ Supports template variables</p>
                )}
              </div>

              {/* Edit/Save/Cancel Buttons */}
              {editingId === message.id ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(message.id)}
                    disabled={saving}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="px-3 py-1 bg-gray-400 text-white rounded text-sm hover:bg-gray-500 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleEdit(message)}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition"
                >
                  Edit
                </button>
              )}
            </div>

            {/* Message Text (View or Edit Mode) */}
            {editingId === message.id ? (
              <div className="mt-3">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={4}
                  className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder="Enter message text..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Character count: {editText.length}
                </p>
              </div>
            ) : (
              <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
                <p className="text-gray-800 text-sm whitespace-pre-wrap font-mono">{message.message_text}</p>
              </div>
            )}

            {/* Success Message */}
            {successMessageId === message.id && (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                <p className="text-green-700 text-sm">✓ Saved successfully</p>
              </div>
            )}

            {/* Last Updated */}
            {message.updated_at && (
              <p className="text-xs text-gray-500 mt-2">
                Last updated: {new Date(message.updated_at).toLocaleString()}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {messages.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-600">No messages found. Please run the seed SQL script.</p>
        </div>
      )}
    </div>
  );
}
