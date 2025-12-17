'use client';

// filepath: p2p-kids-admin/src/app/nodes/page.tsx

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import NodeFormModal from './NodeFormModal';
import type { GeographicNode } from '@/types/nodes';

export default function NodesPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const [nodes, setNodes] = useState<GeographicNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNode, setEditingNode] = useState<GeographicNode | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    loadNodes();
  }, []);

  const loadNodes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('geographic_nodes')
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
  };

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
        .from('geographic_nodes')
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
            entity_type: 'geographic_node',
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
