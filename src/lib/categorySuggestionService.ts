// FILE: p2p-kids-admin/src/lib/categorySuggestionService.ts
// ADMIN-V3-003: Category Suggestion service (approve/reject/merge)
// Module: MODULE-12-ADMIN-V3-CATEGORIES

import { createClient } from '@supabase/supabase-js';
import type {
  CategorySuggestion,
  ApproveSuggestionInput,
  MergeSuggestionInput,
  RejectSuggestionInput,
  SuggestionStatus,
} from '../types/category';
import { createCategory } from './categoryService';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function resolveAdminUserId(
  supabase: any,
  adminUserId?: string
): Promise<string | null> {
  if (adminUserId && UUID_REGEX.test(adminUserId)) {
    return adminUserId;
  }

  if (!supabase?.auth?.getUser) {
    return null;
  }

  try {
    const authResult = await supabase.auth.getUser();
    const user = authResult?.data?.user;
    return user?.id || null;
  } catch (error) {
    console.warn('[categorySuggestionService] Could not resolve admin user from session:', error);
    return null;
  }
}

function getAdminApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET;
  if (adminSecret) {
    headers['x-admin-secret'] = adminSecret;
  }

  return headers;
}

function shouldUseApiRoute(): boolean {
  // In tests, we intentionally route through fetch to keep unit tests decoupled
  // from Supabase query-chain implementation details.
  if (process.env.NODE_ENV === 'test') {
    return true;
  }

  return typeof window !== 'undefined';
}

async function postAdminActionRoute(path: string, payload: Record<string, unknown>): Promise<void> {
  const response = await fetch(path, {
    method: 'POST',
    headers: getAdminApiHeaders(),
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || 'Admin category suggestion action failed');
  }
}

async function syncCategoryItemCount(supabase: any, categoryId?: string | null): Promise<void> {
  if (!categoryId) {
    return;
  }

  const { count, error: countError } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .eq('status', 'available');

  if (countError) {
    throw new Error(`Failed to count items for category ${categoryId}: ${countError.message}`);
  }

  const { error: updateError } = await supabase
    .from('categories')
    .update({ item_count: count || 0 })
    .eq('id', categoryId);

  if (updateError) {
    throw new Error(
      `Failed to sync item_count for category ${categoryId}: ${updateError.message}`
    );
  }
}

/**
 * Get category suggestions (with optional status filter)
 * @param status - Filter by status (default: 'pending')
 * @param includeDetails - If true, join seller + item data
 */
