'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

interface Policy {
  id: string;
  policy_type: string;
  version: string;
  title: string;
  content: string;
  status: string;
  effective_date: string | null;
}

export default function EditPolicyPage() {
  const params = useParams();
  const router = useRouter();
  const policyId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    effectiveDate: '',
  });

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

      const fetched = payload.data as Policy;
      setPolicy(fetched);
      setFormData({
        title: fetched.title || '',
        content: fetched.content || '',
        effectiveDate: fetched.effective_date ? fetched.effective_date.slice(0, 10) : '',
      });
    } catch (error) {
      console.error('Error fetching policy:', error);
      alert('Failed to load policy');
      router.push('/settings/policies');
    } finally {
      setLoading(false);
    }
  }, [policyId, router]);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.content.trim() || !formData.effectiveDate) {
      alert('Please fill in title, content, and effective date');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/admin/policies/${policyId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '',
        },
        body: JSON.stringify({
          title: formData.title,
          content: formData.content,
          effective_date: formData.effectiveDate,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update policy');
      }

      alert('Policy updated successfully');
      router.push(`/settings/policies/${policyId}`);
    } catch (error: any) {
      console.error('Error updating policy:', error);
      alert(error?.message || 'Failed to update policy');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading policy...</div>;
  }

  if (!policy) {
    return <div className="p-8">Policy not found</div>;
  }

  if (policy.status !== 'draft') {
    return (
      <div className="p-8 space-y-4">
        <p>Only draft policies can be edited.</p>
        <Link href={`/settings/policies/${policyId}`} className="text-blue-600 hover:text-blue-700">
          Back to policy details
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <Link href={`/settings/policies/${policyId}`}>
          <button type="button" className="text-blue-600 hover:text-blue-700 mb-4">
            ← Back to Policy
          </button>
        </Link>
        <h1 className="text-[32px] font-bold leading-10" style={{ letterSpacing: '-0.5px' }}>Edit Draft Policy</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>Version {policy.version}</p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-2">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label htmlFor="effectiveDate" className="block text-sm font-medium mb-2">
            Effective Date
          </label>
          <input
            id="effectiveDate"
            type="date"
            value={formData.effectiveDate}
            onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium mb-2">
            Content
          </label>
          <textarea
            id="content"
            rows={16}
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded font-mono text-sm"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-400"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <Link href={`/settings/policies/${policyId}`}>
            <button
              type="button"
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
          </Link>
        </div>
      </form>
    </div>
  );
}
