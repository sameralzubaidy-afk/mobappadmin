/**
 * File: p2p-kids-admin/src/app/listings/page.tsx
 * MODULE-04 LISTING-V2-006: Admin Listings Management Page
 * 
 * Main page for admin listing management with:
 * - Search & filter controls
 * - Listing results with admin actions
 * - Analytics dashboard
 */

'use client';

import React, { useState } from 'react';
import ListingSearch from '../components/ListingSearch';
import ListingAnalytics from '../components/ListingAnalytics';

export default function ListingsPage() {
  const [activeTab, setActiveTab] = useState<'search' | 'analytics'>('search');

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Listing Management</h1>
          <p className="mt-2 text-gray-600">
            Search, manage, and analyze listings with admin tools
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'search'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Search & Manage
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'analytics'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Analytics Dashboard
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow">
          {activeTab === 'search' && <ListingSearch />}
          {activeTab === 'analytics' && <ListingAnalytics />}
        </div>
      </div>
    </div>
  );
}
