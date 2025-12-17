'use client';

// filepath: p2p-kids-admin/src/app/nodes/NodeFormModal.tsx

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { GeographicNode, NodeFormData, ZipCodeLookupResult } from '@/types/nodes';

interface NodeFormModalProps {
  node: GeographicNode | null;
  onClose: () => void;
}

export default function NodeFormModal({ node, onClose }: NodeFormModalProps) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const [formData, setFormData] = useState<NodeFormData>({
    name: '',
    city: '',
    state: '',
    zip_code: '',
    latitude: 0,
    longitude: 0,
    radius_miles: 10,
    description: '',
    is_active: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [lookingUpZip, setLookingUpZip] = useState(false);

  // Initialize form with existing node data when editing
  useEffect(() => {
    if (node) {
      setFormData({
        name: node.name || '',
        city: node.city || '',
        state: node.state || '',
        zip_code: node.zip_code || '',
        latitude: node.latitude || 0,
        longitude: node.longitude || 0,
        radius_miles: node.radius_miles || 10,
        description: node.description || '',
        is_active: node.is_active ?? true,
      });
    }
  }, [node]);

  const handleZipCodeChange = async (zipCode: string) => {
    setFormData({ ...formData, zip_code: zipCode });
    setErrors({ ...errors, zip_code: '' });

    // Only lookup if valid 5-digit ZIP code
    if (zipCode.length === 5 && /^\d{5}$/.test(zipCode)) {
      setLookingUpZip(true);
      try {
        const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
        if (response.ok) {
          const data = await response.json();
          if (data.places && data.places.length > 0) {
            const place = data.places[0] as ZipCodeLookupResult;
            setFormData((prev) => ({
              ...prev,
              city: place['place name'],
              state: place['state abbreviation'],
              latitude: parseFloat(place.latitude),
              longitude: parseFloat(place.longitude),
            }));
          } else {
            setErrors((prev) => ({
              ...prev,
              zip_code: 'ZIP code not found. Please enter coordinates manually.',
            }));
          }
        } else {
          setErrors((prev) => ({
            ...prev,
            zip_code: 'Failed to lookup ZIP code. Please enter coordinates manually.',
          }));
        }
      } catch (error) {
        console.error('ZIP lookup error:', error);
        setErrors((prev) => ({
          ...prev,
          zip_code: 'ZIP code lookup service unavailable. Please enter coordinates manually.',
        }));
      } finally {
        setLookingUpZip(false);
      }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name.trim().length < 2) {
      newErrors.name = 'Node name must be at least 2 characters';
    }
    if (!formData.city || formData.city.trim().length < 2) {
      newErrors.city = 'City is required';
    }
    if (!formData.state || formData.state.length !== 2) {
      newErrors.state = 'State must be 2-letter code (e.g., CT)';
    }
    if (!formData.zip_code || !/^\d{5}$/.test(formData.zip_code)) {
      newErrors.zip_code = 'ZIP code must be 5 digits';
    }
    if (formData.latitude === 0 || formData.longitude === 0) {
      newErrors.coordinates = 'Valid coordinates are required (auto-populated from ZIP)';
    }
    if (!formData.radius_miles || formData.radius_miles < 1 || formData.radius_miles > 100) {
      newErrors.radius_miles = 'Radius must be between 1 and 100 miles';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      const adminId = (await supabase.auth.getUser()).data.user?.id;
      if (!adminId) {
        throw new Error('User not authenticated');
      }

      if (node) {
        // Update existing node
        const { error: updateError } = await supabase
          .from('nodes')
          .update({
            name: formData.name.trim(),
            city: formData.city.trim(),
            state: formData.state.toUpperCase(),
            zip_code: formData.zip_code,
            latitude: formData.latitude,
            longitude: formData.longitude,
            radius_miles: formData.radius_miles,
            description: formData.description.trim() || null,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', node.id);

        if (updateError) throw updateError;

        // Log admin action
        const { error: auditError } = await supabase.from('admin_audit_log').insert({
          admin_id: adminId,
          action: 'update_node',
          entity_type: 'node',
          entity_id: node.id,
          changes: {
            before: node,
            after: formData,
          },
        });

        if (auditError) console.error('Failed to log audit entry:', auditError);
      } else {
        // Create new node - use nodes table (not geographic_nodes)
        const { data: insertData, error: insertError } = await supabase
          .from('nodes')
          .insert({
            name: formData.name.trim(),
            city: formData.city.trim(),
            state: formData.state.toUpperCase(),
            zip_code: formData.zip_code,
            latitude: formData.latitude,
            longitude: formData.longitude,
            radius_miles: formData.radius_miles,
            description: formData.description.trim() || null,
            is_active: formData.is_active,
            member_count: 0,
            status: formData.is_active ? 'active' : 'inactive', // Set status based on is_active
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Log admin action
        const { error: auditError } = await supabase.from('admin_audit_log').insert({
          admin_id: adminId,
          action: 'create_node',
          entity_type: 'node',
          changes: formData,
        });

        if (auditError) console.error('Failed to log audit entry:', auditError);
      }

      alert(node ? 'Node updated successfully!' : 'Node created successfully!');
      onClose();
    } catch (error: any) {
      console.error('Save node error:', error);
      alert(`Failed to save node: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">
            {node ? 'Edit Node' : 'Add New Node'}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {node ? 'Update the geographic node details' : 'Create a new trading area node'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Node Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Node Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                setErrors({ ...errors, name: '' });
              }}
              className={`w-full border ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              } rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              placeholder="e.g., Norwalk Central"
              disabled={loading}
            />
            {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* ZIP Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ZIP Code <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formData.zip_code}
              onChange={(e) => handleZipCodeChange(e.target.value)}
              className={`w-full border ${
                errors.zip_code ? 'border-red-500' : 'border-gray-300'
              } rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              placeholder="06850"
              maxLength={5}
              disabled={loading}
            />
            {lookingUpZip && <p className="text-blue-600 text-sm mt-1">🔍 Looking up ZIP code...</p>}
            {errors.zip_code && <p className="text-red-600 text-sm mt-1">{errors.zip_code}</p>}
            <p className="text-gray-500 text-xs mt-1">Enter ZIP code to auto-populate city and coordinates</p>
          </div>

          {/* City and State */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => {
                  setFormData({ ...formData, city: e.target.value });
                  setErrors({ ...errors, city: '' });
                }}
                className={`w-full border ${
                  errors.city ? 'border-red-500' : 'border-gray-300'
                } rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="Norwalk"
                disabled={loading}
              />
              {errors.city && <p className="text-red-600 text-sm mt-1">{errors.city}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => {
                  setFormData({ ...formData, state: e.target.value.toUpperCase() });
                  setErrors({ ...errors, state: '' });
                }}
                className={`w-full border ${
                  errors.state ? 'border-red-500' : 'border-gray-300'
                } rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="CT"
                maxLength={2}
                disabled={loading}
              />
              {errors.state && <p className="text-red-600 text-sm mt-1">{errors.state}</p>}
            </div>
          </div>

          {/* Latitude and Longitude */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Latitude <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                step="0.0001"
                value={formData.latitude}
                onChange={(e) => {
                  setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 });
                  setErrors({ ...errors, coordinates: '' });
                }}
                className={`w-full border ${
                  errors.coordinates ? 'border-red-500' : 'border-gray-300'
                } rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="41.1177"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Longitude <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                step="0.0001"
                value={formData.longitude}
                onChange={(e) => {
                  setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 });
                  setErrors({ ...errors, coordinates: '' });
                }}
                className={`w-full border ${
                  errors.coordinates ? 'border-red-500' : 'border-gray-300'
                } rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="-73.4079"
                disabled={loading}
              />
            </div>
          </div>
          {errors.coordinates && <p className="text-red-600 text-sm">{errors.coordinates}</p>}

          {/* Radius */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Radius (miles) <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              value={formData.radius_miles}
              onChange={(e) => {
                setFormData({ ...formData, radius_miles: parseInt(e.target.value) || 10 });
                setErrors({ ...errors, radius_miles: '' });
              }}
              className={`w-full border ${
                errors.radius_miles ? 'border-red-500' : 'border-gray-300'
              } rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              placeholder="10"
              min="1"
              max="100"
              disabled={loading}
            />
            <p className="text-gray-500 text-xs mt-1">Default search radius for items in this node (1-100 miles)</p>
            {errors.radius_miles && <p className="text-red-600 text-sm mt-1">{errors.radius_miles}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description <span className="text-gray-500 text-sm">(Optional)</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="e.g., Central Norwalk area including downtown and East Norwalk"
              disabled={loading}
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={loading}
            />
            <label htmlFor="is_active" className="block text-sm text-gray-900 cursor-pointer">
              <span className="font-medium">Active Node</span>
              <p className="text-xs text-gray-600 mt-0.5">
                Active nodes accept new user assignments. Inactive nodes are hidden from signup.
              </p>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Saving...' : node ? 'Update Node' : 'Create Node'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
