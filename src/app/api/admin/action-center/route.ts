// File: p2p-kids-admin/src/app/api/admin/action-center/route.ts
// Admin Action Center API
//
// GET /api/admin/action-center
//   -> { success, data: admin_action_center_summary() }
// GET /api/admin/action-center?source=flagged_items|disputes|id_badge_requests|cancel_anomalies|failed_payouts|config_drift
//   -> { success, data: admin_action_center_detail(source) }
//
// Data-only: this route never mutates state. All resolution actions go through
// the existing per-domain admin endpoints (item status, dispute-action,
// id-badge decide, payout retry).

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { getAdminSupabaseClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_SOURCES = [
  'flagged_items',
  'disputes',
  'id_badge_requests',
  'cancel_anomalies',
  'failed_payouts',
  'config_drift',
] as const;

export async function GET(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const supabase = getAdminSupabaseClient();
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');

    if (source) {
      if (!(VALID_SOURCES as readonly string[]).includes(source)) {
        return NextResponse.json(
          { error: `Unknown source: ${source}` },
          { status: 400 },
        );
      }
      const { data, error } = await supabase.rpc('admin_action_center_detail', {
        p_source: source,
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, data });
    }

    const { data, error } = await supabase.rpc('admin_action_center_summary');
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[action-center] unexpected error:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal server error' },
      { status: 500 },
    );
  }
}
