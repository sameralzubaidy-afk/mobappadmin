/**
 * API route: GET /api/admin/payments
 *
 * Returns the payments reconciliation ledger (one row per trade) for the
 * admin Payments page. Filters: status, search (trade id / PI id / bundle id).
 * Service role key stays on the server.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status') || '';
    const q = (url.searchParams.get('q') || '').trim();
    const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500);
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const headers = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    };

    // TC-K09 (2026-08-01): query admin_payments_view (UUIDs pre-cast to text) so
    // ilike search works. PostgREST cannot apply ilike to a UUID column, and
    // ::text casts are NOT supported inside or=() filters — see migration
    // 20260801000003_create_admin_payments_view.sql (mirrors admin_trades_view).
    const base = `${supabaseUrl}/rest/v1/admin_payments_view?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`;
    let urlQuery = base;

    if (status) {
      urlQuery += `&status=eq.${encodeURIComponent(status)}`;
    }
    if (q) {
      // PostgREST OR across trade_id / stripe_payment_intent_id / bundle_id.
      // trade_id & bundle_id are already text in admin_payments_view; no casts here.
      const encoded = encodeURIComponent(`*${q}*`);
      const orClause = `or=(trade_id.ilike.${encoded},stripe_payment_intent_id.ilike.${encoded},bundle_id.ilike.${encoded})`;
      urlQuery += `&${orClause}`;
    }

    const resp = await fetch(urlQuery, { headers, cache: 'no-store' });
    if (!resp.ok) {
      const text = await resp.text();
      console.error('[api/admin/payments] fetch failed:', resp.status, text);
      return NextResponse.json({ error: `Fetch failed: ${resp.status}` }, { status: 500 });
    }

    const rows = await resp.json();

    // Attach buyer/seller display names (best-effort, batched)
    const userIds = new Set<string>();
    for (const r of rows) {
      if (r.buyer_id) userIds.add(r.buyer_id);
      if (r.seller_id) userIds.add(r.seller_id);
    }
    const names = new Map<string, string>();
    if (userIds.size > 0) {
      const ids = [...userIds].slice(0, 50); // PostgREST in-list cap
      const inClause = ids.map((id) => `"${id}"`).join(',');
      const profileResp = await fetch(
        `${supabaseUrl}/rest/v1/profiles?select=user_id,name&user_id=in.(${inClause})&limit=200`,
        { headers, cache: 'no-store' },
      );
      if (profileResp.ok) {
        const profileRows = await profileResp.json();
        for (const p of profileRows) {
          if (p.user_id) names.set(p.user_id, p.name || '');
        }
      }
    }

    const enriched = (rows || []).map((r: any) => ({
      ...r,
      buyer_name: names.get(r.buyer_id) || '',
      seller_name: names.get(r.seller_id) || '',
    }));

    return NextResponse.json({ data: enriched });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[api/admin/payments] unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
