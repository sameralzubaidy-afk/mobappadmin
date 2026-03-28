// API Route: POST /api/admin/users/[id]/suspend
// Task: ADMIN-V2-006
// Suspends a user account

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../../../lib/supabase/server';

export async function POST(
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
        { error: 'Suspension reason is required' },
        { status: 400 }
      );
    }

    // Call the RPC function
    const { data, error } = await supabase.rpc('admin_suspend_user', {
      p_admin_id: user.id,
      p_user_id: userId,
      p_reason: reason,
    });

    if (error) {
      console.error('[Admin Suspend User API] RPC Error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to suspend user' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Admin Suspend User API] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
