// API Route: GET /api/admin/users
// Task: ADMIN-V2-006
// Returns paginated user list with search/filter support

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

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

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search') || null;
    const accountStatus = searchParams.get('account_status') || null;
    const subscriptionStatus = searchParams.get('subscription_status') || null;
    const rawNodeId = searchParams.get('node_id');
    const nodeId = rawNodeId && rawNodeId !== 'all' ? rawNodeId : null;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('page_size') || '20', 10);

    if (nodeId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(nodeId)) {
      return NextResponse.json({ error: 'Invalid node_id format' }, { status: 400 });
    }

    // Call the RPC function
    const { data, error } = await supabase.rpc('admin_list_users', {
      p_admin_id: user.id,
      p_search: search,
      p_account_status: accountStatus,
      p_subscription_status: subscriptionStatus,
      p_node_id: nodeId,
      p_page: page,
      p_page_size: pageSize,
    });

    if (error) {
      console.error('[Admin Users API] RPC Error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch users' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Admin Users API] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
