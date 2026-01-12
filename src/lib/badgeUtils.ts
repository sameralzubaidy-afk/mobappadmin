// filepath: p2p-kids-admin/src/lib/badgeUtils.ts

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);

export interface BadgeIconUploadResult {
  url: string | null;
  path: string | null;
  error: Error | null;
}

/**
 * Upload badge icon to Supabase Storage (Admin only - uses service role)
 * @param badgeId - Badge ID to associate the icon with
 * @param file - File object from file input
 * @returns Upload result with public URL
 */
export async function uploadBadgeIcon(
  badgeId: string,
  file: File
): Promise<BadgeIconUploadResult> {
  try {
    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return {
        url: null,
        path: null,
        error: new Error(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`),
      };
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        url: null,
        path: null,
        error: new Error('File size exceeds 5MB limit'),
      };
    }

    // Generate unique file path
    const timestamp = Date.now();
    const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filePath = `icons/${badgeId}-${timestamp}.${extension}`;

    // Upload to storage
    const { data, error } = await adminClient.storage
      .from('badge-icons')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('[badgeUtils.uploadBadgeIcon] Upload error:', error);
      return { url: null, path: null, error };
    }

    // Get public URL
    const { data: { publicUrl } } = adminClient.storage
      .from('badge-icons')
      .getPublicUrl(data.path);

    // Update badge with new icon URL
    const { error: updateError } = await adminClient
      .from('badges')
      .update({ icon_url: publicUrl })
      .eq('id', badgeId);

    if (updateError) {
      console.error('[badgeUtils.uploadBadgeIcon] Update error:', updateError);
      return { url: null, path: null, error: updateError };
    }

    console.log('[badgeUtils.uploadBadgeIcon] Success:', publicUrl);
    return { url: publicUrl, path: data.path, error: null };
  } catch (e: any) {
    console.error('[badgeUtils.uploadBadgeIcon] Exception:', e);
    return { url: null, path: null, error: e as Error };
  }
}

/**
 * Delete badge icon from storage (Admin only)
 * @param path - Storage path of the icon
 * @returns Success boolean
 */
export async function deleteBadgeIcon(path: string): Promise<boolean> {
  try {
    const { error } = await adminClient.storage
      .from('badge-icons')
      .remove([path]);

    if (error) {
      console.error('[badgeUtils.deleteBadgeIcon] Error:', error);
      return false;
    }

    console.log('[badgeUtils.deleteBadgeIcon] Success:', path);
    return true;
  } catch (e) {
    console.error('[badgeUtils.deleteBadgeIcon] Exception:', e);
    return false;
  }
}

/**
 * Get public URL for badge icon
 * @param path - Storage path of the icon
 * @returns Public URL
 */
export function getPublicBadgeIconUrl(path: string): string {
  const { data: { publicUrl } } = adminClient.storage
    .from('badge-icons')
    .getPublicUrl(path);
  
  return publicUrl;
}

/**
 * List all badge icons in storage
 * @returns Array of file objects
 */
export async function listBadgeIcons() {
  try {
    const { data, error } = await adminClient.storage
      .from('badge-icons')
      .list('icons', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      console.error('[badgeUtils.listBadgeIcons] Error:', error);
      return [];
    }

    return data;
  } catch (e) {
    console.error('[badgeUtils.listBadgeIcons] Exception:', e);
    return [];
  }
}
