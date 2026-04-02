'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Policy {
  id: string;
  policy_type: string;
  version: string;
  title: string;
  content: string;
  status: string;
  effective_date: string;
  published_at: string | null;
  created_at: string;
}

const POLICY_TYPE_LABELS: Record<string, string> = {
  terms_of_service: 'Terms of Service',
  privacy_policy: 'Privacy Policy',
  liability_disclaimer: 'Liability Disclaimer',
};

export default function ViewPolicyPage() {
  const params = useParams();
  const router = useRouter();
  const policyId = params.id as string;

  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPolicy = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/policies/${policyId}`, {
        method: 'GET',
        headers: {
          'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '',
        },
        cache: 'no-store',
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load policy');
      }

      setPolicy(payload.data as Policy);
    } catch (error) {
      console.error('Error fetching policy:', error);
      alert('Failed to load policy');
    } finally {
      setLoading(false);
    }
  }, [policyId]);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  const handlePublish = async () => {
    if (!policy) return;

    if (!confirm('Are you sure you want to publish this policy? It will become the active version for all users.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/policies/${policyId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '',
        },
        body: JSON.stringify({
          action: 'publish',
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to publish policy');
      }

      alert('Policy published successfully');
      router.push('/settings/policies');
    } catch (error) {
      console.error('Error publishing policy:', error);
      alert('Failed to publish policy');
    }
  };

  if (loading) {
    return <div className="p-8">Loading policy...</div>;
  }

  if (!policy) {
    return <div className="p-8">Policy not found</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings/policies" className="inline-block">
            <button className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              ← Back
            </button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">
              {POLICY_TYPE_LABELS[policy.policy_type] || policy.policy_type}
            </h1>
            <p className="text-gray-600 mt-1">
              Version {policy.version} • {policy.status}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {policy.status === 'draft' && (
            <>
              <Link href={`/settings/policies/${policyId}/edit`} className="inline-block">
                <button className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  Edit
                </button>
              </Link>
              <button
                onClick={handlePublish}
                data-testid="publish-policy-button"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Publish
              </button>
            </>
          )}
        </div>
      </div>

      {/* Policy Details Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-semibold text-gray-600">Status</p>
            <p className="capitalize">{policy.status}</p>
          </div>
          <div>
            <p className="font-semibold text-gray-600">Version</p>
            <p>{policy.version}</p>
          </div>
          <div>
            <p className="font-semibold text-gray-600">Effective Date</p>
            <p>{policy.effective_date ? new Date(policy.effective_date).toLocaleDateString() : 'Not set'}</p>
          </div>
          <div>
            <p className="font-semibold text-gray-600">Published</p>
            <p>{policy.published_at ? new Date(policy.published_at).toLocaleDateString() : 'Not published'}</p>
          </div>
        </div>
      </div>

      {/* Content Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4">{policy.title}</h2>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-gray-50 p-4 rounded border border-gray-200">
          {policy.content}
        </pre>
      </div>
    </div>
  );
}
