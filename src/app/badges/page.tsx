'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BadgeEditor } from './BadgeEditor';
import { ManualAwardModal } from './ManualAwardModal';

// Create authenticated Supabase client
// The session is automatically stored in localStorage by Supabase Auth,
// so each client instance will pick up the authenticated session JWT
function createAuthenticatedClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface Badge {
  id: string;
  name: string;
  description: string;
  category: string;
  icon_url?: string;
  threshold: number;
  is_active: boolean;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at?: string;
}

export default function BadgesPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
  const [showManualAward, setShowManualAward] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadBadges();
  }, []);

  const loadBadges = async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createAuthenticatedClient();
      const { data, error: fetchError } = await supabase
        .from('badges')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;

      setBadges(data || []);
    } catch (err: any) {
      console.error('Error loading badges:', err);
      setError(err.message || 'Failed to load badges');
    } finally {
      setLoading(false);
    }
  };

  const toggleBadgeActive = async (badgeId: string, currentActive: boolean) => {
    try {
      const supabase = createAuthenticatedClient();
      const { error: updateError } = await supabase
        .from('badges')
        .update({ is_active: !currentActive })
        .eq('id', badgeId);

      if (updateError) throw updateError;

      setSuccessMessage(`Badge ${!currentActive ? 'activated' : 'deactivated'} successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
      loadBadges();
    } catch (err: any) {
      console.error('Error toggling badge:', err);
      setError(err.message || 'Failed to toggle badge status');
    }
  };

  const handleBadgeUpdated = () => {
    setEditingBadge(null);
    setSuccessMessage('Badge updated successfully');
    setTimeout(() => setSuccessMessage(null), 3000);
    loadBadges();
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      sp_earning: 'bg-green-100 text-green-800',
      sp_spending: 'bg-blue-100 text-blue-800',
      trades: 'bg-purple-100 text-purple-800',
      subscription: 'bg-yellow-100 text-yellow-800',
      special: 'bg-red-100 text-red-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8">
          <p className="text-gray-600">Loading badges...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Badge Management</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage achievement badges, thresholds, and manual awards
            </p>
          </div>
          <div className="flex space-x-3">
            <a
              href="/badges/sandbox"
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors flex items-center"
            >
              🧪 Sandbox
            </a>
            <button
              onClick={() => setShowManualAward(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Manual Award
            </button>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Badges Table */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Icon
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Threshold
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {badges.map((badge) => (
                <tr key={badge.id} className={badge.is_archived ? 'bg-gray-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {badge.icon_url ? (
                      <img
                        src={badge.icon_url}
                        alt={badge.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-500 text-xs">No Icon</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{badge.name}</div>
                    <div className="text-sm text-gray-500">{badge.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryBadge(
                        badge.category
                      )}`}
                    >
                      {badge.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                    {badge.sort_order}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {badge.threshold}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleBadgeActive(badge.id, badge.is_active)}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        badge.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {badge.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => setEditingBadge(badge)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {badges.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No badges found</p>
            </div>
          )}
        </div>
      </div>

      {/* Badge Editor Modal */}
      {editingBadge && (
        <BadgeEditor
          badge={editingBadge}
          onClose={() => setEditingBadge(null)}
          onSuccess={handleBadgeUpdated}
        />
      )}

      {/* Manual Award Modal */}
      {showManualAward && (
        <ManualAwardModal
          badges={badges.filter((b) => b.is_active)}
          onClose={() => setShowManualAward(false)}
          onSuccess={() => {
            setShowManualAward(false);
            setSuccessMessage('Badge awarded successfully');
            setTimeout(() => setSuccessMessage(null), 3000);
          }}
        />
      )}
    </div>
  );
}
