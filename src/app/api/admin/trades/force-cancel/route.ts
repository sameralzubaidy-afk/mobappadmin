/**
 * API route: POST /api/admin/trades/force-cancel
 *
 * Server-side proxy for the admin-trade-action Edge Function.
 * The service role key never leaves the server — client components
 * authenticate with NEXT_PUBLIC_ADMIN_UI_SECRET only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';

export async function POST(req: NextRequest) {
  try {
    // PROD-010: centralized admin auth
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) {
      console.error('[api/admin/trades/force-cancel] auth failed:', {
        error: auth.error,
        hasXAdminSecret: !!req.headers.get('x-admin-secret'),
        adminSecretFromEnv: !!process.env.ADMIN_UI_SECRET,
      });
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { tradeId, reason, adminId } = body as {
      tradeId?: string;
      reason?: string;
      adminId?: string | null;
    };

    if (!tradeId || !reason) {
      return NextResponse.json(
        { error: 'tradeId and reason are required' },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[api/admin/trades/force-cancel] Missing env vars');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 },
      );
    }

    // Call the Edge Function server-side — service role key stays on the server
    const adminSecret = process.env.ADMIN_UI_SECRET || '';
    console.log('[api/admin/trades/force-cancel] Calling Edge Function:', {
      supabaseUrl,
      serviceRoleKeyLength: serviceRoleKey.length,
      adminSecretLength: adminSecret.length,
    });

    const edgeResponse = await fetch(
      `${supabaseUrl}/functions/v1/admin-trade-action`,
      {
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
          reason,
          issue_refund: true,
          adminId: adminId ?? null,
        }),
      },
    );

    const responseText = await edgeResponse.text();
    console.log('[api/admin/trades/force-cancel] Edge Function response:', {
      status: edgeResponse.status,
      body: responseText.substring(0, 500),
    });

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { error: responseText };
    }

    if (!edgeResponse.ok) {
      console.error('[api/admin/trades/force-cancel]', {
        tradeId,
        status: edgeResponse.status,
        error: data?.error,
        details: data?.details,
        debug: data?.debug,
      });
      return NextResponse.json(
        { error: data?.error || `Edge function error ${edgeResponse.status}` },
        { status: edgeResponse.status },
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[api/admin/trades/force-cancel] unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
