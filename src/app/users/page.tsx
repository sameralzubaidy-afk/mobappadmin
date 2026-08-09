'use client';

// Task: ADMIN-V2-006 - User Management Dashboard
// Full-featured user management with search, filters, pagination, and admin actions

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ===========================
// TYPES
// ===========================

type AccountStatus = 'active' | 'suspended' | 'banned' | 'deleted';
type SubscriptionStatus = 'trial' | 'active' | 'grace_period' | 'cancelled' | 'expired' | 'none';

type DeletionType = 'self' | 'admin' | null;

interface User {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  account_status: AccountStatus;
  deletion_type: DeletionType;
  subscription_status: SubscriptionStatus;
  subscription_tier: string;
  node_id: string | null;
  registered_at: string;
  last_login_at: string | null;
  trade_count: number;
  sp_balance: number;
  badge_count: number;
}

interface UserDetail {
  identity: {
    user_id: string;
    profile_id: string;
    name: string;
    email: string;
    phone: string;
    avatar_url: string | null;
    date_of_birth: string | null;
    account_status: AccountStatus;
    registered_at: string;
    last_login_at: string | null;
    phone_verified: boolean;
    suspended_at: string | null;
    suspension_reason: string | null;
    node_id: string | null;
    node_name: string | null;
  };
  subscription: {
    status: SubscriptionStatus;
    tier: string;
    started_at: string;
    trial_ends_at: string | null;
    period_end_at: string | null;
    cancelled_at: string | null;
  } | null;
  sp_wallet: {
    available_balance: number;
    pending_balance: number;
    status: string;
    lifetime_earned: number;
    lifetime_spent: number;
  } | null;
  trade_activity: {
    total_completed: number;
    as_seller: number;
    as_buyer: number;
    last_trade_at: string | null;
  };
  approved_items: Array<{
    id: string;
    title: string;
    price: number;
    status: string;
    approved_at: string | null;
    node_id: string | null;
    created_at: string;
  }> | null;
  badges: Array<{
    name: string;
    icon: string;
    awarded_at: string;
  }> | null;
  recent_activity: Array<{
    action_type: string;
    performed_by: string;
    created_at: string;
    notes: string;
  }> | null;
}

interface UserAnalytics {
  total_users: number;
  active_users: number;
  suspended_users: number;
  deleted_users: number;
  new_this_month: number;
  dau: number;
  mau: number;
  subscription_breakdown: Record<string, number>;
}

// ===========================
// MAIN COMPONENT
// ===========================

