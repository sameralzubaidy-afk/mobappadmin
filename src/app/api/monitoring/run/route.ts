import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const adminSecretHeader = req.headers.get('x-admin-ui-secret') || '';
  const ADMIN_UI_SECRET = process.env.ADMIN_UI_SECRET || process.env.NEXT_PUBLIC_ADMIN_UI_SECRET;

  if (!ADMIN_UI_SECRET || adminSecretHeader !== ADMIN_UI_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Missing Supabase configuration on server' }, { status: 500 });
  }

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    };

    // If the Supabase function is protected by an ADMIN_TRIGGER_SECRET, include it
    if (process.env.ADMIN_TRIGGER_SECRET) {
      headers['x-admin-token'] = process.env.ADMIN_TRIGGER_SECRET;
    }

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/monitor-mid-trade-subscription-changes`, {
      method: 'POST',
      headers,
    });

    const data = await resp.json();
    if (!resp.ok) {
      return NextResponse.json({ error: data }, { status: resp.status });
    }

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}