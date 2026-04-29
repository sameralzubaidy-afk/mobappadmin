import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { RejectSuggestionInput } from '../../../../../../types/category';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_SECRET = process.env.ADMIN_UI_SECRET;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RejectBody = RejectSuggestionInput & {
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

  let body: RejectBody;
  try {
    body = (await request.json()) as RejectBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const suggestionId = params.id;
  const supabase = createAdminClient();

  const { data: updatedSuggestion, error: updateError } = await supabase
    .from('category_suggestions')
    .update({
      status: 'rejected',
      approved_by: isValidUuid(body.adminUserId) ? body.adminUserId : null,
      admin_note: body.admin_note || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', suggestionId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to reject suggestion: ${updateError.message}` },
      { status: 500 }
    );
  }

  if (!updatedSuggestion) {
    return NextResponse.json(
      { error: 'Suggestion not found or already reviewed' },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        suggestionId,
      },
    },
    { status: 200 }
  );
}
