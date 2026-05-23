// FILE: p2p-kids-admin/src/lib/faqService.ts
// Admin service for FAQ categories and items

import { createClient } from '@supabase/supabase-js';
import type {
  FaqCategory,
  FaqItem,
  CreateFaqCategoryPayload,
  UpdateFaqCategoryPayload,
  CreateFaqItemPayload,
  UpdateFaqItemPayload,
} from '../types/faq';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Categories ───────────────────────────────────────────────

export async function getAllCategories(): Promise<FaqCategory[]> {
  const { data, error } = await supabase
    .from('faq_categories')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as FaqCategory[];
}

export async function createCategory(payload: CreateFaqCategoryPayload): Promise<FaqCategory> {
  if (!payload.name.trim()) throw new Error('Category name is required');
  const { data, error } = await supabase
    .from('faq_categories')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as FaqCategory;
}

export async function updateCategory(
  id: string,
  payload: UpdateFaqCategoryPayload,
): Promise<FaqCategory> {
  const { data, error } = await supabase
    .from('faq_categories')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as FaqCategory;
}

export async function deleteCategory(id: string): Promise<void> {
  // Guard: category must have no items
  const { count } = await supabase
    .from('faq_items')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id);
  if ((count ?? 0) > 0) {
    throw new Error('Cannot delete a category that has FAQ items. Move or delete items first.');
  }
  const { error } = await supabase.from('faq_categories').delete().eq('id', id);
  if (error) throw error;
}

// Reorder: assign sort_order values based on the provided ordered array of IDs
export async function reorderCategories(orderedIds: string[]): Promise<void> {
  const updates = orderedIds.map((id, index) =>
    supabase
      .from('faq_categories')
      .update({ sort_order: index + 1 })
      .eq('id', id),
  );
  const results = await Promise.all(updates);
  for (const { error } of results) {
    if (error) throw error;
  }
}

// ─── FAQ Items ────────────────────────────────────────────────

export async function getAllFaqItems(): Promise<FaqItem[]> {
  const { data, error } = await supabase
    .from('faq_items')
    .select('*, faq_categories(id, name, sort_order, created_at)')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as FaqItem[];
}

export async function createFaqItem(payload: CreateFaqItemPayload): Promise<FaqItem> {
  const { data, error } = await supabase
    .from('faq_items')
    .insert(payload)
    .select('*, faq_categories(id, name, sort_order, created_at)')
    .single();
  if (error) throw error;
  return data as FaqItem;
}

export async function updateFaqItem(
  id: string,
  payload: UpdateFaqItemPayload,
): Promise<FaqItem> {
  const { data, error } = await supabase
    .from('faq_items')
    .update(payload)
    .eq('id', id)
    .select('*, faq_categories(id, name, sort_order, created_at)')
    .single();
  if (error) throw error;
  return data as FaqItem;
}

export async function deleteFaqItem(id: string): Promise<void> {
  const { error } = await supabase.from('faq_items').delete().eq('id', id);
  if (error) throw error;
}

export async function toggleFaqStatus(id: string, currentStatus: string): Promise<FaqItem> {
  const newStatus = currentStatus === 'published' ? 'draft' : 'published';
  return updateFaqItem(id, { status: newStatus as 'draft' | 'published' });
}

/**
 * Move a FAQ item up or down by swapping sort_order with its neighbour.
 * direction: 'up' = lower sort_order, 'down' = higher sort_order
 */
export async function resetFaqVotes(id: string): Promise<void> {
  const { error } = await supabase.rpc('rpc_reset_faq_votes', { p_faq_item_id: id });
  if (error) throw error;
}

export async function moveFaqItem(
  items: FaqItem[],
  id: string,
  direction: 'up' | 'down',
): Promise<void> {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const idx = sorted.findIndex((i) => i.id === id);
  if (idx === -1) return;

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sorted.length) return;

  const itemA = sorted[idx];
  const itemB = sorted[swapIdx];

  await Promise.all([
    supabase.from('faq_items').update({ sort_order: itemB.sort_order }).eq('id', itemA.id),
    supabase.from('faq_items').update({ sort_order: itemA.sort_order }).eq('id', itemB.id),
  ]);
}
