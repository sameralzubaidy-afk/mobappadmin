// API Route: GET /api/admin/users/analytics
// Task: ADMIN-V2-006
// Returns user analytics (counts, DAU/MAU, subscription breakdown)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';

export async function GET(req: NextRequest) {
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

    // Call the RPC function
    const { data, error } = await supabase.rpc('admin_get_user_analytics', {
      p_admin_id: user.id,
    });

    if (error) {
      console.error('[Admin User Analytics API] RPC Error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch analytics' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Admin User Analytics API] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
