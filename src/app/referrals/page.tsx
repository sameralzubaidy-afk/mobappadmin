'use client';

// Admin Referral Management Page (with tabs)
// filepath: p2p-kids-admin/src/app/referrals/page.tsx

import { useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import ConfigurationTab from './configuration-tab';

// Dynamically import analytics tab as server component
const AnalyticsTab = dynamic(() => import('./analytics-tab'), {
  loading: () => <div className="py-8 text-center text-gray-500">Loading analytics...</div>,
  ssr: true,
});

export default function ReferralManagementPage() {
  const [activeTab, setActiveTab] = useState<'configuration' | 'analytics'>('configuration');

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Referral Program Management</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('configuration')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'configuration'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Configuration
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'analytics'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Analytics
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="py-4">
        {activeTab === 'configuration' && (
          <Suspense fallback={<div className="py-8 text-center text-gray-500">Loading configuration...</div>}>
            <ConfigurationTab />
          </Suspense>
        )}

        {activeTab === 'analytics' && (
          <Suspense fallback={<div className="py-8 text-center text-gray-500">Loading analytics...</div>}>
            <AnalyticsTab />
          </Suspense>
        )}
      </div>
    </div>
  );
}