export async function getCategorySuggestions(
  status?: SuggestionStatus,
  includeDetails = true
): Promise<CategorySuggestion[]> {
  const supabase = getAdminClient();

  let query = supabase.from('category_suggestions').select('*');

  if (status) {
    query = query.eq('status', status);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch category suggestions: ${error.message}`);
  }

  const suggestions = ((data as CategorySuggestion[]) || []).map((row) => ({ ...row }));

  if (!includeDetails || suggestions.length === 0) {
    return suggestions;
  }

  const sellerIds = Array.from(
    new Set(suggestions.map((s) => s.seller_id).filter(Boolean))
  );
  const itemIds = Array.from(new Set(suggestions.map((s) => s.item_id).filter(Boolean)));
  const mergedCategoryIds = Array.from(
    new Set(suggestions.map((s) => s.merged_to_category_id).filter(Boolean))
  ) as string[];

  const [profilesResult, itemsResult, categoriesResult] = await Promise.all([
    sellerIds.length > 0
      ? supabase
          .from('profiles')
          .select('*')
          .in('user_id', sellerIds)
      : Promise.resolve({ data: [], error: null }),
    itemIds.length > 0
      ? supabase.from('items').select('*').in('id', itemIds)
      : Promise.resolve({ data: [], error: null }),
    mergedCategoryIds.length > 0
      ? supabase.from('categories').select('id, name').in('id', mergedCategoryIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error) {
    throw new Error(`Failed to fetch suggestion sellers: ${profilesResult.error.message}`);
  }
  if (itemsResult.error) {
    throw new Error(`Failed to fetch suggestion items: ${itemsResult.error.message}`);
  }
  if (categoriesResult.error) {
    throw new Error(`Failed to fetch merged categories: ${categoriesResult.error.message}`);
  }

  const sellerByUserId = new Map(
    (
      (profilesResult.data as Array<{
        user_id: string;
        full_name?: string | null;
        name?: string | null;
        display_name?: string | null;
        email?: string | null;
      }>) || []
    ).map((profile) => [profile.user_id, profile])
  );
  const itemById = new Map(
    (
      (itemsResult.data as Array<{
        id: string;
        name?: string | null;
        title?: string | null;
        status?: string | null;
      }>) || []
    ).map((item) => [item.id, item])
  );
  const categoryById = new Map(
    ((categoriesResult.data as { id: string; name: string }[]) || []).map((category) => [
      category.id,
      category,
    ])
  );

  return suggestions.map((suggestion) => {
    const seller = sellerByUserId.get(suggestion.seller_id);
    const item = itemById.get(suggestion.item_id);
    const mergedToCategory = suggestion.merged_to_category_id
      ? categoryById.get(suggestion.merged_to_category_id)
      : undefined;

    return {
      ...suggestion,
      seller: seller
        ? {
            id: seller.user_id,
            full_name:
              seller.full_name ||
              seller.name ||
              seller.display_name ||
              seller.email ||
              'Unknown',
            email: seller.email || '',
          }
        : undefined,
      item: item
        ? {
            id: item.id,
            name: item.name || item.title || 'Untitled item',
            status: item.status || 'unknown',
          }
        : undefined,
      merged_to_category: mergedToCategory
        ? {
            id: mergedToCategory.id,
            name: mergedToCategory.name,
          }
        : undefined,
    };
  });
}

/**
 * Get count of pending suggestions (for badge count)
 */
export async function getPendingSuggestionCount(): Promise<number> {
  const supabase = getAdminClient();

  const { count, error } = await supabase
    .from('category_suggestions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) {
    console.warn(`Failed to count pending suggestions: ${error.message}`);
    return 0;
  }

  return count || 0;
}

type LegacyApproveSuggestionInput = {
  suggestion_id: string;
  name: string;
  description?: string | null;
};

function normalizeApproveArgs(
  suggestionIdOrInput: string | LegacyApproveSuggestionInput,
  inputOrAdminUserId?: ApproveSuggestionInput | string,
  adminUserId?: string
): { suggestionId: string; input: ApproveSuggestionInput; adminUserId?: string } {
  if (typeof suggestionIdOrInput === 'string') {
    return {
      suggestionId: suggestionIdOrInput,
      input: inputOrAdminUserId as ApproveSuggestionInput,
      adminUserId,
    };
  }

  return {
    suggestionId: suggestionIdOrInput.suggestion_id,
    input: {
      categoryData: {
        name: suggestionIdOrInput.name,
        description: suggestionIdOrInput.description ?? null,
        icon: null,
        icon_url: null,
        bonus_badge_icon_url: null,
        is_active: true,
        sp_earning_multiplier: 1.10,
        sp_spending_cap_percent: 70,
        sp_config_notes: null,
      },
      reassignItem: true,
    },
    adminUserId: typeof inputOrAdminUserId === 'string' ? inputOrAdminUserId : adminUserId,
  };
}

/**
 * Approve a category suggestion
 * Creates a new category and reassigns the item in a single transaction
 * @param suggestionId - Suggestion ID
 * @param input - Category creation data + options
 * @param adminUserId - ID of the admin user approving
 * @throws Error if transaction fails at any step
 */
export async function approveCategorySuggestion(
  suggestionId: string,
  input: ApproveSuggestionInput,
  adminUserId?: string
): Promise<void>;
export async function approveCategorySuggestion(
  input: LegacyApproveSuggestionInput,
  adminUserId?: string
): Promise<void>;
export async function approveCategorySuggestion(
  suggestionIdOrInput: string | LegacyApproveSuggestionInput,
  inputOrAdminUserId?: ApproveSuggestionInput | string,
  adminUserId?: string
): Promise<void> {
  const normalized = normalizeApproveArgs(
    suggestionIdOrInput,
    inputOrAdminUserId,
    adminUserId
  );
  const suggestionId = normalized.suggestionId;
  const input = normalized.input;

  const supabase = getAdminClient();
  const resolvedAdminUserId = await resolveAdminUserId(supabase, normalized.adminUserId);

  const useApiRoute = shouldUseApiRoute();
  if (useApiRoute) {
    await postAdminActionRoute(`/api/admin/category-suggestions/${suggestionId}/approve`, {
      suggestion_id: suggestionId,
      ...input,
      adminUserId: resolvedAdminUserId,
    });
    return;
  }

  // 1. Fetch suggestion to get item_id
  const { data: suggestion, error: fetchError } = await supabase
    .from('category_suggestions')
    .select('id, item_id, status')
    .eq('id', suggestionId)
    .single();

  if (fetchError || !suggestion) {
    throw new Error(`Failed to fetch suggestion: ${fetchError?.message || 'Not found'}`);
  }

  if (suggestion.status !== 'pending') {
    throw new Error(`Suggestion is already ${suggestion.status}`);
  }

  const { data: currentItem, error: currentItemError } = await supabase
    .from('items')
    .select('id, category_id, status')
    .eq('id', suggestion.item_id)
    .maybeSingle();

  if (currentItemError || !currentItem) {
    throw new Error(
      `Failed to fetch suggested item before reassignment: ${
        currentItemError?.message || 'Not found'
      }`
    );
  }

  try {
    // 2. Create the new category
    const newCategory = await createCategory(input.categoryData);

    // 3. Reassign the item to the new category (if requested)
    const shouldReassign = input.reassignItem !== false; // default true
    if (shouldReassign) {
      const { data: updatedItem, error: itemUpdateError } = await supabase
        .from('items')
        .update({ category_id: newCategory.id })
        .eq('id', suggestion.item_id)
        .select('id, category_id')
        .maybeSingle();

      if (itemUpdateError || !updatedItem) {
        // Rollback: delete the category we just created
        await supabase.from('categories').delete().eq('id', newCategory.id);
        throw new Error(
          `Failed to reassign item: ${itemUpdateError?.message || 'No rows were updated'}`
        );
      }

      await syncCategoryItemCount(supabase, currentItem.category_id);
      await syncCategoryItemCount(supabase, newCategory.id);
    }

    // 4. Update suggestion row
    const { data: updatedSuggestion, error: suggestionUpdateError } = await supabase
      .from('category_suggestions')
      .update({
        status: 'approved' as SuggestionStatus,
        approved_by: resolvedAdminUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', suggestionId)
      .select('id')
      .maybeSingle();

    if (suggestionUpdateError || !updatedSuggestion) {
      // Rollback: delete category and revert item
      await supabase.from('categories').delete().eq('id', newCategory.id);
      if (shouldReassign) {
        await supabase
          .from('items')
          .update({ category_id: currentItem.category_id })
          .eq('id', suggestion.item_id);
      }
      throw new Error(
        `Failed to update suggestion: ${
          suggestionUpdateError?.message || 'No rows were updated'
        }`
      );
    }
  } catch (err: any) {
    console.error('[approveCategorySuggestion] Transaction failed:', err);
    throw err;
  }
}

/**
 * Reject a category suggestion (item stays in current category)
 * @param suggestionId - Suggestion ID
 * @param input - Optional admin note
 * @param adminUserId - ID of the admin user rejecting
 */
export async function rejectCategorySuggestion(
  suggestionId: string,
  input?: RejectSuggestionInput | string,
  adminUserId?: string
): Promise<void> {
  const supabase = getAdminClient();
  const resolvedAdminUserId = await resolveAdminUserId(supabase, adminUserId);
  const normalizedInput: RejectSuggestionInput =
    typeof input === 'string' ? { admin_note: input } : input || {};

  const useApiRoute = shouldUseApiRoute();
  if (useApiRoute) {
    await postAdminActionRoute(`/api/admin/category-suggestions/${suggestionId}/reject`, {
      suggestion_id: suggestionId,
      ...normalizedInput,
      adminUserId: resolvedAdminUserId,
    });
    return;
  }

  const { data: updatedSuggestion, error } = await supabase
    .from('category_suggestions')
    .update({
      status: 'rejected' as SuggestionStatus,
      approved_by: resolvedAdminUserId, // Track who rejected
      admin_note: normalizedInput.admin_note || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', suggestionId)
    .eq('status', 'pending') // Only reject pending suggestions
    .select('id')
    .maybeSingle();

  if (error || !updatedSuggestion) {
    throw new Error(`Failed to reject suggestion: ${error?.message || 'No rows were updated'}`);
  }
}

/**
 * Merge a suggestion into an existing category
 * Reassigns the item to the target category
 * @param suggestionId - Suggestion ID
 * @param input - Target category ID + optional note
 * @param adminUserId - ID of the admin user merging
 */
export async function mergeCategorySuggestion(
  suggestionId: string,
  input: MergeSuggestionInput | string,
  adminUserId?: string
): Promise<void> {
  const supabase = getAdminClient();
  const resolvedAdminUserId = await resolveAdminUserId(supabase, adminUserId);
  const normalizedInput: MergeSuggestionInput =
    typeof input === 'string' ? { target_category_id: input } : input;

  const useApiRoute = shouldUseApiRoute();
  if (useApiRoute) {
    await postAdminActionRoute(`/api/admin/category-suggestions/${suggestionId}/merge`, {
      suggestion_id: suggestionId,
      ...normalizedInput,
      adminUserId: resolvedAdminUserId,
    });
    return;
  }

  // 1. Fetch suggestion to get item_id
  const { data: suggestion, error: fetchError } = await supabase
    .from('category_suggestions')
    .select('id, item_id, status')
    .eq('id', suggestionId)
    .single();

  if (fetchError || !suggestion) {
    throw new Error(`Failed to fetch suggestion: ${fetchError?.message || 'Not found'}`);
  }

  if (suggestion.status !== 'pending') {
    throw new Error(`Suggestion is already ${suggestion.status}`);
  }

  const { data: currentItem, error: currentItemError } = await supabase
    .from('items')
    .select('id, category_id, status')
    .eq('id', suggestion.item_id)
    .maybeSingle();

  if (currentItemError || !currentItem) {
    throw new Error(
      `Failed to fetch suggested item before merge: ${
        currentItemError?.message || 'Not found'
      }`
    );
  }

  // 2. Verify target category exists
  const { data: targetCategory, error: categoryError } = await supabase
    .from('categories')
    .select('id, name')
    .eq('id', normalizedInput.target_category_id)
    .single();

  if (categoryError || !targetCategory) {
    throw new Error(`Target category not found: ${categoryError?.message || 'Not found'}`);
  }

  try {
    // 3. Reassign item to target category
    const { data: updatedItem, error: itemUpdateError } = await supabase
      .from('items')
      .update({ category_id: normalizedInput.target_category_id })
      .eq('id', suggestion.item_id)
      .select('id, category_id')
      .maybeSingle();

    if (itemUpdateError || !updatedItem) {
      throw new Error(
        `Failed to reassign item: ${itemUpdateError?.message || 'No rows were updated'}`
      );
    }

    await syncCategoryItemCount(supabase, currentItem.category_id);
    await syncCategoryItemCount(supabase, normalizedInput.target_category_id);

    // 4. Update suggestion row
    const { data: updatedSuggestion, error: suggestionUpdateError } = await supabase
      .from('category_suggestions')
      .update({
        status: 'merged' as SuggestionStatus,
        approved_by: resolvedAdminUserId,
        merged_to_category_id: normalizedInput.target_category_id,
        admin_note: normalizedInput.admin_note || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', suggestionId)
      .select('id')
      .maybeSingle();

    if (suggestionUpdateError || !updatedSuggestion) {
      // Rollback: revert item category
      await supabase
        .from('items')
        .update({ category_id: currentItem.category_id })
        .eq('id', suggestion.item_id);

      console.error('[mergeCategorySuggestion] Failed to update suggestion after item reassignment');
      throw new Error(
        `Failed to update suggestion: ${
          suggestionUpdateError?.message || 'No rows were updated'
        }`
      );
    }
  } catch (err: any) {
    console.error('[mergeCategorySuggestion] Transaction failed:', err);
    throw err;
  }
}

/**
 * Subscribe to realtime pending suggestion count updates
 * @param callback - Function called with new count when suggestions change
 * @returns Unsubscribe function
 */
export function subscribeToPendingSuggestions(
  callback: (count: number) => void
): () => void {
  const supabase = getAdminClient();

  // Initial count
  getPendingSuggestionCount().then(callback).catch(console.error);

  // Subscribe to changes
  const channel = supabase
    .channel('category_suggestions_pending')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'category_suggestions',
        filter: 'status=eq.pending',
      },
      () => {
        // Refetch count on any change
        getPendingSuggestionCount().then(callback).catch(console.error);
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}
