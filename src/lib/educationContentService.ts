// FILE: p2p-kids-admin/src/lib/educationContentService.ts
// MODULE-18 V1 EDU-003: Education content service (admin CMS)

import { createClient } from '@supabase/supabase-js';
import type { EducationSection, SectionType } from '../types/education';
import { ContentValidationError, UnauthorizedError, DuplicatePublishedSectionError, ContentActionError } from '../types/education-errors';

// Initialize Supabase client (use admin service role key for RPC execution)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Get all education sections (drafts + published)
 * Admin-only: includes unpublished sections
 *
 * @returns Array of all sections
 */
export async function getAllSections(): Promise<EducationSection[]> {
  try {
    const { data, error } = await supabase
      .from('education_sections')
      .select('*')
      .order('section_type', { ascending: true })
      .order('display_order', { ascending: true });

    if (error) throw error;

    return (data || []) as EducationSection[];
  } catch (error: any) {
    console.error('[educationContentService] Get all sections error:', error);
    throw error;
  }
}

/**
 * Create a new education section
 * Starts as unpublished (is_published = false)
 *
 * @param section - Section data
 * @returns Created section
 */
export async function createSection(section: {
  title: string;
  body: string;
  image_url?: string | null;
  display_order: number;
  section_type: SectionType;
}): Promise<EducationSection> {
  try {
    // Validate title length
    if (section.title.length < 3 || section.title.length > 100) {
      throw new ContentValidationError('Title must be 3-100 characters', 'INVALID_TITLE_LENGTH');
    }

    // Validate body length
    if (section.body.length < 10 || section.body.length > 2000) {
      throw new ContentValidationError('Body must be 10-2000 characters', 'INVALID_BODY_LENGTH');
    }

    // Validate image URL length if provided
    if (section.image_url && section.image_url.length > 500) {
      throw new ContentValidationError('Image URL must be ≤ 500 characters', 'INVALID_URL_LENGTH');
    }

    const { data, error } = await supabase
      .from('education_sections')
      .insert({
        ...section,
        is_published: false,
      })
      .select()
      .single();

    if (error) throw error;

    return data as EducationSection;
  } catch (error: any) {
    console.error('[educationContentService] Create section error:', error);
    throw error;
  }
}

/**
 * Update an existing education section
 * Cannot change is_published here (use publish/unpublish RPCs)
 *
 * @param id - Section ID
 * @param updates - Section updates
 * @returns Updated section
 */
export async function updateSection(
  id: string,
  updates: {
    title?: string;
    body?: string;
    image_url?: string | null;
    display_order?: number;
  }
): Promise<EducationSection> {
  try {
    // Validate title length if provided
    if (updates.title && (updates.title.length < 3 || updates.title.length > 100)) {
      throw new ContentValidationError('Title must be 3-100 characters', 'INVALID_TITLE_LENGTH');
    }

    // Validate body length if provided
    if (updates.body && (updates.body.length < 10 || updates.body.length > 2000)) {
      throw new ContentValidationError('Body must be 10-2000 characters', 'INVALID_BODY_LENGTH');
    }

    // Validate image URL length if provided
    if (updates.image_url && updates.image_url.length > 500) {
      throw new ContentValidationError('Image URL must be ≤ 500 characters', 'INVALID_URL_LENGTH');
    }

    const { data, error } = await supabase
      .from('education_sections')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return data as EducationSection;
  } catch (error: any) {
    console.error('[educationContentService] Update section error:', error);
    throw error;
  }
}

/**
 * Publish a section via RPC
 * Unpublishes any other section of the same type atomically
 * MUST be called by admin only (RPC enforces this)
 *
 * @param id - Section ID
 * @returns Success status
 */
export async function publishSection(id: string): Promise<void> {
  try {
    // DB signature: publish_section(p_section_id uuid) — the argument name must
    // match exactly or PostgREST returns PGRST202 (function not found).
    const { error } = await supabase.rpc('publish_section', {
      p_section_id: id,
    });

    if (error) {
      if (error.message?.includes('UnauthorizedError')) {
        throw new UnauthorizedError('Only admins can publish sections', 'ADMIN_ONLY');
      }
      if (error.code === '23505') {
        // Unique constraint violation
        throw new DuplicatePublishedSectionError('section');
      }
      // Friendly fallback so a raw backend string (e.g. PGRST202) never reaches
      // the admin UI on a regression. Original error is logged in the catch below.
      throw new ContentActionError('We couldn\'t publish this section right now. Please try again in a moment.');
    }
  } catch (error: any) {
    console.error('[educationContentService] Publish section error:', error);
    throw error;
  }
}

/**
 * Unpublish a section via RPC
 * MUST be called by admin only (RPC enforces this)
 *
 * @param id - Section ID
 * @returns Success status
 */
export async function unpublishSection(id: string): Promise<void> {
  try {
    // DB signature: unpublish_section(p_section_id uuid)
    const { error } = await supabase.rpc('unpublish_section', {
      p_section_id: id,
    });

    if (error) {
      if (error.message?.includes('UnauthorizedError')) {
        throw new UnauthorizedError('Only admins can unpublish sections', 'ADMIN_ONLY');
      }
      // Friendly fallback (see publishSection above).
      throw new ContentActionError('We couldn\'t unpublish this section right now. Please try again in a moment.');
    }
  } catch (error: any) {
    console.error('[educationContentService] Unpublish section error:', error);
    throw error;
  }
}

/**
 * Delete a draft section via RPC
 * Refuses published sections (must unpublish first)
 * MUST be called by admin only (RPC enforces this)
 *
 * @param id - Section ID
 * @returns Success status
 */
export async function deleteSection(id: string): Promise<void> {
  try {
    // DB signature: delete_section(p_section_id uuid)
    const { error } = await supabase.rpc('delete_section', {
      p_section_id: id,
    });

    if (error) {
      if (error.message?.includes('UnauthorizedError')) {
        throw new UnauthorizedError('Only admins can delete sections', 'ADMIN_ONLY');
      }
      if (error.message?.includes('PublishedSectionError')) {
        throw new ContentActionError('Unpublish this section before deleting it.');
      }
      // Friendly fallback (see publishSection above).
      throw new ContentActionError('We couldn\'t delete this section right now. Please try again in a moment.');
    }
  } catch (error: any) {
    console.error('[educationContentService] Delete section error:', error);
    throw error;
  }
}
