'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
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
  const supabase = createClientComponentClient();
  const policyId = params.id as string;

  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPolicy();
  }, [policyId]);

  const fetchPolicy = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_policies')
        .select('*')
        .eq('id', policyId)
        .single();

      if (error) throw error;

      setPolicy(data);
    } catch (error) {
      console.error('Error fetching policy:', error);
      alert('Failed to load policy');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!policy) return;

    if (!confirm('Are you sure you want to publish this policy? It will become the active version for all users.')) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.rpc('publish_policy', {
        p_policy_id: policyId,
        p_admin_id: user.id,
      });

      if (error) throw error;

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings/policies">
            <Button variant="outline">← Back</Button>
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
              <Link href={`/settings/policies/${policyId}/edit`}>
                <Button variant="outline">Edit</Button>
              </Link>
              <Button onClick={handlePublish} testID="publish-policy-button">
                Publish
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
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
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-bold mb-4">{policy.title}</h2>
          <div className="prose max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {policy.content}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
