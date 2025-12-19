/**
 * File: p2p-kids-admin/src/app/components/ListingAnalytics.tsx
 * MODULE-04 LISTING-V2-006: Analytics for listing management
 * 
 * Features:
 * - Real-time metrics from listing_admin_analytics view
 * - SP adoption rate percentage
 * - Price statistics (min, max, average)
 * - Seller count
 * - Days active tracking
 */

'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

interface ListingAnalytics {
  active_listings: number;
  deleted_listings: number;
  paused_listings: number;
  sp_eligible_listings: number;
  active_sp_listings: number;
  sp_adoption_rate: number;
  avg_listing_price: number;
  min_listing_price: number;
  max_listing_price: number;
  total_sellers: number;
  days_active: number;
}

export default function ListingAnalytics() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [analytics, setAnalytics] = useState<ListingAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
    
    // Refresh every 60 seconds
    const interval = setInterval(loadAnalytics, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('listing_admin_analytics')
        .select('*')
        .single();

      if (queryError) {
        console.error('[ListingAnalytics] Query error:', queryError);
        setError('Failed to load analytics');
        return;
      }

      setAnalytics(data);
    } catch (err) {
      console.error('[ListingAnalytics] Error:', err);
      setError('Error loading analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block animate-spin">
          <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
        <p className="mt-2 text-gray-600">Loading analytics...</p>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 font-medium">⚠️ {error || 'Failed to load analytics'}</p>
        <button
          onClick={loadAnalytics}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  // Calculate additional metrics
  const totalListings = analytics.active_listings + analytics.deleted_listings + analytics.paused_listings;
  const activeRatio = totalListings > 0 ? ((analytics.active_listings / totalListings) * 100).toFixed(1) : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">📊 Listing Analytics (Last 30 Days)</h1>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Active Listings */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Active Listings</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{analytics.active_listings}</p>
              <p className="text-xs text-gray-500 mt-1">{activeRatio}% of total</p>
            </div>
            <span className="text-3xl">📋</span>
          </div>
        </div>

        {/* SP Eligible */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">SP-Eligible Listings</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{analytics.sp_eligible_listings}</p>
              <p className="text-xs text-gray-500 mt-1">Adoption: {analytics.sp_adoption_rate}%</p>
            </div>
            <span className="text-3xl">⚡</span>
          </div>
        </div>

        {/* Paused Listings */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Paused Listings</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{analytics.paused_listings}</p>
              <p className="text-xs text-gray-500 mt-1">Temporarily hidden</p>
            </div>
            <span className="text-3xl">⏸</span>
          </div>
        </div>

        {/* Deleted Listings */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Deleted Listings</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{analytics.deleted_listings}</p>
              <p className="text-xs text-gray-500 mt-1">Archived</p>
            </div>
            <span className="text-3xl">🗑</span>
          </div>
        </div>
      </div>

      {/* Pricing & Market Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Price Statistics */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">💰 Price Statistics</h2>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Price</p>
              <p className="text-2xl font-bold text-gray-900">
                ${analytics.avg_listing_price?.toFixed(2) || 'N/A'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Minimum</p>
                <p className="text-xl font-bold text-gray-900">
                  ${analytics.min_listing_price?.toFixed(2) || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Maximum</p>
                <p className="text-xl font-bold text-gray-900">
                  ${analytics.max_listing_price?.toFixed(2) || 'N/A'}
                </p>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded mt-4">
              <p className="text-sm text-blue-900">
                Price range: ${analytics.min_listing_price?.toFixed(2)} - ${analytics.max_listing_price?.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Community Metrics */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">👥 Community Metrics</h2>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Sellers</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.total_sellers}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-600">Days Active</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.days_active}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-600">SP-Eligible Rate</p>
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full"
                    style={{
                      width: `${Math.min(analytics.sp_adoption_rate, 100)}%`,
                    }}
                  ></div>
                </div>
                <p className="mt-2 text-lg font-bold text-gray-900">
                  {analytics.sp_adoption_rate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">📈 Summary</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded">
            <p className="text-sm text-gray-600">Total Listings</p>
            <p className="text-2xl font-bold text-gray-900">{totalListings}</p>
          </div>

          <div className="bg-blue-50 p-4 rounded">
            <p className="text-sm text-blue-600 font-medium">SP-Eligible Active</p>
            <p className="text-2xl font-bold text-blue-900">{analytics.active_sp_listings}</p>
          </div>

          <div className="bg-green-50 p-4 rounded">
            <p className="text-sm text-green-600 font-medium">Health Check</p>
            <p className="text-2xl font-bold text-green-900">
              {activeRatio}% Active
            </p>
          </div>
        </div>
      </div>

      {/* Refresh Info */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>Analytics update automatically every 60 seconds</p>
        <button
          onClick={loadAnalytics}
          className="mt-2 text-blue-600 hover:text-blue-800 font-medium underline"
        >
          Refresh Now
        </button>
      </div>
    </div>
  );
}
