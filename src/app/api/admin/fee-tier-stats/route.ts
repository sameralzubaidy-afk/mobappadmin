// API Route: Buyer Fee-Tier Distribution (R1 — Tiered Buyer-Fee Engine)
// filepath: p2p-kids-admin/src/app/api/admin/fee-tier-stats/route.ts
//
// Returns how many users are in each buyer-fee tier (flat vs percentage) via the
// fn_admin_get_fee_tier_stats SECURITY DEFINER RPC. Used by the Trade Timing page
// and the Analytics page.
//
// BP-49: browser fetches to /api/admin/* must send the x-admin-secret header
// (or an explicit Bearer JWT). verifyAdminAuth accepts both.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminAuth } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

export async function GET(request: Request) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const client = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data, error } = await client.rpc('fn_admin_get_fee_tier_stats');
    if (error) throw error;
    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err: any) {
    console.error('[API /admin/fee-tier-stats] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to load fee-tier stats' },
      { status: 500 }
    );
  }
}
