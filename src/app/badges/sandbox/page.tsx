'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Create authenticated Supabase client
function createAuthenticatedClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface User {
  id: string;
  email: string;
}

interface Badge {
  id: string;
  name: string;
  category: string;
  threshold: number;
}

interface SimulationResult {
  success: boolean;
  message: string;
  badgeAwarded?: string;
}

interface ListingForSimulation {
  id: string;
  title: string;
}

export default function BadgeSandboxPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('sp_earning');
  const [spAmount, setSpAmount] = useState<number>(50);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tradeListing, setTradeListing] = useState<ListingForSimulation | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const supabase = createAuthenticatedClient();

      // Load test users (limit to 20 for sandbox)
      // Note: We fetch from profiles and use name/email from profiles table
      // We DON'T use auth.admin.listUsers() because anon key doesn't have admin privileges
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .limit(20)
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      // Map profiles to user list for dropdown
      const usersWithEmails = usersData?.map((profile: any) => ({
        id: profile.user_id,
        email: profile.email || profile.name || 'Unknown User',
      })) || [];

      setUsers(usersWithEmails);

      // Load badges
      const { data: badgesData, error: badgesError } = await supabase
        .from('badges')
        .select('id, name, category, threshold')
        .eq('is_active', true)
        .order('threshold', { ascending: true });

      if (badgesError) throw badgesError;

      setBadges(badgesData || []);

      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('id, title')
        .eq('status', 'available')
        .order('created_at', { ascending: false })
        .limit(1);

      if (itemsError) throw itemsError;

      if (itemsData && itemsData.length > 0) {
        setTradeListing({ id: itemsData[0].id, title: itemsData[0].title });
      } else {
        setTradeListing(null);
      }
    } catch (err: any) {
      console.error('Error loading sandbox data:', err);
      setError(err.message || 'Failed to load sandbox data');
    }
  };

  const simulateSPEvent = async () => {
    if (!selectedUserId) {
      setError('Please select a user');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const supabase = createAuthenticatedClient();
      const tradeId = crypto.randomUUID();
      const rpcName = selectedCategory === 'sp_earning' ? 'earn_sp_for_trade' : 'debit_sp_for_trade';

      const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, {
        p_user_id: selectedUserId,
        p_trade_id: tradeId,
        p_points: spAmount,
      });

      if (rpcError) throw rpcError;

      const rpcResult = rpcData as { success?: boolean; error?: string; balance_after?: number };
      if (rpcResult?.success === false) {
        throw new Error(rpcResult.error || 'SP simulation failed');
      }

      // Wait a moment for any triggers to run
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check if any badges were awarded
      const { data: userBadges, error: badgesError } = await supabase
        .from('user_badges')
        .select('badge_id, badges(name)')
        .eq('user_id', selectedUserId)
        .order('awarded_at', { ascending: false })
        .limit(5);

      if (badgesError) throw badgesError;

      const latestBadge = userBadges?.[0];
      const badgeName = latestBadge ? (latestBadge as any).badges?.name : null;

      const actionVerb = selectedCategory === 'sp_earning' ? 'Awarded' : 'Deducted';
      const formattedCategory = selectedCategory.replace('_', ' ');
      setResult({
        success: true,
        message: `${actionVerb} ${spAmount} SP (${formattedCategory}) · new balance ${rpcResult?.balance_after ?? 'unknown'}`,
        badgeAwarded: badgeName || undefined,
      });
    } catch (err: any) {
      console.error('Simulation error:', err);
      setError(err.message || 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  const simulateTradeCompletion = async () => {
    if (!selectedUserId) {
      setError('Please select a user');
      return;
    }

    if (!tradeListing) {
      setError('No available listing to simulate trades.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const supabase = createAuthenticatedClient();

      // Create a fake trade transaction
      // NOTE: The correct table name is 'trades' (not 'transactions')
      const tradeId = crypto.randomUUID();
      const { error: tradeError } = await supabase.from('trades').insert({
        id: tradeId,
        buyer_id: selectedUserId,
        seller_id: selectedUserId, // Same user for simplicity
        listing_id: tradeListing.id,
        status: 'completed',
        cash_amount_cents: 1000,
        sp_amount: 0,
        buyer_transaction_fee_cents: 0,
        cash_currency: 'usd',
        buyer_subscription_status: 'active',
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });

      if (tradeError) throw tradeError;

      // Wait a moment for trigger to fire
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check if any badges were awarded
      const { data: userBadges, error: badgesError } = await supabase
        .from('user_badges')
        .select('badge_id, badges(name)')
        .eq('user_id', selectedUserId)
        .order('awarded_at', { ascending: false })
        .limit(5);

      if (badgesError) throw badgesError;

      const latestBadge = userBadges?.[0];
      const badgeName = latestBadge ? (latestBadge as any).badges?.name : null;

      setResult({
        success: true,
        message: `Completed trade simulation for ${tradeListing.title}`,
        badgeAwarded: badgeName || undefined,
      });
    } catch (err: any) {
      console.error('Simulation error:', err);
      setError(err.message || 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  const filteredBadges = badges.filter((b) => b.category === selectedCategory);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Badge Sandbox</h1>
        <p className="text-gray-600 mb-6">
          Test badge awarding by simulating SP events and trade completions
        </p>

        {/* User Selection */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Select Test User</h2>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select User --</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.email}
              </option>
            ))}
          </select>
        </div>

        {/* SP Simulation */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Simulate SP Event</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="sp_earning">SP Earning</option>
                <option value="sp_spending">SP Spending</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">SP Amount</label>
              <input
                type="number"
                value={spAmount}
                onChange={(e) => setSpAmount(Number(e.target.value))}
                min="1"
                max="1000"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={simulateSPEvent}
              disabled={loading || !selectedUserId}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Simulating...' : 'Simulate SP Event'}
            </button>
          </div>

          {/* Show eligible badges */}
          {filteredBadges.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium mb-2">Eligible Badges ({selectedCategory}):</h3>
              <ul className="text-sm space-y-1">
                {filteredBadges.map((badge) => (
                  <li key={badge.id} className="text-gray-700">
                    • {badge.name} (Threshold: {badge.threshold})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Trade Simulation */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Simulate Trade Completion</h2>
          <button
            onClick={simulateTradeCompletion}
            disabled={loading || !selectedUserId || !tradeListing}
            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Simulating...' : 'Complete Trade'}
          </button>

          <div className="mt-3">
            {tradeListing ? (
              <p className="text-sm text-gray-500">
                Using listing: <span className="font-medium">{tradeListing.title}</span>
              </p>
            ) : (
              <p className="text-sm text-red-600">
                No available listing to simulate trades. Create or approve an item to continue.
              </p>
            )}
          </div>

          {/* Show trade badges */}
          {badges.filter((b) => b.category === 'trades').length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium mb-2">Eligible Trade Badges:</h3>
              <ul className="text-sm space-y-1">
                {badges
                  .filter((b) => b.category === 'trades')
                  .map((badge) => (
                    <li key={badge.id} className="text-gray-700">
                      • {badge.name} (Threshold: {badge.threshold} trades)
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>

        {/* Result Display */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h3 className="text-green-800 font-semibold mb-2">✅ {result.message}</h3>
            {result.badgeAwarded && (
              <p className="text-green-700">🏆 Badge Awarded: {result.badgeAwarded}</p>
            )}
            {!result.badgeAwarded && (
              <p className="text-green-700">No new badge awarded (may already have it)</p>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-red-800 font-semibold">❌ Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
