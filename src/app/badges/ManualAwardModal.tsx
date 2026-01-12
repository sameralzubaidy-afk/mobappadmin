'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

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
}

interface User {
  id: string;
  email: string;
  display_name?: string;
}

interface ManualAwardModalProps {
  badges: Badge[];
  onClose: () => void;
  onSuccess: () => void;
}

export function ManualAwardModal({ badges, onClose, onSuccess }: ManualAwardModalProps) {
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedBadgeId, setSelectedBadgeId] = useState('');
  const [reason, setReason] = useState('');
  const [searching, setSearching] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearchUser = async () => {
    if (!searchEmail.trim()) {
      setSearchError('Please enter an email address');
      return;
    }

    setSearching(true);
    setSearchError(null);
    setSelectedUser(null);

    try {
      const supabase = createAuthenticatedClient();
      
      // Debug: Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('User not authenticated - session may have expired');
        setSearchError('Authentication required. Please reload the page.');
        return;
      }

      console.log('Searching for user:', searchEmail.trim());
      const { data, error: searchError } = await supabase
        .from('profiles')
        .select('user_id,email,display_name:name')
        .eq('email', searchEmail.trim())
        .single();

      if (searchError) {
        console.error('Search error:', searchError);
        if (searchError.code === 'PGRST116') {
          setSearchError('User not found');
        } else {
          setSearchError(`Error: ${searchError.message}`);
        }
        return;
      }

      if (!data) {
        setSearchError('User not found');
        return;
      }

      setSelectedUser({
        id: data.user_id,
        email: data.email,
        display_name: data.display_name,
      });
    } catch (err: any) {
      console.error('Error searching user:', err);
      setSearchError(err.message || 'Error searching for user');
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser || !selectedBadgeId) {
      setError('Please select both user and badge');
      return;
    }

    setError(null);
    setAwarding(true);

    try {
      const supabase = createAuthenticatedClient();
      const { data, error: awardError } = await supabase.rpc('manual_award_badge', {
        p_user_id: selectedUser.id,
        p_badge_id: selectedBadgeId,
        p_reason: reason || null,
      });

      if (awardError) throw awardError;

      if (!data?.success) {
        throw new Error(data?.message || 'Failed to award badge');
      }

      onSuccess();
    } catch (err: any) {
      console.error('Error awarding badge:', err);
      setError(err.message || 'Failed to award badge');
    } finally {
      setAwarding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Manual Badge Award</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
            disabled={awarding}
          >
            <span className="text-2xl">&times;</span>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* User Search */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Search User</h4>
          
          <div className="flex space-x-2">
            <input
              type="email"
              placeholder="Enter user email"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={searching || awarding}
            />
            <button
              type="button"
              onClick={handleSearchUser}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={searching || awarding}
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {searchError && (
            <p className="mt-2 text-sm text-red-600">{searchError}</p>
          )}

          {selectedUser && (
            <div className="mt-3 p-3 bg-white border border-gray-300 rounded-md">
              <p className="text-sm font-medium text-gray-900">{selectedUser.display_name || 'No name'}</p>
              <p className="text-sm text-gray-600">{selectedUser.email}</p>
            </div>
          )}
        </div>

        {/* Form */}
        {selectedUser && (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Badge Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Badge
                </label>
                <select
                  value={selectedBadgeId}
                  onChange={(e) => setSelectedBadgeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">-- Select a badge --</option>
                  {badges.map((badge) => (
                    <option key={badge.id} value={badge.id}>
                      {badge.name} ({badge.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Enter reason for manual badge award"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={awarding}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                disabled={awarding}
              >
                {awarding ? 'Awarding...' : 'Award Badge'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
