// FILE: p2p-kids-admin/src/lib/categoryService.ts
// ADMIN-V3-003: Category CRUD service
// Module: MODULE-12-ADMIN-V3-CATEGORIES

import { createClient } from '@supabase/supabase-js';
import type {
  Category,
  CreateCategoryInput,
  UpdateCategoryInput,
  ValidationResult,
  CategoryReorderItem,
  IconType,
  CategorySPPreview,
} from '../types/category';
import {
  DuplicateNameError,
  CategoryNotEmptyError,
  SPRateOutOfRangeError,
  IconUploadError,
} from '../types/errors';

// Name validation regex: 3-50 chars, alphanumeric + spaces only
const NAME_REGEX = /^[A-Za-z0-9 ]{3,50}$/;

// SP rate bounds (legal-safety guardrails — DO NOT widen without legal review)
const SP_EARNING_MIN = 1.05;
const SP_EARNING_MAX = 1.40;
const SP_SPENDING_CAP_MIN = 50;
const SP_SPENDING_CAP_MAX = 80;

// Icon upload constraints
const MAX_ICON_SIZE_KB = 500;
const MIN_ICON_DIMENSIONS = 100; // pixels
const ALLOWED_ICON_TYPES = ['image/png', 'image/svg+xml'];

// Create Supabase client with service role (admin context)
// NOTE: Service role key must be provided via env var SUPABASE_SERVICE_ROLE_KEY
function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const isServer = typeof window === 'undefined';

  if (isServer && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, anonKey);
}

/**
 * Validate category name format (regex + length)
 * Does NOT check uniqueness (use checkCategoryUniqueness separately)
 */
export function validateCategoryName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Category name is required.' };
  }

  if (!NAME_REGEX.test(name)) {
    return {
      valid: false,
      error: 'Name must be 3–50 characters, letters, numbers, and spaces only.',
    };
  }

  return { valid: true };
}

/**
 * Check if category name already exists (case-insensitive)
 * @param name - Category name to check
 * @param excludeId - Optional category ID to exclude (for updates)
 * @returns { exists: boolean, existingId?: string }
 */
export async function checkCategoryUniqueness(
  name: string,
  excludeId?: string
): Promise<{ exists: boolean; existingId?: string }> {
  const supabase = getAdminClient();

  let query = supabase
    .from('categories')
    .select('id, name')
    .ilike('name', name); // Case-insensitive match

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('[categoryService] uniqueness check failed:', error);
    // Graceful degradation: assume unique on DB error
    return { exists: false };
  }

  return {
    exists: !!data,
    existingId: data?.id,
  };
}

/**
 * Get all categories (optionally filtered by active status)
 * @param includeInactive - If false, only return is_active=true (default true for admin)
 * @param orderBy - Sort field (default 'display_order')
 */
