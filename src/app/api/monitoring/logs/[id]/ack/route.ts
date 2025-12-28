import { NextResponse } from 'next/server';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const ADMIN_UI_SECRET = process.env.ADMIN_UI_SECRET || process.env.NEXT_PUBLIC_ADMIN_UI_SECRET;
  const secretHeader = req.headers.get('x-admin-ui-secret') || '';

  if (!ADMIN_UI_SECRET || secretHeader !== ADMIN_UI_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const note = body?.note || null;

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Missing Supabase configuration on server' }, { status: 500 });
  }

  try {
    // Patch the monitoring log entry
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/admin_monitoring_logs?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ acknowledged: true, notes: note }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: text }, { status: resp.status });
    }

    const updated = await resp.json();
    return NextResponse.json({ ok: true, updated });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}