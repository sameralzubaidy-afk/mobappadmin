'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

type PolicyType = 'terms_of_service' | 'privacy_policy' | 'liability_disclaimer';

interface Policy {
  id: string;
  policy_type: PolicyType;
  version: string;
  title: string;
  content: string;
  status: 'draft' | 'published' | 'archived';
  effective_date: string | null;
  created_at: string;
  published_at: string | null;
  created_by: string | null;
  published_by: string | null;
}

const POLICY_LABELS: Record<PolicyType, string> = {
  terms_of_service: 'Terms of Service',
  privacy_policy: 'Privacy Policy',
  liability_disclaimer: 'Liability Disclaimer',
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Record<PolicyType, Policy[]>>({
    terms_of_service: [],
    privacy_policy: [],
    liability_disclaimer: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PolicyType>('terms_of_service');

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      const response = await fetch('/api/admin/policies', {
        method: 'GET',
        headers: {
          'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '',
        },
        cache: 'no-store',
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load policies');
      }

      const data = payload.data as Policy[];

      const grouped = (data || []).reduce((acc, policy) => {
        if (!acc[policy.policy_type as PolicyType]) {
          acc[policy.policy_type as PolicyType] = [];
        }
        acc[policy.policy_type as PolicyType].push(policy);
        return acc;
      }, {} as Record<PolicyType, Policy[]>);

      setPolicies({
        terms_of_service: grouped.terms_of_service || [],
        privacy_policy: grouped.privacy_policy || [],
        liability_disclaimer: grouped.liability_disclaimer || [],
      });
    } catch (error) {
      console.error('Error fetching policies:', error);
      alert('Failed to load policies');
    } finally {
      setLoading(false);
    }
  };

  const publishPolicy = async (policyId: string) => {
    if (!confirm('Are you sure you want to publish this policy? It will make it the active version for all users.')) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/admin/policies/${policyId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '',
        },
        body: JSON.stringify({
          action: 'publish',
          admin_id: user.id,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to publish policy');
      }

      alert('Policy published successfully');
      fetchPolicies();
    } catch (error) {
      console.error('Error publishing policy:', error);
      alert('Failed to publish policy');
    }
  };

  // Restore a previously-active (archived) version as the current published one.
  // Makes a full publish round-trip safe to test on load-bearing legal surfaces
  // (G04): publish a draft → archive the prior active → restore it back.
  const restorePolicy = async (policyId: string) => {
    if (!confirm('Restore this version as the active policy? It will replace the currently active version.')) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/admin/policies/${policyId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '',
        },
        body: JSON.stringify({
          action: 'republish',
          admin_id: user.id,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to restore policy');
      }

      alert('Policy restored as the active version');
      fetchPolicies();
    } catch (error) {
      console.error('Error restoring policy:', error);
      alert('Failed to restore policy');
    }
  };

  // Delete an inert draft (never published). Safe: drafts carry no load-bearing
  // state, and published/archived versions can never be deleted via this API.
  const deleteDraft = async (policyId: string) => {
    if (!confirm('Delete this draft? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/policies/${policyId}`, {
        method: 'DELETE',
        headers: {
          'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '',
        },
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to delete policy');
      }

      alert('Draft deleted');
      fetchPolicies();
    } catch (error) {
      console.error('Error deleting policy:', error);
      alert('Failed to delete policy');
    }
  };

  const PolicyList = ({ policyType, title }: { policyType: PolicyType; title: string }) => {
    const policyList = policies[policyType];
    const publishedPolicy = policyList.find(p => p.status === 'published');

    return (
      <div className="space-y-4" data-testid={`policy-list-${policyType}`}>
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Link href={`/settings/policies/new?type=${policyType}`}>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium" data-testid={`create-${policyType}-button`}>
              <span className="mr-2">+</span> Create New Version
            </button>
          </Link>
        </div>

        {publishedPolicy && (
          <div className="border-green-500 border-2 rounded-lg bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-green-600 font-semibold">📄 Active: {publishedPolicy.title}</span>
              <span className="text-sm font-normal text-gray-500">v{publishedPolicy.version}</span>
            </div>
            <div className="space-y-2 text-sm">
              <p><strong>Published:</strong> {new Date(publishedPolicy.published_at!).toLocaleDateString()}</p>
              <p><strong>Effective:</strong> {new Date(publishedPolicy.effective_date!).toLocaleDateString()}</p>
              <div className="mt-4 flex gap-2">
                <Link href={`/settings/policies/${publishedPolicy.id}`}>
                  <button className="bg-white border border-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-50 text-sm">View</button>
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-md font-medium">All Versions</h4>
          {policyList.length === 0 ? (
            <p className="text-gray-500">No policies created yet.</p>
          ) : (
            <div className="space-y-2">
              {policyList.map((policy) => (
                <div key={policy.id} className={`border border-gray-200 rounded-lg p-4 ${policy.status === 'published' ? 'opacity-50' : 'bg-white'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-base font-medium">{policy.title}</span>
                    <span className="text-xs px-2 py-1 rounded bg-gray-200">{policy.status}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      <p>Version: {policy.version}</p>
                      <p>Created: {new Date(policy.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/settings/policies/${policy.id}`}>
                        <button className="bg-white border border-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-50 text-sm">View</button>
                      </Link>
                      {policy.status === 'draft' && (
                        <>
                          <Link href={`/settings/policies/${policy.id}/edit`}>
                            <button className="bg-white border border-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-50 text-sm">Edit</button>
                          </Link>
                          <button
                            onClick={() => publishPolicy(policy.id)}
                            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm"
                            data-testid={`publish-${policy.id}-button`}
                          >
                            Publish
                          </button>
                          <button
                            onClick={() => deleteDraft(policy.id)}
                            className="bg-white border border-red-300 text-red-600 px-3 py-1 rounded hover:bg-red-50 text-sm"
                            data-testid={`delete-${policy.id}-button`}
                          >
                            Delete
                          </button>
                        </>
                      )}
                      {policy.status === 'archived' && (
                        <button
                          onClick={() => restorePolicy(policy.id)}
                          className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
                          data-testid={`restore-${policy.id}-button`}
                        >
                          Make Active
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="p-8">Loading policies...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[32px] font-bold leading-10" style={{ letterSpacing: '-0.5px' }}>Platform Policies</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Manage Terms of Service, Privacy Policy, and Legal Disclaimers</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-200 gap-6">
        <button
          onClick={() => setActiveTab('terms_of_service')}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            activeTab === 'terms_of_service'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-600 border-transparent hover:text-gray-900'
          }`}
          data-testid="tab-terms-of-service"
        >
          Terms of Service
        </button>
        <button
          onClick={() => setActiveTab('privacy_policy')}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            activeTab === 'privacy_policy'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-600 border-transparent hover:text-gray-900'
          }`}
          data-testid="tab-privacy-policy"
        >
          Privacy Policy
        </button>
        <button
          onClick={() => setActiveTab('liability_disclaimer')}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            activeTab === 'liability_disclaimer'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-600 border-transparent hover:text-gray-900'
          }`}
          data-testid="tab-liability-disclaimer"
        >
          Liability Disclaimer
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'terms_of_service' && (
          <PolicyList policyType="terms_of_service" title="Terms of Service" />
        )}
        {activeTab === 'privacy_policy' && (
          <PolicyList policyType="privacy_policy" title="Privacy Policy" />
        )}
        {activeTab === 'liability_disclaimer' && (
          <PolicyList policyType="liability_disclaimer" title="Liability Disclaimer" />
        )}
      </div>
    </div>
  );
}
