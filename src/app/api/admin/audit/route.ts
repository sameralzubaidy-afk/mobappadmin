/**
 * API route: GET /api/admin/audit
 *
 * Returns the unified financial audit journal (`financial_audit_log`) for the
 * admin Financial Audit screen. This is the N2 cross-cutting journal — every
 * payment / SP / fee / tax transition. Filters: mutation_type, entity_type,
 * search (entity id / trade id / idempotency key), date range. Service role key
 * stays on the server (BP-49: client sends only `x-admin-secret`).
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
    const mutationType = url.searchParams.get('mutation_type') || '';
    const entityType = url.searchParams.get('entity_type') || '';
    const q = (url.searchParams.get('q') || '').trim();
    const from = url.searchParams.get('from') || '';
    const to = url.searchParams.get('to') || '';
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

    // BP-45: query the text-cast view admin_financial_audit_view (UUIDs pre-cast
    // to text) so ilike search on entity/trade/idempotency-key works via PostgREST.
    const base = `${supabaseUrl}/rest/v1/admin_financial_audit_view?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`;
    let urlQuery = base;

    if (mutationType) {
      urlQuery += `&mutation_type=eq.${encodeURIComponent(mutationType)}`;
    }
    if (entityType) {
      urlQuery += `&entity_type=eq.${encodeURIComponent(entityType)}`;
    }
    if (from) {
      urlQuery += `&created_at=gte.${encodeURIComponent(from)}`;
    }
    if (to) {
      urlQuery += `&created_at=lte.${encodeURIComponent(to)}`;
    }
    if (q) {
      const encoded = encodeURIComponent(`*${q}*`);
      urlQuery += `&or=(entity_id_text.ilike.${encoded},trade_id_text.ilike.${encoded},idempotency_key.ilike.${encoded})`;
    }

    const resp = await fetch(urlQuery, { headers, cache: 'no-store' });
    if (!resp.ok) {
      const text = await resp.text();
      console.error('[api/admin/audit] fetch failed:', resp.status, text);
      return NextResponse.json({ error: `Fetch failed: ${resp.status}` }, { status: 500 });
    }

    const rows = await resp.json();
    return NextResponse.json({ data: rows || [] });
  } catch (err: any) {
    console.error('[api/admin/audit] error:', err);
    return NextResponse.json({ error: err.message || 'Failed to load audit log' }, { status: 500 });
  }
}
