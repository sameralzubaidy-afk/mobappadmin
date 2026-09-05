import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '../../../../lib/supabase/server';

type WaitlistStatus = 'pending' | 'notified' | 'joined';

const ALLOWED_STATUSES: WaitlistStatus[] = ['pending', 'notified', 'joined'];
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4 || 4)) % 4);
    const payload = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isServiceRoleKey(token: string): boolean {
  const payload = decodeJwtPayload(token);
  return payload?.role === 'service_role';
}

function createServiceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !isServiceRoleKey(SUPABASE_SERVICE_ROLE_KEY)) {
    return null;
  }

  return createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function createUserTokenClient(accessToken: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const authClient = createClient();
    const authHeader = req.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const {
      data: { user },
      error: authError,
    } = bearerToken
      ? await authClient.auth.getUser(bearerToken)
      : await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userTokenClient = bearerToken ? createUserTokenClient(bearerToken) : null;
    const metadataAdmin =
      user.user_metadata?.is_admin === true || user.user_metadata?.is_admin === 'true';
    let rbacAdmin = false;

    if (userTokenClient) {
      const { data: rbacRow } = await userTokenClient
        .from('role_based_access_control')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      rbacAdmin = !!rbacRow;
    }

    const isAdminUser = metadataAdmin || rbacAdmin;
    if (!isAdminUser) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const serviceClient = createServiceClient();
    if (rbacAdmin && !metadataAdmin && !serviceClient) {
      return NextResponse.json(
        {
          error:
            'Server configuration requires a valid service role key for RBAC-admin waitlist access.',
        },
        { status: 500 }
      );
    }

    const queryClient = serviceClient || userTokenClient || authClient;

    const searchParams = req.nextUrl.searchParams;
    const statusParam = searchParams.get('status');
    const search = (searchParams.get('search') || '').trim();
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('page_size') || '25', 10)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let baseQuery = queryClient
      .from('zip_waitlist')
      .select(
        `
          id,
          user_id,
          email,
          requested_zip,
          assigned_node_id,
          status,
          created_at,
          updated_at,
          nodes:assigned_node_id (
            id,
            name,
            city,
            state,
            zip_code
          )
        `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    if (statusParam && ALLOWED_STATUSES.includes(statusParam as WaitlistStatus)) {
      baseQuery = baseQuery.eq('status', statusParam);
    }

    if (search) {
      const escaped = search.replace(/[%_]/g, '').replace(/,/g, '').slice(0, 100);
      baseQuery = baseQuery.or(`email.ilike.%${escaped}%,requested_zip.ilike.%${escaped}%`);
    }

    const { data, error, count } = await baseQuery.range(from, to);

    if (error) {
      console.error('[Admin Waitlist API] query error:', error);
      return NextResponse.json({ error: error.message || 'Failed to fetch waitlist entries' }, { status: 500 });
    }

    const rows = data || [];
    const userIds = rows
      .map((row: any) => row.user_id)
      .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0);

    // profiles stores the display name in the `name` column (there is no `display_name` column).
    let displayNameByUserId: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profileRows, error: profileError } = await queryClient
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);

      if (profileError) {
        console.warn('[Admin Waitlist API] profile lookup warning:', profileError);
      } else {
        displayNameByUserId = (profileRows || []).reduce((acc: Record<string, string>, row: any) => {
          if (typeof row.user_id === 'string' && typeof row.name === 'string') {
            acc[row.user_id] = row.name;
          }
          return acc;
        }, {});
      }
    }

    const entries = rows.map((row: any) => ({
      ...row,
      user_display_name: displayNameByUserId[row.user_id] || null,
    }));

    return NextResponse.json({
      entries,
      total: count || 0,
      page,
      page_size: pageSize,
      total_pages: count ? Math.max(1, Math.ceil(count / pageSize)) : 1,
    });
  } catch (error: any) {
    console.error('[Admin Waitlist API] unexpected error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
