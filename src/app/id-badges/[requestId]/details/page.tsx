// File: p2p-kids-admin/src/app/id-badges/[requestId]/details/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface IDVerificationRequest {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  node_id: string | null;
  nodes?: { zip_code: string };
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  rejection_notes: string | null;
  approval_notes: string | null;
}

export default function IDVerificationDetailsPage({
  params,
}: {
  params: { requestId: string };
}) {
  const [request, setRequest] = useState<IDVerificationRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequest();
  }, [params.requestId]);

  const loadRequest = async () => {
    try {
      const response = await fetch(`/api/admin/id-badges/${params.requestId}`);
      const data = await response.json();
      setRequest(data);
    } catch (error) {
      console.error('Error loading request:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!request) return <div className="p-6">Request not found</div>;

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">ID Badge Request Details</h1>
        <Link href="/id-badges" className="text-blue-600 hover:underline">
          &larr; Back to Queue
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Info */}
        <div className="bg-white border rounded shadow-sm p-6">
          <h2 className="text-lg font-bold mb-4">User Information</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Name</p>
              <p className="font-medium">{request.first_name} {request.last_name}</p>
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
          </div>
        </div>

        {/* Request Status */}
        <div className="bg-white border rounded shadow-sm p-6">
          <h2 className="text-lg font-bold mb-4">Status & Decision</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Current Status</p>
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-1 ${
                  request.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : request.status === 'approved'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Submitted At</p>
              <p className="font-medium">{new Date(request.submitted_at).toLocaleString()}</p>
            </div>
            {request.reviewed_at && (
              <>
                <div>
                  <p className="text-sm text-gray-600">Reviewed At</p>
                  <p className="font-medium">{new Date(request.reviewed_at).toLocaleString()}</p>
                </div>
                {request.status === 'rejected' && (
                  <div>
                    <p className="text-sm text-gray-600">Rejection Reason</p>
                    <p className="font-medium text-red-600">{request.rejection_reason?.replace(/_/g, ' ') || 'No reason provided'}</p>
                    {request.rejection_notes && (
                      <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded text-sm italic">
                        {request.rejection_notes}
                      </div>
                    )}
                  </div>
                )}
                {request.status === 'approved' && request.approval_notes && (
                  <div>
                    <p className="text-sm text-gray-600">Approval Notes</p>
                    <div className="mt-2 p-3 bg-green-50 border border-green-100 rounded text-sm italic">
                      {request.approval_notes}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-8 bg-blue-50 border border-blue-100 p-4 rounded text-sm text-blue-800">
        Note: The ID screenshot was permanently deleted following the review decision to protect user privacy.
      </div>
    </div>
  );
}
