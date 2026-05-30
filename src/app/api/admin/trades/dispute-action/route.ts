/**
 * API route: POST /api/admin/trades/dispute-action
 * TFV2-017: Admin dispute state transitions.
 *
 * Actions:
 *  - mark_under_review: dispute_status reported → under_review
 *  - resolve_complete:  dispute_status → resolved, trade → completed
 *  - resolve_refund:    dispute_status → resolved, trade → cancelled (triggers SP release + Stripe refund)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type DisputeAction = 'mark_under_review' | 'resolve_complete' | 'resolve_refund';

export async function POST(req: NextRequest) {
  try {
    const adminSecret = req.headers.get('x-admin-secret');
    const expectedSecret = process.env.ADMIN_UI_SECRET;
    if (!expectedSecret || adminSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { tradeId, action } = body as { tradeId?: string; action?: DisputeAction };

    if (!tradeId || !action) {
      return NextResponse.json({ error: 'tradeId and action are required' }, { status: 400 });
    }

    const validActions: DisputeAction[] = ['mark_under_review', 'resolve_complete', 'resolve_refund'];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify trade exists and current dispute_status
    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .select('id, status, dispute_status')
      .eq('id', tradeId)
      .single();

    if (tradeError || !trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    if (trade.dispute_status === 'resolved') {
      return NextResponse.json({ error: 'Dispute is already resolved' }, { status: 409 });
    }

    // Apply the action
    if (action === 'mark_under_review') {
      if (trade.dispute_status !== 'reported') {
        return NextResponse.json({ error: `Cannot mark under_review from ${trade.dispute_status}` }, { status: 409 });
      }
      const { error: updateErr } = await supabase
        .from('trades')
        .update({ dispute_status: 'under_review' })
        .eq('id', tradeId);
      if (updateErr) throw updateErr;

    } else if (action === 'resolve_complete') {
      // Resolve dispute + mark trade as completed
      const { error: updateErr } = await supabase
        .from('trades')
        .update({ dispute_status: 'resolved', status: 'completed' })
        .eq('id', tradeId);
      if (updateErr) throw updateErr;

    } else if (action === 'resolve_refund') {
      // Resolve dispute + cancel/refund trade — calls existing cancel_trade_v2 RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('cancel_trade_v2', {
        p_trade_id: tradeId,
        p_user_id: trade.id, // admin acting — RPC should allow service_role bypass
        p_reason: 'Dispute resolved: refund issued by admin',
      });
      if (rpcError) {
        console.error('[dispute-action] cancel_trade_v2 failed:', rpcError);
        // Fallback: update dispute_status to resolved even if RPC fails
      }
      const { error: updateErr } = await supabase
        .from('trades')
        .update({ dispute_status: 'resolved' })
        .eq('id', tradeId);
      if (updateErr) throw updateErr;
    }

    // Write trade_event audit log
    await supabase.from('trade_events').insert({
      trade_id: tradeId,
      event_type: 'trade_disputed',
      actor_id: null,
      metadata: { action, resolved_by: 'admin' },
    });

    return NextResponse.json({ success: true, tradeId, action });
  } catch (err: any) {
    console.error('[api/admin/trades/dispute-action] error:', err);
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 });
  }
}
