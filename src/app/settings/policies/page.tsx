'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
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

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Record<PolicyType, Policy[]>>({
    terms_of_service: [],
    privacy_policy: [],
    liability_disclaimer: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PolicyType>('terms_of_service');
  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_policies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

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
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.rpc('publish_policy', {
        p_policy_id: policyId,
        p_admin_id: user.id,
      });

      if (error) throw error;

      alert('Policy published successfully');
      fetchPolicies();
    } catch (error) {
      console.error('Error publishing policy:', error);
      alert('Failed to publish policy');
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
            <Button testID={`create-${policyType}-button`}>
              <span className="mr-2">+</span> Create New Version
            </Button>
          </Link>
        </div>

        {publishedPolicy && (
          <Card className="border-green-500 border-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-green-600">📄 Active: {publishedPolicy.title}</span>
                <span className="text-sm font-normal text-gray-500">v{publishedPolicy.version}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><strong>Published:</strong> {new Date(publishedPolicy.published_at!).toLocaleDateString()}</p>
                <p><strong>Effective:</strong> {new Date(publishedPolicy.effective_date!).toLocaleDateString()}</p>
                <div className="mt-4 flex gap-2">
                  <Link href={`/settings/policies/${publishedPolicy.id}`}>
                    <Button variant="outline" size="sm">View</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          <h4 className="text-md font-medium">All Versions</h4>
          {policyList.length === 0 ? (
            <p className="text-gray-500">No policies created yet.</p>
          ) : (
            <div className="space-y-2">
              {policyList.map((policy) => (
                <Card key={policy.id} className={policy.status === 'published' ? 'opacity-50' : ''}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="text-base">{policy.title}</span>
                      <span className="text-xs px-2 py-1 rounded bg-gray-200">{policy.status}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-600">
                        <p>Version: {policy.version}</p>
                        <p>Created: {new Date(policy.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/settings/policies/${policy.id}`}>
                          <Button variant="outline" size="sm">View</Button>
                        </Link>
                        {policy.status === 'draft' && (
                          <>
                            <Link href={`/settings/policies/${policy.id}/edit`}>
                              <Button variant="outline" size="sm">Edit</Button>
                            </Link>
                            <Button
                              onClick={() => publishPolicy(policy.id)}
                              size="sm"
                              testID={`publish-${policy.id}-button`}
                            >
                              Publish
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
          <h1 className="text-3xl font-bold">Platform Policies</h1>
          <p className="text-gray-600 mt-1">Manage Terms of Service, Privacy Policy, and Legal Disclaimers</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PolicyType)}>
        <TabsList>
          <TabsTrigger value="terms_of_service" testID="tab-terms-of-service">
            Terms of Service
          </TabsTrigger>
          <TabsTrigger value="privacy_policy" testID="tab-privacy-policy">
            Privacy Policy
          </TabsTrigger>
          <TabsTrigger value="liability_disclaimer" testID="tab-liability-disclaimer">
            Liability Disclaimer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="terms_of_service" className="mt-6">
          <PolicyList policyType="terms_of_service" title="Terms of Service" />
        </TabsContent>

        <TabsContent value="privacy_policy" className="mt-6">
          <PolicyList policyType="privacy_policy" title="Privacy Policy" />
        </TabsContent>

        <TabsContent value="liability_disclaimer" className="mt-6">
          <PolicyList policyType="liability_disclaimer" title="Liability Disclaimer" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
