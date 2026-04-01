'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type PolicyType = 'terms_of_service' | 'privacy_policy' | 'liability_disclaimer';

const POLICY_LABELS: Record<PolicyType, string> = {
  terms_of_service: 'Terms of Service',
  privacy_policy: 'Privacy Policy',
  liability_disclaimer: 'Liability Disclaimer',
};

export default function NewPolicyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClientComponentClient();

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('platform_policies')
        .insert({
          policy_type: policyType,
          title: formData.title.trim(),
          version: formData.version.trim(),
          content: formData.content.trim(),
          effective_date: formData.effectiveDate,
          status: 'draft',
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

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
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings/policies">
          <Button variant="outline">← Back</Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Create New {POLICY_LABELS[policyType]}</h1>
          <p className="text-gray-600 mt-1">Draft will be created. You can publish it later.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
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
                className="w-full p-2 border rounded"
                placeholder="e.g., Kids P2P Marketplace Terms of Service"
                data-testid="policy-title-input"
              />
              {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
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
                className="w-full p-2 border rounded"
                placeholder="e.g., 1.0"
                data-testid="policy-version-input"
              />
              {errors.version && <p className="text-red-500 text-sm mt-1">{errors.version}</p>}
              <p className="text-sm text-gray-500 mt-1">Format: X.Y or X.Y.Z (e.g., 1.0, 1.2.1)</p>
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
                className="w-full p-2 border rounded"
                data-testid="policy-effective-date-input"
              />
              {errors.effectiveDate && <p className="text-red-500 text-sm mt-1">{errors.effectiveDate}</p>}
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
                rows={20}
                className="w-full p-2 border rounded font-mono text-sm"
                placeholder="# Introduction&#10;&#10;Welcome to Kids P2P Marketplace...&#10;&#10;## 1. Acceptance of Terms&#10;..."
                data-testid="policy-content-textarea"
              />
              {errors.content && <p className="text-red-500 text-sm mt-1">{errors.content}</p>}
              <p className="text-sm text-gray-500 mt-1">Use Markdown formatting for headings, lists, and emphasis</p>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={loading} testID="save-policy-button">
                {loading ? 'Creating...' : 'Create Draft'}
              </Button>
              <Link href="/settings/policies">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
