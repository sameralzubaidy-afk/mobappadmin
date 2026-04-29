import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { createCategory } from '../../../../../../lib/categoryService';
import type { ApproveSuggestionInput } from '../../../../../../types/category';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_SECRET = process.env.ADMIN_UI_SECRET;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ApproveBody = ApproveSuggestionInput & {
  adminUserId?: string | null;
};

function createAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function isValidUuid(value: string | null | undefined): value is string {
  return !!value && UUID_REGEX.test(value);
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
    throw new Error(`Failed to count category items: ${countError.message}`);
  }

  const { error: updateError } = await supabase
    .from('categories')
    .update({ item_count: count || 0 })
    .eq('id', categoryId);

  if (updateError) {
    throw new Error(`Failed to sync category item_count: ${updateError.message}`);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const headerSecret = request.headers.get('x-admin-secret');
  if (ADMIN_SECRET && headerSecret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Missing Supabase server configuration' },
      { status: 500 }
    );
  }

  let body: ApproveBody;
  try {
    body = (await request.json()) as ApproveBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body?.categoryData?.name) {
    return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
  }

  const suggestionId = params.id;
  const supabase = createAdminClient();

  const { data: suggestion, error: suggestionError } = await supabase
    .from('category_suggestions')
    .select('id, item_id, status')
    .eq('id', suggestionId)
    .maybeSingle();

  if (suggestionError) {
    return NextResponse.json(
      { error: `Failed to fetch suggestion: ${suggestionError.message}` },
      { status: 500 }
    );
  }

  if (!suggestion) {
    return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
  }

  if (suggestion.status !== 'pending') {
    return NextResponse.json(
      { error: `Suggestion is already ${suggestion.status}` },
      { status: 409 }
    );
  }

  const { data: currentItem, error: currentItemError } = await supabase
    .from('items')
    .select('id, category_id, status')
    .eq('id', suggestion.item_id)
    .maybeSingle();

  if (currentItemError) {
    return NextResponse.json(
      { error: `Failed to fetch item: ${currentItemError.message}` },
      { status: 500 }
    );
  }

  if (!currentItem) {
    return NextResponse.json({ error: 'Suggested item not found' }, { status: 404 });
  }

  let createdCategoryId: string | null = null;
  let reassignedItem = false;

  try {
    const createdCategory = await createCategory(body.categoryData);
    createdCategoryId = createdCategory.id;

    const shouldReassign = body.reassignItem !== false;
    if (shouldReassign) {
      const { data: updatedItem, error: updateItemError } = await supabase
        .from('items')
        .update({ category_id: createdCategory.id })
        .eq('id', suggestion.item_id)
        .select('id, category_id')
        .maybeSingle();

      if (updateItemError || !updatedItem) {
        throw new Error(
          `Failed to reassign item: ${updateItemError?.message || 'No rows were updated'}`
        );
      }

      reassignedItem = true;
      await syncCategoryItemCount(supabase, currentItem.category_id);
      await syncCategoryItemCount(supabase, createdCategory.id);
    }

    const { data: updatedSuggestion, error: updateSuggestionError } = await supabase
      .from('category_suggestions')
      .update({
        status: 'approved',
        approved_by: isValidUuid(body.adminUserId) ? body.adminUserId : null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', suggestionId)
      .select('id')
      .maybeSingle();

    if (updateSuggestionError || !updatedSuggestion) {
      throw new Error(
        `Failed to update suggestion: ${
          updateSuggestionError?.message || 'No rows were updated'
        }`
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          suggestionId,
          categoryId: createdCategory.id,
          itemId: suggestion.item_id,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (reassignedItem) {
      await supabase
        .from('items')
        .update({ category_id: currentItem.category_id })
        .eq('id', suggestion.item_id);
      await syncCategoryItemCount(supabase, currentItem.category_id);
      await syncCategoryItemCount(supabase, createdCategoryId);
    }

    if (createdCategoryId) {
      await supabase.from('categories').delete().eq('id', createdCategoryId);
    }

    const message = error instanceof Error ? error.message : 'Failed to approve suggestion';
    const statusCode = /already exists|required|must be|invalid/i.test(message) ? 400 : 500;

    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
