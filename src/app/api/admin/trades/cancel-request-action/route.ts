/**
 * API route: POST /api/admin/trades/cancel-request-action
 *
 * FIX-CANCEL (2026-09-01): Admin resolves a buyer's cancellation request.
 *
 *  - action=approve_cancel: marks the request approved (+ notifies the buyer),
 *    THEN runs the money path via the existing `admin-trade-action` Edge Function
 *    (SP re-credit + Stripe refund) — same path as Force Cancel Trade.
 *  - action=keep_trade:      marks the request resolved with resolution
 *    `keep_trade` (trade continues, both parties notified). No money moves.
 *
 * Server-side proxy — the service role key never reaches the browser; clients
 * authenticate with `x-admin-secret` (BP-49) and, when available, the admin JWT
 * so audit rows record WHO acted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { getAdminSupabaseClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) {
      console.error('[api/admin/trades/cancel-request-action] auth failed:', {
        error: auth.error,
      });
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { tradeId, action, adminId } = body as {
      tradeId?: string;
      action?: 'approve_cancel' | 'keep_trade';
      adminId?: string | null;
    };

    if (!tradeId || !action || !['approve_cancel', 'keep_trade'].includes(action)) {
      return NextResponse.json(
        { error: 'tradeId and action (approve_cancel|keep_trade) are required' },
        { status: 400 },
      );
    }

    const supabase = getAdminSupabaseClient();

    // 1) Resolve the cancel request (state + notifications) via the shared RPC.
    const { data: resolveData, error: resolveError } = await supabase.rpc(
      'fn_resolve_cancel_request',
      {
        p_trade_id: tradeId,
        p_admin_id: adminId ?? null,
        p_action: action,
      },
    );

    if (resolveError) {
      console.error('[cancel-request-action] resolve error:', {
        tradeId,
        action,
        error: resolveError.message,
      });
      return NextResponse.json({ error: resolveError.message }, { status: 500 });
    }

    const resolve = (resolveData ?? {}) as Record<string, unknown>;
    if (resolve.success !== true) {
      console.error('[cancel-request-action] resolve failed:', {
        tradeId,
        action,
        error: resolve.error,
      });
      return NextResponse.json(
        { error: (resolve.error as string) || 'Could not resolve the cancellation request' },
        { status: 400 },
      );
    }

    // 2) approve_cancel → run the money path via the existing admin-trade-action EF.
    if (action === 'approve_cancel') {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceRoleKey) {
        console.error('[cancel-request-action] Missing env vars');
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
      }

      const adminSecret = process.env.ADMIN_UI_SECRET || '';
      const edgeResponse = await fetch(`${supabaseUrl}/functions/v1/admin-trade-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          'x-admin-ui-secret': adminSecret,
        },
        body: JSON.stringify({
          action: 'force-cancel',
          tradeId,
          reason: 'Cancel request approved by admin',
          issue_refund: true,
          adminId: adminId ?? null,
        }),
      });

      const responseText = await edgeResponse.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { error: responseText };
      }

      if (!edgeResponse.ok) {
        console.error('[cancel-request-action] force-cancel EF error:', {
          tradeId,
          status: edgeResponse.status,
          error: data?.error,
        });
        return NextResponse.json(
          { error: data?.error || `Edge function error ${edgeResponse.status}` },
          { status: 502 },
        );
      }

      return NextResponse.json({ success: true, action, data: resolveData, cancel: data });
    }

    return NextResponse.json({ success: true, action, data: resolveData });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[cancel-request-action] unexpected error:', message);
    return NextResponse.json(
      { error: message || 'Internal server error' },
      { status: 500 },
    );
  }
}
