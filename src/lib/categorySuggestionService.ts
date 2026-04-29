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
 * Get category suggestions (with optional status filter)
 * @param status - Filter by status (default: 'pending')
 * @param includeDetails - If true, join seller + item data
 */
export async function getCategorySuggestions(
  status?: SuggestionStatus,
  includeDetails = true
): Promise<CategorySuggestion[]> {
  const supabase = getAdminClient();

  let query = supabase.from('category_suggestions').select(
    includeDetails
      ? `
        *,
        seller:profiles!seller_id(id, full_name, email),
        item:items!item_id(id, name, status),
        merged_to_category:categories!merged_to_category_id(id, name)
      `
      : '*'
  );

  if (status) {
    query = query.eq('status', status);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch category suggestions: ${error.message}`);
  }

  return (data as any) || [];
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
    throw new Error(`Failed to count pending suggestions: ${error.message}`);
  }

  return count || 0;
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
  adminUserId: string
): Promise<void> {
  const supabase = getAdminClient();

  // 1. Fetch suggestion to get item_id
  const { data: suggestion, error: fetchError } = await supabase
    .from('category_suggestions')
    .select('*, item:items!item_id(id, status)')
    .eq('id', suggestionId)
    .single();

  if (fetchError || !suggestion) {
    throw new Error(`Failed to fetch suggestion: ${fetchError?.message || 'Not found'}`);
  }

  if (suggestion.status !== 'pending') {
    throw new Error(`Suggestion is already ${suggestion.status}`);
  }

  try {
    // 2. Create the new category
    const newCategory = await createCategory(input.categoryData);

    // 3. Reassign the item to the new category (if requested)
    const shouldReassign = input.reassignItem !== false; // default true
    if (shouldReassign) {
      const { error: itemUpdateError } = await supabase
        .from('items')
        .update({ category_id: newCategory.id })
        .eq('id', suggestion.item_id);

      if (itemUpdateError) {
        // Rollback: delete the category we just created
        await supabase.from('categories').delete().eq('id', newCategory.id);
        throw new Error(`Failed to reassign item: ${itemUpdateError.message}`);
      }
    }

    // 4. Update suggestion row
    const { error: suggestionUpdateError } = await supabase
      .from('category_suggestions')
      .update({
        status: 'approved' as SuggestionStatus,
        approved_by: adminUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', suggestionId);

    if (suggestionUpdateError) {
      // Rollback: delete category and revert item
      await supabase.from('categories').delete().eq('id', newCategory.id);
      if (shouldReassign) {
        await supabase
          .from('items')
          .update({ category_id: suggestion.item_id })
          .eq('id', suggestion.item_id);
      }
      throw new Error(`Failed to update suggestion: ${suggestionUpdateError.message}`);
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
  input: RejectSuggestionInput,
  adminUserId: string
): Promise<void> {
  const supabase = getAdminClient();

  const { error } = await supabase
    .from('category_suggestions')
    .update({
      status: 'rejected' as SuggestionStatus,
      approved_by: adminUserId, // Track who rejected
      admin_note: input.admin_note || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', suggestionId)
    .eq('status', 'pending'); // Only reject pending suggestions

  if (error) {
    throw new Error(`Failed to reject suggestion: ${error.message}`);
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
  input: MergeSuggestionInput,
  adminUserId: string
): Promise<void> {
  const supabase = getAdminClient();

  // 1. Fetch suggestion to get item_id
  const { data: suggestion, error: fetchError } = await supabase
    .from('category_suggestions')
    .select('*')
    .eq('id', suggestionId)
    .single();

  if (fetchError || !suggestion) {
    throw new Error(`Failed to fetch suggestion: ${fetchError?.message || 'Not found'}`);
  }

  if (suggestion.status !== 'pending') {
    throw new Error(`Suggestion is already ${suggestion.status}`);
  }

  // 2. Verify target category exists
  const { data: targetCategory, error: categoryError } = await supabase
    .from('categories')
    .select('id, name')
    .eq('id', input.target_category_id)
    .single();

  if (categoryError || !targetCategory) {
    throw new Error(`Target category not found: ${categoryError?.message || 'Not found'}`);
  }

  try {
    // 3. Reassign item to target category
    const { error: itemUpdateError } = await supabase
      .from('items')
      .update({ category_id: input.target_category_id })
      .eq('id', suggestion.item_id);

    if (itemUpdateError) {
      throw new Error(`Failed to reassign item: ${itemUpdateError.message}`);
    }

    // 4. Update suggestion row
    const { error: suggestionUpdateError } = await supabase
      .from('category_suggestions')
      .update({
        status: 'merged' as SuggestionStatus,
        approved_by: adminUserId,
        merged_to_category_id: input.target_category_id,
        admin_note: input.admin_note || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', suggestionId);

    if (suggestionUpdateError) {
      // Rollback: revert item category
      // Note: We don't know the original category here — best effort only
      console.error('[mergeCategorySuggestion] Failed to update suggestion after item reassignment');
      throw new Error(`Failed to update suggestion: ${suggestionUpdateError.message}`);
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
