'use client';

// filepath: p2p-kids-admin/src/app/nodes/page.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import NodeFormModal from './NodeFormModal';
import type { GeographicNode } from '@/types/nodes';

// N6 — per-node marketplace KPIs (shape of admin_node_kpis RPC).
interface NodeKpi {
  node_id: string;
  node_name: string;
  users: number;
  listings: number;
  trades: number;
  completed_trades: number;
  gmv_cents: number;
  platform_fee_cents: number;
  paid_payouts_cents: number;
  sp_earned: number;
  sp_spent: number;
}

// BP-49: browser fetches to /api/admin/* must send the x-admin-secret header.
const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '';

function formatMoney(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatInt(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString();
}

export default function NodesPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = useMemo(
    () => createClient(supabaseUrl, supabaseAnonKey),
    [supabaseUrl, supabaseAnonKey]
  );

  const [nodes, setNodes] = useState<GeographicNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNode, setEditingNode] = useState<GeographicNode | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [kpis, setKpis] = useState<NodeKpi[]>([]);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [kpisError, setKpisError] = useState<string | null>(null);

  // N6 — load per-node KPIs from the server route (RPC is service-role only).
  const loadKpis = useCallback(async () => {
    try {
      setKpisLoading(true);
      setKpisError(null);
      const res = await fetch('/api/admin/nodes/kpis', {
        headers: { 'x-admin-secret': adminSecret },
        cache: 'no-store',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Failed to load KPIs (${res.status})`);
      }
      const json = await res.json();
      setKpis(Array.isArray(json?.data) ? json.data : []);
    } catch (err) {
      console.error('[nodes] loadKpis error:', err);
      setKpisError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setKpisLoading(false);
    }
  }, []);

  const loadNodes = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('nodes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNodes(data || []);
    } catch (error) {
      console.error('Failed to load nodes:', error);
      alert(`Failed to load nodes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadNodes();
    loadKpis();
  }, [loadNodes, loadKpis]);

  const handleEdit = (node: GeographicNode) => {
    setEditingNode(node);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditingNode(null);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingNode(null);
    loadNodes();
  };

  // NODE-002: Handle node activation/deactivation toggle
  const handleToggleActive = async (node: GeographicNode) => {
    const action = node.is_active ? 'deactivate' : 'activate';
    const warningMessage =
      node.is_active && node.member_count > 0
        ? `\n\nWarning: This node has ${node.member_count} active members. They will remain assigned but new users cannot join this node.`
        : '';

    if (
      !confirm(
        `Are you sure you want to ${action} "${node.name}"?${warningMessage}`
      )
    ) {
      return;
    }

    try {
      setTogglingId(node.id);

      // Update node status
      const { error: updateError } = await supabase
        .from('nodes')
        .update({
          is_active: !node.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', node.id);

      if (updateError) throw updateError;

      // Log admin action
      const adminId = (await supabase.auth.getUser()).data.user?.id;
      if (adminId) {
        const { error: auditError } = await supabase
          .from('admin_audit_log')
          .insert({
            admin_id: adminId,
            action: node.is_active ? 'deactivate_node' : 'activate_node',
            entity_type: 'node',
            entity_id: node.id,
            changes: {
              node_name: node.name,
              member_count: node.member_count,
              previous_status: node.is_active,
              new_status: !node.is_active,
            },
          });

        if (auditError) console.error('Failed to log audit entry:', auditError);
      }

      alert(`Node ${action}d successfully!`);
      loadNodes();
    } catch (error: any) {
      console.error('Toggle active error:', error);
      alert(
        `Failed to update node status: ${error.message || 'Unknown error'}`
      );
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading nodes...</div>
      </div>
    );
  }

  // Calculate stats dynamically
  const totalNodes = nodes.length;
  const activeNodes = nodes.filter((n) => n.is_active).length;
  const totalMembers = nodes.reduce((sum, n) => sum + n.member_count, 0);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Geographic Nodes</h1>
          <p className="text-gray-600 mt-1">
            Manage trading areas and node assignments
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
          disabled={loading}
        >
          + Add Node
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition">
          <div className="text-gray-600 text-sm font-medium">Total Nodes</div>
          <div className="text-4xl font-bold text-gray-900 mt-2">{totalNodes}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition">
          <div className="text-gray-600 text-sm font-medium">Active Nodes</div>
          <div className="text-4xl font-bold text-green-600 mt-2">{activeNodes}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition">
          <div className="text-gray-600 text-sm font-medium">Total Members</div>
          <div className="text-4xl font-bold text-blue-600 mt-2">{totalMembers}</div>
        </div>
      </div>

      {/* N6 — Per-Node Marketplace KPIs (GTM §13 / §15.6 expansion-gate metrics) */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Per-Node Marketplace KPIs</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              GTM §13 / §15.6 expansion-gate metrics — users, listings, trades, GMV, fees, payouts, and Swap Points per node.
            </p>
          </div>
          <button
            onClick={() => loadKpis()}
            className="text-xs text-blue-600 hover:text-blue-900 hover:underline"
            disabled={kpisLoading}
          >
            {kpisLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        {kpisError ? (
          <div className="px-6 py-8 text-center text-sm text-red-600">
            We couldn't load per-node KPIs. {kpisError}
          </div>
        ) : kpisLoading ? (
          <div className="px-6 py-8 text-center text-sm text-gray-500">Loading per-node KPIs...</div>
        ) : kpis.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-500">
            No per-node KPI data yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Node', 'Users', 'Listings', 'Trades', 'Completed', 'GMV', 'Platform Fees', 'Paid Payouts', 'SP Earned', 'SP Spent'].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {kpis.map((kpi) => (
                  <tr key={kpi.node_id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-3 text-sm font-semibold text-gray-900">
                      {kpi.node_name}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">{formatInt(kpi.users)}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{formatInt(kpi.listings)}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{formatInt(kpi.trades)}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{formatInt(kpi.completed_trades)}</td>
                    <td className="px-6 py-3 text-sm text-gray-900 font-medium">{formatMoney(kpi.gmv_cents)}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{formatMoney(kpi.platform_fee_cents)}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{formatMoney(kpi.paid_payouts_cents)}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{formatInt(kpi.sp_earned)}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{formatInt(kpi.sp_spent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Nodes Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {nodes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">No nodes found.</p>
            <p className="text-sm mt-1">Click "Add Node" to create your first node.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Node Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Location
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Coordinates
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Radius
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Members
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {nodes.map((node) => (
                  <tr key={node.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-900">
                        {node.name}
                      </div>
                      {node.description && (
                        <div className="text-xs text-gray-500 mt-1">
                          {node.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {node.city}, {node.state}
                      </div>
                      <div className="text-xs text-gray-500">{node.zip_code}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {node.latitude.toFixed(4)}, {node.longitude.toFixed(4)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {node.radius_miles} mi
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="font-semibold text-gray-900">
                        {node.member_count}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          node.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {node.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEdit(node)}
                        className="text-blue-600 hover:text-blue-900 hover:underline transition"
                        disabled={togglingId === node.id}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(node)}
                        className={`transition ${
                          node.is_active
                            ? 'text-red-600 hover:text-red-900 hover:underline'
                            : 'text-green-600 hover:text-green-900 hover:underline'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        disabled={togglingId === node.id}
                      >
                        {togglingId === node.id
                          ? 'Updating...'
                          : node.is_active
                            ? 'Deactivate'
                            : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Node Form Modal */}
      {showForm && <NodeFormModal node={editingNode} onClose={handleFormClose} />}
    </div>
  );
}
