import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const ADMIN_UI_SECRET = process.env.ADMIN_UI_SECRET || process.env.NEXT_PUBLIC_ADMIN_UI_SECRET;
  const secretHeader = req.headers.get('x-admin-ui-secret') || '';
  if (!ADMIN_UI_SECRET || secretHeader !== ADMIN_UI_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const envPresent = !!SUPABASE_SERVICE_ROLE_KEY;
  const keyLength = SUPABASE_SERVICE_ROLE_KEY ? SUPABASE_SERVICE_ROLE_KEY.length : 0;

  // Heuristic: try to decode JWT payload and check for service_role and project ref
  let appearsServiceRole = false;
  let tokenPayload: any = null;
  let payloadString = '';
  try {
    if (SUPABASE_SERVICE_ROLE_KEY) {
      const parts = SUPABASE_SERVICE_ROLE_KEY.split('.');
      if (parts.length >= 2) {
        tokenPayload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        payloadString = JSON.stringify(tokenPayload);
        appearsServiceRole = payloadString.includes('service_role');
      }
    }
  } catch (e) {
    // ignore
  }

  // extract project ref from SUPABASE_URL host
  let urlProjectRef: string | null = null;
  try {
    if (SUPABASE_URL) {
      const host = new URL(SUPABASE_URL).host; // e.g., drntwgporzabmxdqykrp.supabase.co
      urlProjectRef = host.split('.')[0];
    }
  } catch (e) {
    // ignore
  }

  const matchesUrlRef = urlProjectRef ? payloadString.includes(urlProjectRef) : false;

  // Try a safe test call to the Supabase function endpoint to check key validity
  let supabaseTest: any = null;
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      };

      // If the function is protected by ADMIN_TRIGGER_SECRET, forward it
      if (process.env.ADMIN_TRIGGER_SECRET) headers['x-admin-token'] = process.env.ADMIN_TRIGGER_SECRET;

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/monitor-mid-trade-subscription-changes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ test: true }),
      });

      const text = await resp.text();
      supabaseTest = { status: resp.status, ok: resp.ok, bodySnippet: text.slice(0, 512) };
    } catch (err: any) {
      supabaseTest = { error: String(err) };
    }
  }

  return NextResponse.json({
    envPresent,
    keyLength,
    appearsServiceRole,
    tokenPayload: tokenPayload || null,
    urlProjectRef,
    matchesUrlRef,
    supabaseUrlPresent: !!SUPABASE_URL,
    supabaseTest,
  });
}