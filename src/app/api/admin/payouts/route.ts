/**
 * Admin API: Get payouts with search/filter
 * File: p2p-kids-admin/src/app/api/admin/payouts/route.ts
 * Module: MODULE-06-TRADE-FLOW-sellerpayouts.md
 * Task: PAY-008
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || null;
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Call the RPC function which has SECURITY DEFINER to access auth.users
    const { data, error } = await supabase.rpc('get_admin_payouts', {
      p_status: status,
      p_search: search,
      p_limit: limit,
      p_offset: offset
    });

    if (error) {
      console.error('Error fetching payouts:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Data is already enriched with seller info from the function
    const enriched = (data || []).map((payout: any) => ({
      ...payout,
      seller_email: payout.seller_email || null,
      seller_name: payout.seller_name || null
    }));

    // R54: the stat cards read as global aggregates (Total / Completed / Pending /
    // Failed / Total Volume), so they must NOT come from the 100-row page window.
    // Compute them from the full ledger via the same RPC at the admin_payouts_view
    // scope (status='all', p_limit=10000) — independent of the page/filter window.
    let stats = {
      total_count: 0,
      total_completed: 0,
      total_pending: 0,
      total_failed: 0,
      total_volume_cents: 0
    };
    try {
      const { data: allPayouts, error: allError } = await supabase.rpc(
        'get_admin_payouts',
        { p_status: 'all', p_search: null, p_limit: 10000, p_offset: 0 }
      );
      if (!allError) {
        const all = (allPayouts || []) as any[];
        stats = {
          total_count: all.length,
          total_completed: all.filter((p: any) => p.status === 'completed').length || 0,
          total_pending: all.filter((p: any) => ['pending', 'processing'].includes(p.status)).length || 0,
          total_failed: all.filter((p: any) => p.status === 'failed').length || 0,
          total_volume_cents: all.reduce((sum: number, p: any) => sum + (p.net_amount_cents || 0), 0) || 0
        };
      } else {
        console.error('Error computing global payout stats:', allError);
      }
    } catch (statsErr: any) {
      console.error('Error computing global payout stats:', statsErr);
    }

    return NextResponse.json({ data: enriched, stats });
  } catch (err: any) {
    console.error('Admin payouts API error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
