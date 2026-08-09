'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type PolicyType = 'terms_of_service' | 'privacy_policy' | 'liability_disclaimer';

const POLICY_LABELS: Record<PolicyType, string> = {
  terms_of_service: 'Terms of Service',
  privacy_policy: 'Privacy Policy',
  liability_disclaimer: 'Liability Disclaimer',
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function NewPolicyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const policyType = (searchParams.get('type') as PolicyType) || 'terms_of_service';

  const [formData, setFormData] = useState({
    title: '',
    version: '',
    content: '',
    effectiveDate: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.version.trim()) {
      newErrors.version = 'Version is required';
    } else if (!/^\d+\.\d+(\.\d+)?$/.test(formData.version)) {
      newErrors.version = 'Version must be in format X.Y or X.Y.Z (e.g., 1.0 or 1.0.1)';
    }

    if (!formData.content.trim()) {
      newErrors.content = 'Content is required';
    }

    if (!formData.effectiveDate) {
      newErrors.effectiveDate = 'Effective date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      let user = session?.user ?? null;

      if (!user) {
        const { data } = await supabase.auth.getUser();
        user = data.user ?? null;
      }

      const response = await fetch('/api/admin/policies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '',
        },
        body: JSON.stringify({
          policy_type: policyType,
          title: formData.title,
          version: formData.version,
          content: formData.content,
          effective_date: formData.effectiveDate,
          created_by: user?.id ?? null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create policy');
      }

      alert('Policy created successfully as draft');
      router.push('/settings/policies');
    } catch (error: any) {
      console.error('Error creating policy:', error);
      if (error.message?.includes('unique')) {
        alert('A policy with this type and version already exists');
      } else {
        alert('Failed to create policy');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/settings/policies">
          <button type="button" className="text-blue-600 hover:text-blue-700 mb-4">
            ← Back to Policies
          </button>
        </Link>
        <h1 className="text-[32px] font-bold leading-10" style={{ letterSpacing: '-0.5px' }}>Create {POLICY_LABELS[policyType]}</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          Create a new version of the {POLICY_LABELS[policyType]}
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-6">
          New {POLICY_LABELS[policyType]} Version
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2">
              Title *
            </label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="e.g., Kids P2P Marketplace Terms of Service"
              data-testid="policy-title-input"
            />
            {errors.title && (
              <p className="text-red-500 text-sm mt-1">{errors.title}</p>
            )}
          </div>

          <div>
            <label htmlFor="version" className="block text-sm font-medium mb-2">
              Version *
            </label>
            <input
              id="version"
              type="text"
              value={formData.version}
              onChange={(e) => setFormData({ ...formData, version: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="e.g., 1.0"
              data-testid="policy-version-input"
            />
            {errors.version && (
              <p className="text-red-500 text-sm mt-1">{errors.version}</p>
            )}
            <p className="text-sm text-gray-500 mt-1">
              Format: X.Y or X.Y.Z (e.g., 1.0, 1.2.1)
            </p>
          </div>

          <div>
            <label htmlFor="effectiveDate" className="block text-sm font-medium mb-2">
              Effective Date *
            </label>
            <input
              id="effectiveDate"
              type="date"
              value={formData.effectiveDate}
              onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded"
              data-testid="policy-effective-date-input"
            />
            {errors.effectiveDate && (
              <p className="text-red-500 text-sm mt-1">{errors.effectiveDate}</p>
            )}
            <p className="text-sm text-gray-500 mt-1">When this policy takes effect</p>
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium mb-2">
              Content * (Markdown supported)
            </label>
            <textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={15}
              className="w-full p-2 border border-gray-300 rounded font-mono text-sm"
              placeholder="# Introduction&#10;&#10;Welcome to Kids P2P Marketplace...&#10;&#10;## 1. Acceptance of Terms&#10;..."
              data-testid="policy-content-textarea"
            />
            {errors.content && (
              <p className="text-red-500 text-sm mt-1">{errors.content}</p>
            )}
            <p className="text-sm text-gray-500 mt-1">
              Use Markdown formatting for headings, lists, and emphasis
            </p>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              data-testid="save-policy-button"
            >
              {loading ? 'Creating...' : 'Create Draft'}
            </button>
            <Link href="/settings/policies">
              <button
                type="button"
                className="border border-gray-300 px-6 py-2 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
