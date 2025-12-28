import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: { id: string } }) {
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
    const id = params.id;
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/trades?id=eq.${id}&select=*`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: text }, { status: resp.status });
    }

    const rows = await resp.json();
    return NextResponse.json({ ok: true, data: rows && rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}