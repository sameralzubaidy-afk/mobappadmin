/**
 * API route: GET /api/admin/disputes/[tradeId]
 * TFV2-017: Fetch single trade for admin dispute detail view.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  req: NextRequest,
  { params }: { params: { tradeId: string } }
) {
  try {
    const adminSecret = req.headers.get('x-admin-secret');
    const expectedSecret = process.env.ADMIN_UI_SECRET;
    if (!expectedSecret || adminSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tradeId } = params;
    if (!tradeId) {
      return NextResponse.json({ error: 'tradeId is required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: trade, error } = await supabase
      .from('trades')
      .select(
        'id, status, dispute_status, dispute_reason, dispute_notes, dispute_reported_at, dispute_resolution, buyer_id, seller_id, cash_amount_cents, sp_amount, buyer_transaction_fee_cents, listing:items(title, price)'
      )
      .eq('id', tradeId)
      .single();

    if (error || !trade) {
      return NextResponse.json({ error: error?.message ?? 'Trade not found' }, { status: 404 });
    }

    return NextResponse.json({ trade });
  } catch (err: any) {
    console.error('[api/admin/disputes/[tradeId]] error:', err);
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 });
  }
}
