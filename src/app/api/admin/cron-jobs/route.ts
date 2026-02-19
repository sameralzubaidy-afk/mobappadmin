import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

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

function parseBoolean(value: string | null, fallbackValue: boolean) {
  if (value === null) return fallbackValue;
  return value.toLowerCase() === 'true';
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const includeInactive = parseBoolean(url.searchParams.get('includeInactive'), true);
    const timezone = url.searchParams.get('timezone') || 'UTC';

    const key = isServiceKeyValid(SERVICE_KEY) ? SERVICE_KEY : ANON_KEY;

    if (!SUPABASE_URL || !key) {
      return jsonNoStore(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }

    const client = createClient(SUPABASE_URL, key);

    const { data, error } = await client.rpc('get_cron_jobs_with_last_run', {
      p_include_inactive: includeInactive,
      p_timezone: timezone,
    });

    if (error) {
      return jsonNoStore(
        { error: error.message, details: error },
        { status: 500 }
      );
    }

    return jsonNoStore({ data });
  } catch (error: any) {
    return jsonNoStore(
      { error: error?.message || 'Failed to fetch cron jobs status' },
      { status: 500 }
    );
  }
}
