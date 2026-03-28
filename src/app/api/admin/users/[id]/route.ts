// API Route: GET /api/admin/users/[id]
// Task: ADMIN-V2-006
// Returns full user detail (profile + subscription + SP + trades + badges + activity)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const authHeader = req.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

    // Verify admin session
    const {
      data: { user },
      error: authError,
    } = bearerToken
      ? await supabase.auth.getUser(bearerToken)
      : await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = params.id;

    // Call the RPC function
    const { data, error } = await supabase.rpc('admin_get_user_detail', {
      p_admin_id: user.id,
      p_user_id: userId,
    });

    if (error) {
      console.error('[Admin User Detail API] RPC Error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch user detail' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Admin User Detail API] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const authHeader = req.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

    // Verify admin session
    const {
      data: { user },
      error: authError,
    } = bearerToken
      ? await supabase.auth.getUser(bearerToken)
      : await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = params.id;
    const { reason } = await req.json();

    if (!reason || reason.trim() === '') {
      return NextResponse.json(
        { error: 'Deletion reason is required' },
        { status: 400 }
      );
    }

    // Call the RPC function
    const { data, error } = await supabase.rpc('admin_delete_user', {
      p_admin_id: user.id,
      p_user_id: userId,
      p_reason: reason,
    });

    if (error) {
      console.error('[Admin Delete User API] RPC Error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to delete user' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Admin Delete User API] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
