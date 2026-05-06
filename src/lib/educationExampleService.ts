// FILE: p2p-kids-admin/src/lib/educationExampleService.ts
// MODULE-18 V1 EDU-003: Education example service (admin CMS)

import { createClient } from '@supabase/supabase-js';
import type { EducationExample } from '../types/education';
import { ContentValidationError } from '../types/education-errors';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Get all education examples (drafts + published)
 * Admin-only
 *
 * @returns Array of all examples
 */
export async function getAllExamples(): Promise<EducationExample[]> {
  try {
    const { data, error } = await supabase
      .from('education_examples')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;

    return (data || []) as EducationExample[];
  } catch (error: any) {
    console.error('[educationExampleService] Get all examples error:', error);
    throw error;
  }
}

/**
 * Create a new example
 * Starts as unpublished (is_published = false)
 *
 * @param example - Example data
 * @returns Created example
 */
export async function createExample(example: {
  item_name: string;
  item_price: number;
  category_id?: string | null;
  display_order: number;
}): Promise<EducationExample> {
  try {
    // Validate price
    if (example.item_price <= 0 || example.item_price > 10000) {
      throw new ContentValidationError('Price must be > 0 and ≤ 10000', 'INVALID_PRICE');
    }

    const { data, error } = await supabase
      .from('education_examples')
      .insert({
        ...example,
        category_id: example.category_id || null,
        is_published: false,
      })
      .select()
      .single();

    if (error) throw error;

    return data as EducationExample;
  } catch (error: any) {
    console.error('[educationExampleService] Create example error:', error);
    throw error;
  }
}

/**
 * Update an existing example
 *
 * @param id - Example ID
 * @param updates - Example updates
 * @returns Updated example
 */
export async function updateExample(
  id: string,
  updates: {
    item_name?: string;
    item_price?: number;
    category_id?: string | null;
    display_order?: number;
    is_published?: boolean;
  }
): Promise<EducationExample> {
  try {
    // Validate price if provided
    if (updates.item_price !== undefined) {
      if (updates.item_price <= 0 || updates.item_price > 10000) {
        throw new ContentValidationError('Price must be > 0 and ≤ 10000', 'INVALID_PRICE');
      }
    }

    const { data, error } = await supabase
      .from('education_examples')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return data as EducationExample;
  } catch (error: any) {
    console.error('[educationExampleService] Update example error:', error);
    throw error;
  }
}

/**
 * Delete an example
 * Refuses if example is published (must unpublish first)
 *
 * @param id - Example ID
 * @returns Success status
 */
export async function deleteExample(id: string): Promise<void> {
  try {
    // Check if example is published
    const { data: example, error: fetchError } = await supabase
      .from('education_examples')
      .select('is_published')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    if (example?.is_published) {
      throw new ContentValidationError(
        'Cannot delete published example. Unpublish it first.',
        'EXAMPLE_IS_PUBLISHED'
      );
    }

    const { error } = await supabase.from('education_examples').delete().eq('id', id);

    if (error) throw error;
  } catch (error: any) {
    console.error('[educationExampleService] Delete example error:', error);
    throw error;
  }
}

/**
 * Publish an example
 * Sets is_published = true
 *
 * @param id - Example ID
 * @returns Success status
 */
export async function publishExample(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('education_examples')
      .update({ is_published: true })
      .eq('id', id);

    if (error) throw error;
  } catch (error: any) {
    console.error('[educationExampleService] Publish example error:', error);
    throw error;
  }
}

/**
 * Unpublish an example
 * Sets is_published = false
 *
 * @param id - Example ID
 * @returns Success status
 */
export async function unpublishExample(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('education_examples')
      .update({ is_published: false })
      .eq('id', id);

    if (error) throw error;
  } catch (error: any) {
    console.error('[educationExampleService] Unpublish example error:', error);
    throw error;
  }
}
