import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ADMIN_SECRET = process.env.ADMIN_UI_SECRET;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
} as const;

function jsonNoStore(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...NO_STORE_HEADERS,
      ...(init?.headers || {}),
    },
  });
}

function isServiceKeyValid(serviceKey: string | undefined) {
  return !!serviceKey && serviceKey.length > 10 && !serviceKey.includes('REPLACE');
}

console.log('[Admin Config API] Initializing with:', {
  hasServiceKey: !!SERVICE_KEY,
  serviceKeyLength: SERVICE_KEY?.length || 0,
  supabaseUrl: SUPABASE_URL,
  hasAdminSecret: !!ADMIN_SECRET,
});

if (!SERVICE_KEY || !SUPABASE_URL) {
  console.warn('❌ Supabase service key or URL not set for admin API routes');
} else {
  console.log('✅ Admin API initialized with service role key');
}

export async function GET() {
  const key = isServiceKeyValid(SERVICE_KEY) ? SERVICE_KEY : ANON_KEY;
  const client = createClient(SUPABASE_URL || '', key || '');
  try {
    const { data, error } = await client.from('admin_config').select('*').order('key');
    if (error) throw error;
    const can_write = isServiceKeyValid(SERVICE_KEY);
    console.log(`[Admin Config] can_write=${can_write}, has_service_key=${!!SERVICE_KEY}, key_length=${SERVICE_KEY?.length || 0}`);
    return jsonNoStore({ data, can_write });
  } catch (err: any) {
    // Fallback: call Supabase REST directly using anon key
    try {
      const anon = ANON_KEY;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/admin_config?select=*`, {
        headers: {
          apikey: anon || '',
          Authorization: `Bearer ${anon || ''}`,
        },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`REST fallback failed: ${res.status}`);
      const data = await res.json();
      const can_write = isServiceKeyValid(SERVICE_KEY);
      return jsonNoStore({ data, can_write });
    } catch (fallbackErr: any) {
      return jsonNoStore({ error: err.message || fallbackErr.message }, { status: 500 });
    }
  }
}

export async function PATCH(req: Request) {
  // Basic protection: require admin secret header
  const headerSecret = req.headers.get('x-admin-secret');
  if (ADMIN_SECRET && headerSecret !== ADMIN_SECRET) {
    console.log('[Admin Config PATCH] Unauthorized: missing or wrong admin secret');
    return jsonNoStore({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { key, value, user_id } = body;
    if (!key || value === undefined) {
      return jsonNoStore({ error: 'Missing key or value' }, { status: 400 });
    }

    console.log(`[Admin Config PATCH] Updating key=${key}, value=${value}`);

    // Use service role key for admin config updates
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const WRITE_KEY = isServiceKeyValid(SERVICE_KEY) ? SERVICE_KEY : undefined;

    if (!SUPABASE_URL || !WRITE_KEY) {
      throw new Error('Admin writes are disabled: missing/invalid SUPABASE_SERVICE_ROLE_KEY');
    }

    // Call the secure RPC function instead of direct table update
    // This bypasses RLS issues and ensures atomic sync to sp_config
    const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/secure_upsert_admin_config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': WRITE_KEY,
        'Authorization': `Bearer ${WRITE_KEY}`,
      },
      body: JSON.stringify({
        p_key: key,
        p_value: String(value), // Ensure value is a string
        p_user_id: user_id || null,
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('[Admin Config PATCH] RPC error:', updateResponse.status, errorText);
      throw new Error(`Failed to update config via RPC: ${updateResponse.status} - ${errorText}`);
    }

    const result = await updateResponse.json();
    console.log(`[Admin Config PATCH] ✅ RPC Result:`, result);

    if (!result.success) {
      throw new Error(result.error || 'Failed to update configuration via secure RPC');
    }

    // Try to log to audit trail (non-blocking)
    try {
      const auditResponse = await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY || '',
          'Authorization': `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({
          user_id: user_id || null,
          action: 'UPDATE_CONFIG',
          resource_type: 'admin_config',
          resource_id: key,
          details: {
            key,
            old_value: body.old_value || null,
            new_value: value,
            timestamp: new Date().toISOString(),
          },
        }),
      });
    } catch (auditErr) {
      console.warn('[Admin Config PATCH] Audit log failed (non-blocking):', auditErr);
    }

    return jsonNoStore({ data: result.data });
  } catch (err: any) {
    console.error('[Admin Config PATCH] Error:', err.message);
    return jsonNoStore(
      { error: err.message || 'Failed to save configuration' },
      { status: 500 }
    );
  }
}
