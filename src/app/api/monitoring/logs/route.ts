import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const ADMIN_UI_SECRET = process.env.ADMIN_UI_SECRET || process.env.NEXT_PUBLIC_ADMIN_UI_SECRET;
  const secretHeader = req.headers.get('x-admin-ui-secret') || '';
  if (!ADMIN_UI_SECRET || secretHeader !== ADMIN_UI_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Missing Supabase configuration on server' }, { status: 500 });
  }

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/admin_monitoring_logs?order=created_at.desc&select=*`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      // Handle missing table gracefully (PostgREST returns PGRST205 when table not found in schema cache)
      if (resp.status === 404 || (text && text.includes("Could not find the table 'public.admin_monitoring_logs'"))) {
        return NextResponse.json({ ok: true, data: [], warning: 'admin_monitoring_logs table not found; run migration to create it' });
      }
      return NextResponse.json({ error: text }, { status: resp.status });
    }

    const data = await resp.json();
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}