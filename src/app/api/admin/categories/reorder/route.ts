import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { CategoryReorderItem } from '../../../../../types/category';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_SECRET = process.env.ADMIN_UI_SECRET;

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

export async function POST(request: NextRequest) {
  if (isUnauthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Missing Supabase server configuration' },
      { status: 500 }
    );
  }

  let body: { category_orders?: CategoryReorderItem[] };
  try {
    body = (await request.json()) as { category_orders?: CategoryReorderItem[] };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const categoryOrders = body.category_orders;
  if (!Array.isArray(categoryOrders)) {
    return NextResponse.json(
      { error: 'category_orders must be an array.' },
      { status: 400 }
    );
  }

  const normalized = categoryOrders.map((item) => ({
    id: String(item?.id || '').trim(),
    display_order: Number(item?.display_order),
  }));

  const invalidItem = normalized.find(
    (item) => !item.id || !Number.isInteger(item.display_order) || item.display_order < 1
  );

  if (invalidItem) {
    return NextResponse.json(
      { error: 'Each category order must include a valid id and integer display_order >= 1.' },
      { status: 400 }
    );
  }

  const ids = normalized.map((item) => item.id);
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json(
      { error: 'Duplicate category IDs detected in reorder payload.' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  if (ids.length > 0) {
    const { data: existingRows, error: existingError } = await supabase
      .from('categories')
      .select('id')
      .in('id', ids);

    if (existingError) {
      return NextResponse.json(
        { error: `Failed to validate category IDs: ${existingError.message}` },
        { status: 500 }
      );
    }

    const existingIds = new Set((existingRows || []).map((row) => row.id));
    const missingIds = ids.filter((id) => !existingIds.has(id));

    if (missingIds.length > 0) {
      return NextResponse.json(
        { error: `Invalid category IDs in reorder payload: ${missingIds.join(', ')}` },
        { status: 400 }
      );
    }
  }

  for (const item of normalized) {
    const { error } = await supabase
      .from('categories')
      .update({ display_order: item.display_order })
      .eq('id', item.id);

    if (error) {
      return NextResponse.json(
        { error: `Failed to reorder categories: ${error.message}`, code: error.code },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
