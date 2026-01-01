/**
 * Admin API: Get payouts with search/filter
 * File: p2p-kids-admin/src/app/api/admin/payouts/route.ts
 * Module: MODULE-06-TRADE-FLOW-sellerpayouts.md
 * Task: PAY-008
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
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

    // Calculate stats from the returned data
    const stats = {
      total_count: enriched.length,
      total_completed: enriched.filter((p: any) => p.status === 'completed').length || 0,
      total_pending: enriched.filter((p: any) => ['pending', 'processing'].includes(p.status)).length || 0,
      total_failed: enriched.filter((p: any) => p.status === 'failed').length || 0,
      total_volume_cents: enriched.reduce((sum: number, p: any) => sum + (p.net_amount_cents || 0), 0) || 0
    };

    return NextResponse.json({ data: enriched, stats });
  } catch (err: any) {
    console.error('Admin payouts API error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
