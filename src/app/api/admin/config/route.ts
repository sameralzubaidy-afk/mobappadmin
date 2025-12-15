import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ADMIN_SECRET = process.env.ADMIN_UI_SECRET;

if (!SERVICE_KEY || !SUPABASE_URL) {
  console.warn('Supabase service key or URL not set for admin API routes');
}

export async function GET() {
  // Use service key if available, otherwise anon key for read-only
  const key = SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const client = createClient(SUPABASE_URL || '', key || '');
  try {
    const { data, error } = await client.from('admin_config').select('*').order('key');
    if (error) throw error;
    const can_write = !!(SERVICE_KEY && !SERVICE_KEY.includes('REPLACE'));
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
      const can_write = !!(SERVICE_KEY && !SERVICE_KEY.includes('REPLACE'));
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Prefer service role key; fall back to anon key if not configured (DEV ONLY)
  const restKey = (SERVICE_KEY && !SERVICE_KEY.includes('REPLACE')) ? SERVICE_KEY : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    const body = await req.json();
    const { key, value, user_id } = body;
    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Missing key or value' }, { status: 400 });
    }

    // Update config via Supabase REST API (Prefer return=representation to get the updated row)
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/admin_config?key=eq.${encodeURIComponent(key)}`, {
      method: 'PATCH',
      headers: {
        apikey: restKey || '',
        Authorization: `Bearer ${restKey || ''}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ value, updated_at: new Date().toISOString() }),
    });

    if (!patchRes.ok) {
      const txt = await patchRes.text();
      throw new Error(`REST update failed: ${patchRes.status} ${txt}`);
    }

    const updatedData = await patchRes.json();
    const updated = Array.isArray(updatedData) ? updatedData[0] : updatedData;

    if (!updated || Object.keys(updated).length === 0) {
      return NextResponse.json({ error: 'Update did not affect any rows. Ensure SUPABASE_SERVICE_ROLE_KEY is configured for authoritative updates.' }, { status: 403 });
    }

    // Insert audit log via REST
    const auditRes = await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
      method: 'POST',
      headers: {
        apikey: restKey || '',
        Authorization: `Bearer ${restKey || ''}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify([{ user_id: user_id || null, action: 'UPDATE_CONFIG', resource_type: 'admin_config', resource_id: key, details: { key, new_value: value, timestamp: new Date().toISOString() } }]),
    });

    if (!auditRes.ok) {
      const txt = await auditRes.text();
      console.warn('Audit log insert failed:', txt);
    }

    return NextResponse.json({ data: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