export async function getCategories(
  includeInactive = true,
  orderBy: 'display_order' | 'name' | 'item_count' = 'display_order'
): Promise<Category[]> {
  const useApiRoute = typeof window !== 'undefined' && process.env.NODE_ENV !== 'test';

  if (useApiRoute) {
    const headers: Record<string, string> = {};
    const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET;
    if (adminSecret) {
      headers['x-admin-secret'] = adminSecret;
    }

    const query = new URLSearchParams({
      includeInactive: String(includeInactive),
      orderBy,
    });

    const response = await fetch(`/api/admin/categories?${query.toString()}`, {
      method: 'GET',
      headers,
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Failed to fetch categories');
    }

    return (payload.data || []) as Category[];
  }

  const supabase = getAdminClient();

  let query = supabase.from('categories').select('*');

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  // Apply ordering
  if (orderBy === 'display_order') {
    query = query.order('display_order', { ascending: true }).order('name', { ascending: true });
  } else if (orderBy === 'name') {
    query = query.order('name', { ascending: true });
  } else if (orderBy === 'item_count') {
    query = query.order('item_count', { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch categories: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a single category by ID
 */
export async function getCategoryById(id: string): Promise<Category | null> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch category: ${error.message}`);
  }

  return data;
}

/**
 * Create a new category
 * @throws DuplicateNameError if name already exists (case-insensitive)
 * @throws SPRateOutOfRangeError if rates outside bounds
 */
export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  const useApiRoute = typeof window !== 'undefined' && process.env.NODE_ENV !== 'test';

  if (useApiRoute) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET;
    if (adminSecret) {
      headers['x-admin-secret'] = adminSecret;
    }

    const response = await fetch('/api/admin/categories', {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Failed to create category');
    }

    return payload.data as Category;
  }

  const supabase = getAdminClient();

  // Validate name format
  const validation = validateCategoryName(input.name);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Check uniqueness
  const { exists, existingId } = await checkCategoryUniqueness(input.name);
  if (exists) {
    throw new DuplicateNameError(input.name, existingId!);
  }

  // Validate SP rates if provided
  const earningMultiplier = input.sp_earning_multiplier ?? 1.10;
  const spendingCap = input.sp_spending_cap_percent ?? 70;

  if (earningMultiplier < SP_EARNING_MIN || earningMultiplier > SP_EARNING_MAX) {
    throw new SPRateOutOfRangeError(
      'sp_earning_multiplier',
      earningMultiplier,
      SP_EARNING_MIN,
      SP_EARNING_MAX
    );
  }

  if (spendingCap < SP_SPENDING_CAP_MIN || spendingCap > SP_SPENDING_CAP_MAX) {
    throw new SPRateOutOfRangeError(
      'sp_spending_cap_percent',
      spendingCap,
      SP_SPENDING_CAP_MIN,
      SP_SPENDING_CAP_MAX
    );
  }

  // Get max display_order and add 1
  const { data: maxOrder } = await supabase
    .from('categories')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const displayOrder = (maxOrder?.display_order ?? 0) + 1;

  // Insert category
  const { data, error } = await supabase
    .from('categories')
    .insert({
      name: input.name,
      description: input.description ?? null,
      icon: input.icon ?? null,
      icon_url: input.icon_url ?? null,
      bonus_badge_icon_url: input.bonus_badge_icon_url ?? null,
      is_active: input.is_active ?? true,
      sp_earning_multiplier: earningMultiplier,
      sp_spending_cap_percent: spendingCap,
      sp_config_notes: input.sp_config_notes ?? null,
      display_order: displayOrder,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create category: ${error.message}`);
  }

  return data;
}

/**
 * Update an existing category
 * @throws DuplicateNameError if name change conflicts
 * @throws SPRateOutOfRangeError if rates outside bounds
 */
export async function updateCategory(
  id: string,
  input: UpdateCategoryInput
): Promise<Category> {
  const useApiRoute = typeof window !== 'undefined' && process.env.NODE_ENV !== 'test';

  if (useApiRoute) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET;
    if (adminSecret) {
      headers['x-admin-secret'] = adminSecret;
    }

    const response = await fetch(`/api/admin/categories/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(input),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Failed to update category');
    }

    return payload.data as Category;
  }

  const supabase = getAdminClient();

  // If name is being changed, validate and check uniqueness
  if (input.name !== undefined) {
    const validation = validateCategoryName(input.name);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const { exists, existingId } = await checkCategoryUniqueness(input.name, id);
    if (exists) {
      throw new DuplicateNameError(input.name, existingId!);
    }
  }

  // Validate SP rates if provided
  if (input.sp_earning_multiplier !== undefined) {
    if (
      input.sp_earning_multiplier < SP_EARNING_MIN ||
      input.sp_earning_multiplier > SP_EARNING_MAX
    ) {
      throw new SPRateOutOfRangeError(
        'sp_earning_multiplier',
        input.sp_earning_multiplier,
        SP_EARNING_MIN,
        SP_EARNING_MAX
      );
    }
  }

  if (input.sp_spending_cap_percent !== undefined) {
    if (
      input.sp_spending_cap_percent < SP_SPENDING_CAP_MIN ||
      input.sp_spending_cap_percent > SP_SPENDING_CAP_MAX
    ) {
      throw new SPRateOutOfRangeError(
        'sp_spending_cap_percent',
        input.sp_spending_cap_percent,
        SP_SPENDING_CAP_MIN,
        SP_SPENDING_CAP_MAX
      );
    }
  }

  // Build update payload (exclude item_count, display_order — trigger/RPC only)
  const updatePayload: any = {};
  if (input.name !== undefined) updatePayload.name = input.name;
  if (input.description !== undefined) updatePayload.description = input.description;
  if (input.icon !== undefined) updatePayload.icon = input.icon;
  if (input.icon_url !== undefined) updatePayload.icon_url = input.icon_url;
  if (input.bonus_badge_icon_url !== undefined)
    updatePayload.bonus_badge_icon_url = input.bonus_badge_icon_url;
  if (input.is_active !== undefined) updatePayload.is_active = input.is_active;
  if (input.sp_earning_multiplier !== undefined)
    updatePayload.sp_earning_multiplier = input.sp_earning_multiplier;
  if (input.sp_spending_cap_percent !== undefined)
    updatePayload.sp_spending_cap_percent = input.sp_spending_cap_percent;
  if (input.sp_config_notes !== undefined)
    updatePayload.sp_config_notes = input.sp_config_notes;
  if (input.sp_rate_change_notify !== undefined)
    updatePayload.sp_rate_change_notify = input.sp_rate_change_notify;

  const { data, error } = await supabase
    .from('categories')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update category: ${error.message}`);
  }

  return data;
}

/**
 * Delete a category (only if item_count = 0)
 * @throws CategoryNotEmptyError if category has items
 */
export async function deleteCategory(id: string): Promise<void> {
  const useApiRoute = typeof window !== 'undefined' && process.env.NODE_ENV !== 'test';

  if (useApiRoute) {
    const headers: Record<string, string> = {};

    const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET;
    if (adminSecret) {
      headers['x-admin-secret'] = adminSecret;
    }

    const response = await fetch(`/api/admin/categories/${id}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.error || 'Failed to delete category');
    }

    return;
  }

  const supabase = getAdminClient();

  // Fetch category to check item_count
  const category = await getCategoryById(id);
  if (!category) {
    throw new Error('Category not found');
  }

  if (category.item_count > 0) {
    throw new CategoryNotEmptyError(id, category.item_count);
  }

  // Check if this is the "Other" category (name check case-insensitive)
  if (category.name.toLowerCase() === 'other') {
    throw new Error('Cannot delete the "Other" category — it is required by the system.');
  }

  const { error } = await supabase.from('categories').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete category: ${error.message}`);
  }
}

/**
 * Toggle category active status
 * Refuses to deactivate the "Other" category
 */
export async function toggleCategoryActive(id: string, isActive: boolean): Promise<Category> {
  const useApiRoute = typeof window !== 'undefined' && process.env.NODE_ENV !== 'test';

  if (useApiRoute) {
    return updateCategory(id, { is_active: isActive });
  }

  const supabase = getAdminClient();

  // Fetch category to check if it's "Other"
  const category = await getCategoryById(id);
  if (!category) {
    throw new Error('Category not found');
  }

  if (!isActive && category.name.toLowerCase() === 'other') {
    throw new Error('Cannot deactivate the "Other" category — it is required by the system.');
  }

  return updateCategory(id, { is_active: isActive });
}

/**
 * Reorder categories via RPC (optimistic UI handles rollback on error)
 * Calls the reorder_categories(JSONB) SECURITY DEFINER RPC
 */
export async function reorderCategories(reorderItems: CategoryReorderItem[]): Promise<void> {
  const useApiRoute = typeof window !== 'undefined' && process.env.NODE_ENV !== 'test';

  if (useApiRoute) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET;
    if (adminSecret) {
      headers['x-admin-secret'] = adminSecret;
    }

    const response = await fetch('/api/admin/categories/reorder', {
      method: 'POST',
      headers,
      body: JSON.stringify({ category_orders: reorderItems }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Failed to reorder categories');
    }

    return;
  }

  const supabase = getAdminClient();

  const { error } = await supabase.rpc('reorder_categories', {
    p_category_orders: reorderItems,
  });

  if (error) {
    // Check if it's an admin role error
    if (error.message?.includes('Admin role required')) {
      throw new Error('Admin role required to reorder categories');
    }
    throw new Error(`Failed to reorder categories: ${error.message}`);
  }
}

/**
 * Upload category icon or bonus badge to Supabase Storage
 * @param categoryId - Category ID
 * @param file - File object (PNG or SVG)
 * @param iconType - 'category' or 'bonus_badge'
 * @returns Public URL of the uploaded icon
 * @throws IconUploadError on validation failure
 */
export async function uploadCategoryIcon(
  categoryId: string,
  file: File,
  iconType: IconType
): Promise<string> {
  const useApiRoute = typeof window !== 'undefined' && process.env.NODE_ENV !== 'test';

  // Validate file type
  if (!ALLOWED_ICON_TYPES.includes(file.type)) {
    throw new IconUploadError('bad_type');
  }

  // Validate file size
  const sizeKB = file.size / 1024;
  if (sizeKB > MAX_ICON_SIZE_KB) {
    throw new IconUploadError('too_large', `File size: ${sizeKB.toFixed(1)} KB`);
  }

  // For images, validate dimensions (PNG only — SVG is vector)
  if (file.type === 'image/png' && typeof window !== 'undefined') {
    try {
      const dimensions = await getImageDimensions(file);
      if (dimensions.width < MIN_ICON_DIMENSIONS || dimensions.height < MIN_ICON_DIMENSIONS) {
        throw new IconUploadError(
          'too_small',
          `Min ${MIN_ICON_DIMENSIONS}×${MIN_ICON_DIMENSIONS}px required, got ${dimensions.width}×${dimensions.height}px`
        );
      }
    } catch (err: any) {
      if (err instanceof IconUploadError) throw err;
      // If dimension check fails, continue (SVG or browser limitation)
      console.warn('[uploadCategoryIcon] Could not validate dimensions:', err.message);
    }
  }

  if (useApiRoute) {
    const headers: Record<string, string> = {};
    const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET;
    if (adminSecret) {
      headers['x-admin-secret'] = adminSecret;
    }

    const formData = new FormData();
    formData.append('categoryId', categoryId);
    formData.append('iconType', iconType);
    formData.append('file', file);

    const response = await fetch('/api/admin/categories/upload-icon', {
      method: 'POST',
      headers,
      body: formData,
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new IconUploadError('upload_failed', payload.error || 'Failed to upload icon');
    }

    return payload.url as string;
  }

  const supabase = getAdminClient();

  // Build storage path
  const ext = file.type === 'image/svg+xml' ? 'svg' : 'png';
  const filePath = `category-icons/${categoryId}/${iconType}.${ext}`;

  // Delete existing file at same path (overwrite)
  const { error: deleteError } = await supabase.storage
    .from('category-icons')
    .remove([filePath]);

  if (deleteError) {
    console.warn('[uploadCategoryIcon] Could not delete existing file:', deleteError.message);
    // Continue anyway — upload will overwrite
  }

  // Upload file
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('category-icons')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    throw new IconUploadError('upload_failed', uploadError.message);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('category-icons')
    .getPublicUrl(uploadData.path);

  if (!urlData?.publicUrl) {
    throw new IconUploadError('upload_failed', 'Could not generate public URL');
  }

  // Update category record with new URL
  const columnName = iconType === 'category' ? 'icon_url' : 'bonus_badge_icon_url';
  await updateCategory(categoryId, { [columnName]: urlData.publicUrl });

  return urlData.publicUrl;
}

/**
 * Calculate SP preview for a given category and price
 * Used for live preview in CategoryForm
 */
export function calculateCategorySPPreview(
  earningMultiplier: number,
  spendingCapPercent: number,
  price: number
): CategorySPPreview {
  return {
    price,
    earn_sp: Math.round(price * earningMultiplier),
    max_spend_sp: Math.floor((price * spendingCapPercent) / 100),
    spend_percent: spendingCapPercent,
  };
}

/**
 * Get categories with bonus earning multiplier (> 1.10) and active
 */
export async function getBonusCategories(): Promise<Category[]> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .gt('sp_earning_multiplier', 1.10)
    .order('sp_earning_multiplier', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch bonus categories: ${error.message}`);
  }

  return data || [];
}

// Helper: Get image dimensions from File object
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for dimension check'));
    };

    img.src = url;
  });
}
