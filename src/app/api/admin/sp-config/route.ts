// API Route: /api/admin/sp-config
// Purpose: Read/write sp_config table (Swap Points configuration)
// filepath: p2p-kids-admin/src/app/api/admin/sp-config/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_UI_SECRET = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '';

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);

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

/**
 * GET /api/admin/sp-config
 * Query params:
 * - key: string (optional) - get single config item
 * - category: string (optional) - filter by category
 * - prefix: string (optional) - filter by config_key prefix (recommended)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');
    const category = searchParams.get('category');
    const prefix = searchParams.get('prefix');

    let query = adminClient.from('sp_config').select('*');

    if (key) {
      query = query.eq('config_key', key).limit(1).single();
    } else if (prefix) {
      query = query.like('config_key', `${prefix}%`);
    } else if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[sp-config API] GET error:', error);
      return jsonNoStore(
        { error: error.message },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      );
    }

    return jsonNoStore({ success: true, data });
  } catch (err: any) {
    console.error('[sp-config API] GET exception:', err);
    return jsonNoStore(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/sp-config
 * Body: { key: string, value: string }
 * Headers: x-admin-secret: string
 * 
 * Uses upsert logic: tries update first, if 0 rows affected then inserts new row
 */
export async function PATCH(req: NextRequest) {
  try {
    // Verify admin secret
    const adminSecret = req.headers.get('x-admin-secret');
    if (!adminSecret || adminSecret !== ADMIN_UI_SECRET) {
      return jsonNoStore(
        { error: 'Unauthorized: Invalid admin secret' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return jsonNoStore(
        { error: 'Missing required fields: key, value' },
        { status: 400 }
      );
    }

    // Upsert logic: try update first
    const { data: updateData, error: updateError } = await adminClient
      .from('sp_config')
      .update({ 
        config_value: value,
        updated_at: new Date().toISOString(),
      })
      .eq('config_key', key)
      .select();

    // If update succeeded and returned rows, return success
    if (updateData && updateData.length > 0) {
      console.log(`[sp-config API] ✅ Updated ${key} = ${value}`);
      return jsonNoStore({ success: true, data: updateData[0] });
    }

    // If update returned 0 rows, the key doesn't exist - insert it
    if (!updateError || updateData?.length === 0) {
      const { data: insertData, error: insertError } = await adminClient
        .from('sp_config')
        .insert([
          {
            config_key: key,
            config_value: value,
            value_type: 'boolean',
            description: `Auto-created: ${key}`,
            category: 'referral',
          },
        ])
        .select()
        .single();

      if (insertError) {
        console.error('[sp-config API] Insert error:', insertError);
        return jsonNoStore(
          { error: insertError.message },
          { status: 500 }
        );
      }

      console.log(`[sp-config API] ✅ Created new config ${key} = ${value}`);
      return jsonNoStore({ success: true, data: insertData });
    }

    // Update error occurred
    if (updateError) {
      console.error('[sp-config API] Update error:', updateError);
      return jsonNoStore(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return jsonNoStore({ success: true, data: updateData });
  } catch (err: any) {
    console.error('[sp-config API] PATCH exception:', err);
    return jsonNoStore(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
