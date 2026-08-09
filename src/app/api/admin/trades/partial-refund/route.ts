/**
 * API route: POST /api/admin/trades/partial-refund
 *
 * Server-side proxy for the trade-refund Edge Function.
 * Issues a PARTIAL / line-item refund for a single trade (e.g. refund item price
 * but keep the platform fee). Does NOT change trade status — it's a payment
 * adjustment. The service role key never leaves the server.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const {
      tradeId,
      refundPriceCents = 0,
      refundFeeCents = 0,
      refundTaxCents = 0,
      reason,
      adminId,
    } = body as {
      tradeId?: string;
      refundPriceCents?: number;
      refundFeeCents?: number;
      refundTaxCents?: number;
      reason?: string;
      adminId?: string | null;
    };

    if (!tradeId) {
      return NextResponse.json({ error: 'tradeId is required' }, { status: 400 });
    }
    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 });
    }
    const total =
      (Number(refundPriceCents) || 0) +
      (Number(refundFeeCents) || 0) +
      (Number(refundTaxCents) || 0);
    if (total <= 0) {
      return NextResponse.json(
        { error: 'Refund amount must be greater than zero' },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 },
      );
    }

    const adminSecret = process.env.ADMIN_UI_SECRET || '';
    const edgeResponse = await fetch(`${supabaseUrl}/functions/v1/trade-refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'x-admin-ui-secret': adminSecret,
      },
      body: JSON.stringify({
        trade_id: tradeId,
        refund_price_cents: Number(refundPriceCents) || 0,
        refund_fee_cents: Number(refundFeeCents) || 0,
        refund_tax_cents: Number(refundTaxCents) || 0,
        reason,
        admin_user_id: adminId ?? null,
        issue_refund: true,
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
      console.error('[api/admin/trades/partial-refund]', {
        tradeId,
        status: edgeResponse.status,
        error: data?.error,
        details: data?.details,
      });
      return NextResponse.json(
        { error: data?.error?.message || data?.error || `Edge function error ${edgeResponse.status}` },
        { status: edgeResponse.status },
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[api/admin/trades/partial-refund] unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
