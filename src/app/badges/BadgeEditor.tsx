'use client';

import { useState } from 'react';
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
  icon_url?: string;
  threshold: number;
  is_active: boolean;
  sort_order: number;
}

interface BadgeEditorProps {
  badge: Badge;
  onClose: () => void;
  onSuccess: () => void;
}

export function BadgeEditor({ badge, onClose, onSuccess }: BadgeEditorProps) {
  const [formData, setFormData] = useState({
    name: badge.name,
    description: badge.description,
    threshold: badge.threshold,
    sort_order: badge.sort_order,
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds 5MB limit');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Allowed: PNG, JPEG, WebP, SVG');
      return;
    }

    setError(null);
    setUploading(true);
    setUploadProgress('Uploading icon...');

    try {
      const supabase = createAuthenticatedClient();
      const filePath = `icons/${badge.id}-${Date.now()}.${file.name.split('.').pop()}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('badge-icons')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setUploadProgress('Generating public URL...');

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('badge-icons')
        .getPublicUrl(filePath);

      setUploadProgress('Updating badge record...');

      // Get current user session to get JWT token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Call Edge Function to update badge with service role (bypasses RLS)
      const updateResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/badges-update-icon`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            badge_id: badge.id,
            icon_url: publicUrl,
          }),
        }
      );

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.error || `Failed to update badge: ${updateResponse.statusText}`);
      }

      setUploadProgress('Icon uploaded successfully!');
      setTimeout(() => {
        setUploadProgress(null);
        onSuccess();
      }, 1500);
    } catch (err: any) {
      console.error('Error uploading icon:', err);
      setError(err.message || 'Failed to upload icon');
      setUploadProgress(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const supabase = createAuthenticatedClient();
      const { error: updateError } = await supabase
        .from('badges')
        .update({
          name: formData.name,
          description: formData.description,
          threshold: formData.threshold,
          sort_order: formData.sort_order,
        })
        .eq('id', badge.id);

      if (updateError) throw updateError;

      onSuccess();
    } catch (err: any) {
      console.error('Error updating badge:', err);
      setError(err.message || 'Failed to update badge');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Edit Badge</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
            disabled={uploading || saving}
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

        {/* Upload Progress */}
        {uploadProgress && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">{uploadProgress}</p>
          </div>
        )}

        {/* Icon Upload Section */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Badge Icon</h4>
          
          <div className="flex items-center space-x-4">
            {/* Current Icon Preview */}
            <div>
              {badge.icon_url ? (
                <img
                  src={badge.icon_url}
                  alt={badge.name}
                  className="h-20 w-20 rounded-lg object-cover border border-gray-300"
                />
              ) : (
                <div className="h-20 w-20 rounded-lg bg-gray-200 flex items-center justify-center border border-gray-300">
                  <span className="text-gray-500 text-xs">No Icon</span>
                </div>
              )}
            </div>

            {/* Upload Button */}
            <div className="flex-1">
              <label className="block">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  onChange={handleFileUpload}
                  disabled={uploading || saving}
                  className="hidden"
                  id="icon-upload"
                />
                <label
                  htmlFor="icon-upload"
                  className={`cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none ${
                    uploading || saving ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {uploading ? 'Uploading...' : 'Upload New Icon'}
                </label>
              </label>
              <p className="mt-2 text-xs text-gray-500">
                PNG, JPEG, WebP, or SVG (max 5MB)
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Threshold */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Threshold
              </label>
              <input
                type="number"
                value={formData.threshold}
                onChange={(e) =>
                  setFormData({ ...formData, threshold: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort Order
              </label>
              <input
                type="number"
                value={formData.sort_order}
                onChange={(e) =>
                  setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Category (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category (read-only)
              </label>
              <input
                type="text"
                value={badge.category}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              disabled={uploading || saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              disabled={uploading || saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
