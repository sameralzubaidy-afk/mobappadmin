// File: p2p-kids-admin/src/app/api/admin/id-badges/[requestId]/route.ts
// TASK BADGE-010: Get single ID badge request

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
// DEV-TASK-101: without revalidate=0, Next 14 caches this route's internal Supabase
// GET in .next/cache keyed by PostgREST URL. A request that was decided AFTER a
// pending payload got cached keeps serving stale "Pending" on /id-badges/<id>/details.
// Mirror the list/stats routes, which already set revalidate = 0.
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest,
  { params }: { params: { requestId: string } }) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { data, error } = await supabase
      .from('id_badge_verification_requests')
      .select('*, nodes:node_id(zip_code)')
      .eq('id', params.requestId)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching request:', error);
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
}
