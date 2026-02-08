// File: p2p-kids-admin/src/app/id-badges/[requestId]/review/page.tsx
// TASK BADGE-010: Admin ID Badge Review Page
// Module: MODULE-10-ID-BADGE-VERIFICATION-V2.md

'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

const REJECTION_REASONS = [
  { value: 'unclear_photo', label: 'Unclear photo' },
  { value: 'id_expired', label: 'ID expired' },
  { value: 'name_mismatch', label: 'Name does not match profile' },
  { value: 'multiple_ids', label: 'Multiple IDs in photo' },
  { value: 'not_government_id', label: 'Not a government-issued ID' },
  { value: 'other', label: 'Other (please explain in notes)' },
];

interface IDVerificationRequest {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  node_id: string | null;
  nodes?: { zip_code: string };
  status: string;
  submitted_at: string;
  screenshot_path: string | null;
}

export default function IDVerificationReviewPage({
  params,
}: {
  params: { requestId: string };
}) {
  const router = useRouter();
  const [request, setRequest] = useState<IDVerificationRequest | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadRequest();
  }, [params.requestId]);

  const loadRequest = async () => {
    try {
      const response = await fetch(`/api/admin/id-badges/${params.requestId}`);
      const data = await response.json();
      setRequest(data);

      // Get screenshot URL if available
      if (data.screenshot_path) {
        const urlResponse = await fetch(
          `/api/admin/id-badges/${params.requestId}/screenshot-url`
        );
        const { url } = await urlResponse.json();
        setScreenshotUrl(url);
      }
    } catch (error) {
      console.error('Error loading request:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDecision = async () => {
    if (!decision) {
      alert('Please select approve or reject');
      return;
    }

    if (decision === 'reject' && !rejectionReason) {
      alert('Please select a rejection reason');
      return;
    }

    setDeciding(true);

    try {
      const response = await fetch(`/api/admin/id-badges/${params.requestId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          rejection_reason: decision === 'reject' ? rejectionReason : null,
          rejection_notes: decision === 'reject' ? notes : null,
          approval_notes: decision === 'approve' ? notes : null,
        }),
      });

      if (response.ok) {
        alert(`Request ${decision === 'approve' ? 'approved' : 'rejected'} successfully`);
        router.push('/id-badges');
      } else {
        alert('Failed to submit decision. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting decision:', error);
      alert('Error submitting decision');
    } finally {
      setDeciding(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!request) {
    return <div className="p-6">Request not found</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Review ID Badge Request</h1>

      {/* User Info */}
      <div className="bg-gray-50 p-4 rounded mb-6">
        <h2 className="text-lg font-bold mb-4">User Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Name</p>
            <p className="font-medium">
              {request.first_name} {request.last_name}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="font-medium">{request.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Phone</p>
            <p className="font-medium">{request.phone_number || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Node Zipcode</p>
            <p className="font-medium">{request.nodes?.zip_code || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Submitted</p>
            <p className="font-medium">
              {new Date(request.submitted_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Screenshot Preview */}
      {screenshotUrl && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-4">Submitted Screenshot</h2>
          <div className="relative w-full h-96 bg-gray-100 rounded overflow-hidden">
            <Image
              src={screenshotUrl}
              alt="ID Verification"
              fill
              style={{ objectFit: 'contain' }}
            />
          </div>
          <a
            href={screenshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline mt-2 inline-block"
          >
            Download Full Size
          </a>
        </div>
      )}

      {/* Decision Form */}
      <div className="bg-white border rounded p-6">
        <h2 className="text-lg font-bold mb-4">Make a Decision</h2>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Decision</label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="decision"
                value="approve"
                onChange={(e) => setDecision(e.target.value as any)}
                className="mr-2"
              />
              <span>Approve</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="decision"
                value="reject"
                onChange={(e) => setDecision(e.target.value as any)}
                className="mr-2"
              />
              <span>Reject</span>
            </label>
          </div>
        </div>

        {decision === 'reject' && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Rejection Reason</label>
            <select
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">Select a reason</option>
              {REJECTION_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              decision === 'reject'
                ? 'Optional: Provide additional context for rejection'
                : 'Optional: Notes about approval'
            }
            className="w-full px-3 py-2 border rounded h-24"
          />
        </div>

        <button
          onClick={handleSubmitDecision}
          disabled={!decision || deciding}
          className={`px-6 py-2 rounded font-medium text-white ${
            !decision || deciding
              ? 'bg-gray-400 cursor-not-allowed'
              : decision === 'approve'
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {deciding ? 'Submitting...' : `${decision ? decision.charAt(0).toUpperCase() + decision.slice(1) : 'Make Decision'}`}
        </button>
      </div>
    </div>
  );
}
