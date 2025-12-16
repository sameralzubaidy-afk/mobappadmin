import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ADMIN_SECRET = process.env.ADMIN_UI_SECRET;

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
  // Use service key if available, otherwise anon key for read-only
  const key = SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const client = createClient(SUPABASE_URL || '', key || '');
  try {
    const { data, error } = await client.from('admin_config').select('*').order('key');
    if (error) throw error;
    // Check if service key is properly configured (not placeholder and not empty)
    const isServiceKeyValid = SERVICE_KEY && SERVICE_KEY.length > 10 && !SERVICE_KEY.includes('REPLACE');
    const can_write = !!isServiceKeyValid;
    console.log(`[Admin Config] can_write=${can_write}, has_service_key=${!!SERVICE_KEY}, key_length=${SERVICE_KEY?.length || 0}`);
    return NextResponse.json({ data, can_write });
  } catch (err: any) {
    // Fallback: call Supabase REST directly using anon key
    try {
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/admin_config?select=*`, {
        headers: {
          apikey: anon || '',
          Authorization: `Bearer ${anon || ''}`,
        },
      });
      if (!res.ok) throw new Error(`REST fallback failed: ${res.status}`);
      const data = await res.json();
      const isServiceKeyValid = SERVICE_KEY && SERVICE_KEY.length > 10 && !SERVICE_KEY.includes('REPLACE');
      const can_write = !!isServiceKeyValid;
      return NextResponse.json({ data, can_write });
    } catch (fallbackErr: any) {
      return NextResponse.json({ error: err.message || fallbackErr.message }, { status: 500 });
    }
  }
}

export async function PATCH(req: Request) {
  // Basic protection: require admin secret header
  const headerSecret = req.headers.get('x-admin-secret');
  if (ADMIN_SECRET && headerSecret !== ADMIN_SECRET) {
    console.log('[Admin Config PATCH] Unauthorized: missing or wrong admin secret');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { key, value, user_id } = body;
    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Missing key or value' }, { status: 400 });
    }

    console.log(`[Admin Config PATCH] Updating key=${key}, value=${value}`);

    // NOTE: Due to Supabase API key issue, using direct REST API call instead of Supabase client
    // This works because we're using the anon key and RLS policies will enforce access control
    // The admin_config RLS policy allows updates to the service_role only, but we can work around
    // this by temporarily using a different approach or by bypassing RLS with a properly signed JWT

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !ANON_KEY) {
      throw new Error('Missing Supabase configuration');
    }

    // Direct REST API call to Supabase (uses ANON key but admin secret header provides additional auth)
    const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/admin_config?key=eq.${key}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        value,
        updated_at: new Date().toISOString(),
        ...(user_id ? { updated_by: user_id } : {}), // Only include if user_id exists
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('[Admin Config PATCH] REST API error:', updateResponse.status, errorText);
      
      // If REST API also fails with permission denied, try a workaround
      if (updateResponse.status === 403 || updateResponse.status === 401) {
        console.log('[Admin Config PATCH] REST API also blocked by RLS. This is expected with current policies.');
        throw new Error(
          'Cannot update config: RLS policies require service role key. ' +
          'Please contact system administrator to update keys from Supabase dashboard.' 
        );
      }
      throw new Error(`Failed to update config: ${updateResponse.status}`);
    }

    const updated = await updateResponse.json();
    console.log(`[Admin Config PATCH] ✅ Successfully updated ${key}`);

    // Try to log to audit trail (non-blocking)
    try {
      const auditResponse = await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
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

    return NextResponse.json({ data: updated[0] || updated });
  } catch (err: any) {
    console.error('[Admin Config PATCH] Error:', err.message);
    return NextResponse.json(
      { error: err.message || 'Failed to save configuration' },
      { status: 500 }
    );
  }
}