export default function UsersPage() {
  // State
  const [users, setUsers] = useState<User[]>([]);
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [failedAvatarByUserId, setFailedAvatarByUserId] = useState<Record<string, boolean>>({});
  const [detailAvatarFailed, setDetailAvatarFailed] = useState(false);
  
  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [accountStatusFilter, setAccountStatusFilter] = useState<string>('');
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('registered_at');
  const [sortOrder, setSortOrder] = useState<string>('DESC');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input (250ms) to avoid excessive API calls
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [search]);

  // Prefill search from ?search= (command palette deep link).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('search');
    if (q) setSearch(q);
  }, []);

  // Fetch analytics
  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Fetch users (triggered by debouncedSearch, not raw search)
  useEffect(() => {
    fetchUsers();
  }, [page, debouncedSearch, accountStatusFilter, subscriptionStatusFilter, sortBy, sortOrder]);

  const getAuthHeaders = async (): Promise<HeadersInit> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/admin/users/analytics', {
        headers: await getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: '20',
      });

      if (debouncedSearch) params.set('search', debouncedSearch);
      if (accountStatusFilter) params.set('account_status', accountStatusFilter);
      if (subscriptionStatusFilter) params.set('subscription_status', subscriptionStatusFilter);
      params.set('sort_by', sortBy);
      params.set('sort_order', sortOrder);

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: await getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setTotal(data.total || 0);
        setTotalPages(data.total_pages || 1);
        setFailedAvatarByUserId({});
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.error || 'Failed to fetch users'}`);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      alert('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetail = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        headers: await getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setDetailAvatarFailed(false);
        setSelectedUser(data);
        setIsDetailPanelOpen(true);
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.error || 'Failed to fetch user detail'}`);
      }
    } catch (error) {
      console.error('Failed to fetch user detail:', error);
      alert('Failed to fetch user detail');
    }
  };

  const handleSuspend = async (userId: string) => {
    const reason = prompt('Enter suspension reason:');
    if (!reason || reason.trim() === '') {
      alert('Suspension reason is required');
      return;
    }

    const confirmed = confirm(`Are you sure you want to suspend this user?\n\nReason: ${reason}`);
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ reason }),
      });

      if (res.ok) {
        alert('User suspended successfully');
        setIsDetailPanelOpen(false);
        fetchUsers();
        fetchAnalytics();
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.error || 'Failed to suspend user'}`);
      }
    } catch (error) {
      console.error('Failed to suspend user:', error);
      alert('Failed to suspend user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsuspend = async (userId: string) => {
    const reason = prompt('Enter unsuspension reason:');
    if (!reason || reason.trim() === '') {
      alert('Unsuspension reason is required');
      return;
    }

    const confirmed = confirm(`Are you sure you want to unsuspend this user?\n\nReason: ${reason}`);
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/admin/users/${userId}/unsuspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ reason }),
      });

      if (res.ok) {
        alert('User unsuspended successfully');
        setIsDetailPanelOpen(false);
        fetchUsers();
        fetchAnalytics();
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.error || 'Failed to unsuspend user'}`);
      }
    } catch (error) {
      console.error('Failed to unsuspend user:', error);
      alert('Failed to unsuspend user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (userId: string, userEmail: string) => {
    const confirmed = confirm(
      `Send password reset email to:\n${userEmail}\n\nAre you sure?`
    );
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message || 'Password reset email sent successfully');
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.error || 'Failed to send password reset email'}`);
      }
    } catch (error) {
      console.error('Failed to trigger password reset:', error);
      alert('Failed to trigger password reset');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (userId: string) => {
    const reason = prompt('⚠️ SOFT DELETE USER ⚠️\n\nEnter deletion reason:');
    if (!reason || reason.trim() === '') {
      alert('Deletion reason is required');
      return;
    }

    const confirmed = confirm(
      `⚠️ This will SOFT DELETE the user account.\n\n` +
      `- Profile marked as deleted\n` +
      `- SP wallet frozen\n` +
      `- User cannot login\n\n` +
      `Reason: ${reason}\n\nProceed?`
    );
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ reason }),
      });

      if (res.ok) {
        alert('User deleted successfully (soft delete)');
        setIsDetailPanelOpen(false);
        fetchUsers();
        fetchAnalytics();
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.error || 'Failed to delete user'}`);
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper: Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Helper: Format datetime
  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Helper: Account status badge
  const getAccountStatusBadge = (status: AccountStatus) => {
    const styles: Record<AccountStatus, string> = {
      active: 'bg-green-100 text-green-800',
      suspended: 'bg-orange-100 text-orange-800',
      banned: 'bg-red-100 text-red-800',
      deleted: 'bg-rose-100 text-rose-800',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status]}`}>
        {status}
      </span>
    );
  };

  // Helper: Subscription status badge
  const getSubscriptionBadge = (status: SubscriptionStatus) => {
    const styles: Record<SubscriptionStatus, string> = {
      trial: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      grace_period: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-gray-100 text-gray-800',
      expired: 'bg-red-100 text-red-800',
      none: 'bg-gray-100 text-gray-600',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status]}`}>
        {status === 'none' ? 'Free' : status}
      </span>
    );
  };

  const markAvatarAsFailed = (userId: string) => {
    setFailedAvatarByUserId((prev) => {
      if (prev[userId]) return prev;
      return { ...prev, [userId]: true };
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">User Management</h1>

      {/* Analytics Header */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded shadow border border-gray-200">
            <div className="text-sm text-gray-600">Total Users</div>
            <div className="text-2xl font-bold">{analytics.total_users}</div>
          </div>
          <div className="bg-white p-4 rounded shadow border border-gray-200">
            <div className="text-sm text-gray-600">Active</div>
            <div className="text-2xl font-bold text-green-600">{analytics.active_users}</div>
          </div>
          <div className="bg-white p-4 rounded shadow border border-gray-200">
            <div className="text-sm text-gray-600">Suspended</div>
            <div className="text-2xl font-bold text-orange-600">{analytics.suspended_users}</div>
          </div>
          <div className="bg-white p-4 rounded shadow border border-gray-200">
            <div className="text-sm text-gray-600">New This Month</div>
            <div className="text-2xl font-bold text-blue-600">{analytics.new_this_month}</div>
          </div>
          <div className="bg-white p-4 rounded shadow border border-gray-200">
            <div className="text-sm text-gray-600">DAU</div>
            <div className="text-2xl font-bold">{analytics.dau}</div>
          </div>
          <div className="bg-white p-4 rounded shadow border border-gray-200">
            <div className="text-sm text-gray-600">MAU</div>
            <div className="text-2xl font-bold">{analytics.mau}</div>
          </div>
          <div className="bg-white p-4 rounded shadow border border-gray-200">
            <div className="text-sm text-gray-600">Deleted</div>
            <div className="text-2xl font-bold text-red-600">{analytics.deleted_users}</div>
          </div>
          <div className="bg-white p-4 rounded shadow border border-gray-200">
            <div className="text-sm text-gray-600">Subscribers</div>
            <div className="text-2xl font-bold text-primary-600">
              {(analytics.subscription_breakdown.trial || 0) +
                (analytics.subscription_breakdown.active || 0) +
                (analytics.subscription_breakdown.grace_period || 0)}
            </div>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded shadow border border-gray-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search (name, email, phone, user ID)
            </label>
            <input
              type="text"
              placeholder="Search by name, email, phone, or user ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Status
            </label>
            <select
              value={accountStatusFilter}
              onChange={(e) => {
                setAccountStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subscription Status
            </label>
            <select
              value={subscriptionStatusFilter}
              onChange={(e) => {
                setSubscriptionStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="grace_period">Grace Period</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
              <option value="none">Free</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="registered_at">Registered Date</option>
                <option value="sp_balance">SP Balance</option>
                <option value="trade_count">Trade Count</option>
                <option value="name">Name</option>
                <option value="email">Email</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value);
                  setPage(1);
                }}
                className="w-28 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="DESC">Desc</option>
                <option value="ASC">Asc</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded shadow border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold">
            Users ({total} total, page {page} of {totalPages})
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subscription</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registered</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stats</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => fetchUserDetail(user.user_id)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-3">
                        {user.avatar_url && !failedAvatarByUserId[user.user_id] ? (
                          <img
                            src={user.avatar_url}
                            alt={user.name}
                            className="w-8 h-8 rounded-full object-cover"
                            onError={() => markAvatarAsFailed(user.user_id)}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-500">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.phone || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 items-center">
                        {getAccountStatusBadge(user.account_status)}
                        {user.account_status === 'deleted' && user.deletion_type === 'self' && (
                          <span className="px-2 py-1 rounded text-xs font-semibold bg-primary-100 text-primary-800">
                            Self-Deleted
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{getSubscriptionBadge(user.subscription_status)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(user.registered_at)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(user.last_login_at)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div>Trades: {user.trade_count}</div>
                      <div>SP: {user.sp_balance}</div>
                      <div>Badges: {user.badge_count}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex justify-between items-center">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* User Detail Panel (Modal) */}
      {isDetailPanelOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-2xl font-bold">User Detail</h2>
              <button
                onClick={() => setIsDetailPanelOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Identity */}
              <section>
                <h3 className="text-lg font-semibold mb-3 text-gray-800">Identity</h3>
                <div className="bg-gray-50 p-4 rounded space-y-2 text-sm">
                  <div className="flex items-center space-x-3">
                    {selectedUser.identity.avatar_url && !detailAvatarFailed ? (
                      <img
                        src={selectedUser.identity.avatar_url}
                        alt={selectedUser.identity.name}
                        className="w-16 h-16 rounded-full object-cover"
                        onError={() => setDetailAvatarFailed(true)}
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-semibold text-gray-500">
                        {selectedUser.identity.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-lg">{selectedUser.identity.name}</div>
                      <div className="text-gray-600">{selectedUser.identity.email}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div><span className="font-semibold">User ID:</span> {selectedUser.identity.user_id}</div>
                    <div><span className="font-semibold">Phone:</span> {selectedUser.identity.phone || 'N/A'}</div>
                    <div><span className="font-semibold">DOB:</span> {formatDate(selectedUser.identity.date_of_birth)}</div>
                    <div><span className="font-semibold">Status:</span> {getAccountStatusBadge(selectedUser.identity.account_status)}</div>
                    <div><span className="font-semibold">Registered:</span> {formatDate(selectedUser.identity.registered_at)}</div>
                    <div><span className="font-semibold">Last Login:</span> {formatDate(selectedUser.identity.last_login_at)}</div>
                    <div><span className="font-semibold">Phone Verified:</span> {selectedUser.identity.phone_verified ? '✅ Yes' : '❌ No'}</div>
                    <div><span className="font-semibold">Node:</span> {selectedUser.identity.node_name || <span className="text-gray-400">N/A</span>}</div>
                  </div>
                  {selectedUser.identity.suspended_at && (
                    <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded">
                      <div className="font-semibold text-orange-800">⚠️ Suspended</div>
                      <div className="text-xs text-orange-700">
                        <div>Date: {formatDateTime(selectedUser.identity.suspended_at)}</div>
                        <div>Reason: {selectedUser.identity.suspension_reason}</div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Subscription */}
              <section>
                <h3 className="text-lg font-semibold mb-3 text-gray-800">Subscription</h3>
                {selectedUser.subscription ? (
                  <div className="bg-gray-50 p-4 rounded space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="font-semibold">Status:</span> {getSubscriptionBadge(selectedUser.subscription.status)}</div>
                      <div><span className="font-semibold">Tier:</span> {selectedUser.subscription.tier}</div>
                      <div><span className="font-semibold">Started:</span> {formatDate(selectedUser.subscription.started_at)}</div>
                      <div><span className="font-semibold">Trial Ends:</span> {formatDate(selectedUser.subscription.trial_ends_at)}</div>
                      <div><span className="font-semibold">Period End:</span> {formatDate(selectedUser.subscription.period_end_at)}</div>
                      <div><span className="font-semibold">Cancelled:</span> {formatDate(selectedUser.subscription.cancelled_at)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 rounded text-sm text-gray-600">
                    No subscription record found (Free user)
                  </div>
                )}
              </section>

              {/* SP Wallet */}
              <section>
                <h3 className="text-lg font-semibold mb-3 text-gray-800">SP Wallet</h3>
                {selectedUser.sp_wallet ? (
                  <div className="bg-gray-50 p-4 rounded space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="font-semibold">Available SP:</span> {selectedUser.sp_wallet.available_balance} SP</div>
                      <div><span className="font-semibold">Pending SP:</span> {selectedUser.sp_wallet.pending_balance} SP</div>
                      <div><span className="font-semibold">Status:</span> <span className="capitalize">{selectedUser.sp_wallet.status}</span></div>
                      <div><span className="font-semibold">Lifetime Earned:</span> {selectedUser.sp_wallet.lifetime_earned} SP</div>
                      <div><span className="font-semibold">Lifetime Spent:</span> {selectedUser.sp_wallet.lifetime_spent} SP</div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 rounded text-sm text-gray-600">
                    No SP wallet found
                  </div>
                )}
              </section>

              {/* Trade Activity */}
              <section>
                <h3 className="text-lg font-semibold mb-3 text-gray-800">Trade Activity</h3>
                <div className="bg-gray-50 p-4 rounded space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="font-semibold">Total Completed:</span> {selectedUser.trade_activity.total_completed}</div>
                    <div><span className="font-semibold">As Seller:</span> {selectedUser.trade_activity.as_seller}</div>
                    <div><span className="font-semibold">As Buyer:</span> {selectedUser.trade_activity.as_buyer}</div>
                    <div><span className="font-semibold">Last Trade:</span> {formatDate(selectedUser.trade_activity.last_trade_at)}</div>
                  </div>
                </div>
              </section>

              {/* Approved Items */}
              <section>
                <h3 className="text-lg font-semibold mb-3 text-gray-800">Approved Items ({selectedUser.approved_items?.length || 0})</h3>
                {selectedUser.approved_items && selectedUser.approved_items.length > 0 ? (
                  <div className="bg-gray-50 p-4 rounded">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item ID</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Approved</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {selectedUser.approved_items.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-100">
                              <td className="px-3 py-2 font-mono text-xs text-gray-600">{item.id}</td>
                              <td className="px-3 py-2 font-medium">{item.title}</td>
                              <td className="px-3 py-2 text-right">${Number(item.price).toFixed(2)}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  item.status === 'available' ? 'bg-green-100 text-green-800' :
                                  item.status === 'sold' ? 'bg-blue-100 text-blue-800' :
                                  item.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {item.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-600">{formatDate(item.approved_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 rounded text-sm text-gray-600">No approved items found</div>
                )}
              </section>

              {/* Badges */}
              <section>
                <h3 className="text-lg font-semibold mb-3 text-gray-800">Badges ({selectedUser.badges?.length || 0})</h3>
                {selectedUser.badges && selectedUser.badges.length > 0 ? (
                  <div className="bg-gray-50 p-4 rounded">
                    <div className="flex flex-wrap gap-2">
                      {selectedUser.badges.map((badge, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-1 bg-white border border-gray-200 rounded flex items-center space-x-2"
                        >
                          <span>{badge.icon}</span>
                          <span className="text-sm font-medium">{badge.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 rounded text-sm text-gray-600">No badges earned yet</div>
                )}
              </section>

              {/* Recent Admin Activity */}
              <section>
                <h3 className="text-lg font-semibold mb-3 text-gray-800">Recent Admin Activity</h3>
                {selectedUser.recent_activity && selectedUser.recent_activity.length > 0 ? (
                  <div className="bg-gray-50 p-4 rounded space-y-2">
                    {selectedUser.recent_activity.map((activity, idx) => (
                      <div key={idx} className="text-sm border-b border-gray-200 pb-2 last:border-0">
                        <div className="font-semibold">{activity.action_type}</div>
                        <div className="text-gray-600">
                          By: {activity.performed_by} • {formatDateTime(activity.created_at)}
                        </div>
                        {activity.notes && <div className="text-gray-500 text-xs mt-1">{activity.notes}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 rounded text-sm text-gray-600">No admin activity yet</div>
                )}
              </section>

              {/* Admin Actions */}
              <section>
                <h3 className="text-lg font-semibold mb-3 text-gray-800">Admin Actions</h3>
                <div className="flex flex-wrap gap-3">
                  {selectedUser.identity.account_status === 'active' ? (
                    <button
                      onClick={() => handleSuspend(selectedUser.identity.user_id)}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
                    >
                      Suspend User
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUnsuspend(selectedUser.identity.user_id)}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      Unsuspend User
                    </button>
                  )}
                  <button
                    onClick={() =>
                      handleResetPassword(selectedUser.identity.user_id, selectedUser.identity.email)
                    }
                    disabled={actionLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    Reset Password
                  </button>
                  <button
                    onClick={() => handleDelete(selectedUser.identity.user_id)}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    Delete User (Soft)
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
