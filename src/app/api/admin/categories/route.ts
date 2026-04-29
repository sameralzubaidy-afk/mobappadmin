import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { CreateCategoryInput } from '../../../../types/category';

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

export async function GET(request: NextRequest) {
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

  const searchParams = request.nextUrl.searchParams;
  const includeInactive = searchParams.get('includeInactive') !== 'false';
  const rawOrderBy = searchParams.get('orderBy');
  const orderBy =
    rawOrderBy === 'name' || rawOrderBy === 'item_count' || rawOrderBy === 'display_order'
      ? rawOrderBy
      : 'display_order';

  const supabase = createAdminClient();

  let query = supabase.from('categories').select('*');

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  if (orderBy === 'display_order') {
    query = query.order('display_order', { ascending: true }).order('name', { ascending: true });
  } else if (orderBy === 'name') {
    query = query.order('name', { ascending: true });
  } else {
    query = query.order('item_count', { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: `Failed to fetch categories: ${error.message}`, code: error.code },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: data || [] }, { status: 200 });
}

export async function POST(request: NextRequest) {
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

  let body: CreateCategoryInput;
  try {
    body = (await request.json()) as CreateCategoryInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = (body.name || '').trim();
  if (!NAME_REGEX.test(name)) {
    return NextResponse.json(
      { error: 'Name must be 3-50 characters, letters, numbers, and spaces only.' },
      { status: 400 }
    );
  }

  const earningMultiplier = body.sp_earning_multiplier ?? 1.1;
  const spendingCap = body.sp_spending_cap_percent ?? 70;

  if (earningMultiplier < SP_EARNING_MIN || earningMultiplier > SP_EARNING_MAX) {
    return NextResponse.json(
      {
        error: `sp_earning_multiplier must be between ${SP_EARNING_MIN} and ${SP_EARNING_MAX}`,
      },
      { status: 400 }
    );
  }

  if (spendingCap < SP_SPENDING_CAP_MIN || spendingCap > SP_SPENDING_CAP_MAX) {
    return NextResponse.json(
      {
        error: `sp_spending_cap_percent must be between ${SP_SPENDING_CAP_MIN} and ${SP_SPENDING_CAP_MAX}`,
      },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .ilike('name', name)
    .maybeSingle();

  if (existing?.id) {
    return NextResponse.json(
      { error: `A category with this name already exists: ${name}` },
      { status: 409 }
    );
  }

  const { data: maxOrder } = await supabase
    .from('categories')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const displayOrder = (maxOrder?.display_order ?? 0) + 1;

  const { data, error } = await supabase
    .from('categories')
    .insert({
      name,
      description: body.description ?? null,
      icon: body.icon ?? null,
      icon_url: body.icon_url ?? null,
      bonus_badge_icon_url: body.bonus_badge_icon_url ?? null,
      is_active: body.is_active ?? true,
      sp_earning_multiplier: earningMultiplier,
      sp_spending_cap_percent: spendingCap,
      sp_config_notes: body.sp_config_notes ?? null,
      display_order: displayOrder,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Failed to create category: ${error.message}`, code: error.code },
      { status: 500 }
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}
