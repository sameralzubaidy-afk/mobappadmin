// filepath: p2p-kids-admin/src/app/api/admin/sp-wallet/route.ts
// Module: MODULE-12-ADMIN-V2 / TASK ADMIN-V2-003
// GET /api/admin/sp-wallet          -> SP economy metrics
// GET /api/admin/sp-wallet?user_id= -> Wallet detail + ledger for one user

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_UI_SECRET = process.env.ADMIN_UI_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function GET(request: NextRequest) {
  // Auth guard
  const adminSecret = request.headers.get('x-admin-secret');
  if (!adminSecret || adminSecret !== ADMIN_UI_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  try {
    if (userId) {
      // Wallet detail for a specific user
      const { data, error } = await supabase
        .rpc('admin_get_sp_wallet_detail', { p_user_id: userId });

      if (error) {
        console.error('[sp-wallet] admin_get_sp_wallet_detail error:', error);
        const isMigrationMissing =
          error.code === 'PGRST202' ||
          /function.*does not exist|could not find the function/i.test(error.message ?? '');
        if (isMigrationMissing) {
          return NextResponse.json(
            {
              error:
                'SP wallet admin RPCs are not installed. Please run the SQL migration: ' +
                'supabase/migrations/20260322000001_admin_v2_003_sp_wallet_rpcs.sql',
            },
            { status: 503 },
          );
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!data?.success) {
        return NextResponse.json({ error: data?.error ?? 'Not found' }, { status: 404 });
      }

      return NextResponse.json(data);
    }

    // Economy-wide metrics
    const { data, error } = await supabase.rpc('get_sp_economy_metrics');

    if (error) {
      console.error('[sp-wallet] get_sp_economy_metrics error:', error);
      // Detect migration-not-applied: PostgREST PGRST202 = function not found in schema cache
      const isMigrationMissing =
        error.code === 'PGRST202' ||
        /function.*does not exist|could not find the function/i.test(error.message ?? '');
      if (isMigrationMissing) {
        return NextResponse.json(
          {
            error:
              'SP wallet admin RPCs are not installed. Please run the SQL migration: ' +
              'supabase/migrations/20260322000001_admin_v2_003_sp_wallet_rpcs.sql',
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, metrics: data });
  } catch (err) {
    console.error('[sp-wallet GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
