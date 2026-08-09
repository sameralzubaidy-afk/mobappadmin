// File: p2p-kids-admin/src/app/api/admin/health/route.ts
// Admin dashboard health strip API.
//
// GET /api/admin/health
//   -> { success, data: admin_health_summary() }
//
// Thin server wrapper: authenticates the admin, calls the read-only RPC
// (migration 20260809000003_admin_health_strip.sql) and returns the 6
// indicator values + configurable thresholds. Data-only — never mutates state.

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { getAdminSupabaseClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase.rpc('admin_health_summary');
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[api/admin/health] unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
