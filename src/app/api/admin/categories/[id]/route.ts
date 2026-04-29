import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { UpdateCategoryInput } from '../../../../../types/category';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_SECRET = process.env.ADMIN_UI_SECRET;

const NAME_REGEX = /^[A-Za-z0-9 ]{3,50}$/;
const SP_EARNING_MIN = 1.05;
const SP_EARNING_MAX = 1.4;
const SP_SPENDING_CAP_MIN = 50;
const SP_SPENDING_CAP_MAX = 80;

function createAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function isUnauthorized(request: NextRequest): boolean {
  const headerSecret = request.headers.get('x-admin-secret');
  return !!ADMIN_SECRET && headerSecret !== ADMIN_SECRET;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (isUnauthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Missing Supabase server configuration' },
      { status: 500 }
    );
  }

  const categoryId = params.id;
  let body: UpdateCategoryInput;

  try {
    body = (await request.json()) as UpdateCategoryInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: currentCategory, error: currentError } = await supabase
    .from('categories')
    .select('*')
    .eq('id', categoryId)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json(
      { error: `Failed to load category: ${currentError.message}` },
      { status: 500 }
    );
  }

  if (!currentCategory) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!NAME_REGEX.test(name)) {
      return NextResponse.json(
        { error: 'Name must be 3-50 characters, letters, numbers, and spaces only.' },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .ilike('name', name)
      .neq('id', categoryId)
      .maybeSingle();

    if (existing?.id) {
      return NextResponse.json(
        { error: `A category with this name already exists: ${name}` },
        { status: 409 }
      );
    }
  }

  if (
    body.sp_earning_multiplier !== undefined &&
    (body.sp_earning_multiplier < SP_EARNING_MIN ||
      body.sp_earning_multiplier > SP_EARNING_MAX)
  ) {
    return NextResponse.json(
      {
        error: `sp_earning_multiplier must be between ${SP_EARNING_MIN} and ${SP_EARNING_MAX}`,
      },
      { status: 400 }
    );
  }

  if (
    body.sp_spending_cap_percent !== undefined &&
    (body.sp_spending_cap_percent < SP_SPENDING_CAP_MIN ||
      body.sp_spending_cap_percent > SP_SPENDING_CAP_MAX)
  ) {
    return NextResponse.json(
      {
        error: `sp_spending_cap_percent must be between ${SP_SPENDING_CAP_MIN} and ${SP_SPENDING_CAP_MAX}`,
      },
      { status: 400 }
    );
  }

  const nextIsActive = body.is_active;
  if (
    nextIsActive === false &&
    String(currentCategory.name || '').toLowerCase() === 'other'
  ) {
    return NextResponse.json(
      { error: 'Cannot deactivate the "Other" category - it is required by the system.' },
      { status: 400 }
    );
  }

  const updatePayload: Record<string, unknown> = {};

  if (body.name !== undefined) updatePayload.name = body.name.trim();
  if (body.description !== undefined) updatePayload.description = body.description;
  if (body.icon !== undefined) updatePayload.icon = body.icon;
  if (body.icon_url !== undefined) updatePayload.icon_url = body.icon_url;
  if (body.bonus_badge_icon_url !== undefined)
    updatePayload.bonus_badge_icon_url = body.bonus_badge_icon_url;
  if (body.is_active !== undefined) updatePayload.is_active = body.is_active;
  if (body.sp_earning_multiplier !== undefined)
    updatePayload.sp_earning_multiplier = body.sp_earning_multiplier;
  if (body.sp_spending_cap_percent !== undefined)
    updatePayload.sp_spending_cap_percent = body.sp_spending_cap_percent;
  if (body.sp_config_notes !== undefined)
    updatePayload.sp_config_notes = body.sp_config_notes;
  if (body.sp_rate_change_notify !== undefined)
    updatePayload.sp_rate_change_notify = body.sp_rate_change_notify;

  const { data, error } = await supabase
    .from('categories')
    .update(updatePayload)
    .eq('id', categoryId)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Failed to update category: ${error.message}`, code: error.code },
      { status: 500 }
    );
  }

  return NextResponse.json({ data }, { status: 200 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (isUnauthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Missing Supabase server configuration' },
      { status: 500 }
    );
  }

  const categoryId = params.id;
  const supabase = createAdminClient();

  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('id, name, item_count')
    .eq('id', categoryId)
    .maybeSingle();

  if (categoryError) {
    return NextResponse.json(
      { error: `Failed to load category: ${categoryError.message}` },
      { status: 500 }
    );
  }

  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  if ((category.item_count || 0) > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${category.item_count} items still assigned to this category.` },
      { status: 409 }
    );
  }

  if (String(category.name || '').toLowerCase() === 'other') {
    return NextResponse.json(
      { error: 'Cannot delete the "Other" category - it is required by the system.' },
      { status: 400 }
    );
  }

  const { error: deleteError } = await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId);

  if (deleteError) {
    return NextResponse.json(
      { error: `Failed to delete category: ${deleteError.message}`, code: deleteError.code },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
