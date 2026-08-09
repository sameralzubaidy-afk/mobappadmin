// File: p2p-kids-admin/src/app/api/admin/nodes/kpis/route.ts
// Admin portal — per-node marketplace KPIs (N6).
//
// GET /api/admin/nodes/kpis[?nodeId=<uuid>]
//   -> { success, data: admin_node_kpis(p_node_id) }
//
// Thin server wrapper: authenticates the admin (x-admin-secret / Bearer JWT),
// calls the read-only N6 RPC (migration 20260809000005_n6_node_tagging.sql)
// which returns the GTM §13 per-node expansion-gate metrics, and returns them.
// Data-only — never mutates state. The RPC is service-role-only, so this must
// run server-side (the client anon key cannot call it).
//
// When nodeId is omitted, the RPC returns every node's KPIs.

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

  const nodeId = request.nextUrl.searchParams.get('nodeId');

  try {
    const supabase = getAdminSupabaseClient();
    // Passing null explicitly matches the RPC default (all nodes).
    const { data, error } = await supabase.rpc('admin_node_kpis', {
      p_node_id: nodeId || null,
    });
    if (error) {
      console.error('[api/admin/nodes/kpis] rpc error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[api/admin/nodes/kpis] unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
