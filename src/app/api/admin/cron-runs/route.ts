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

function parseInteger(value: string | null, fallbackValue: number, minValue = 1, maxValue = 10000) {
  if (value === null) return fallbackValue;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallbackValue;
  return Math.min(Math.max(parsed, minValue), maxValue);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const lookbackHours = parseInteger(url.searchParams.get('lookbackHours'), 48, 1, 24 * 30);
    const limit = parseInteger(url.searchParams.get('limit'), 500, 1, 5000);
    const timezone = url.searchParams.get('timezone') || 'UTC';

    const key = isServiceKeyValid(SERVICE_KEY) ? SERVICE_KEY : ANON_KEY;

    if (!SUPABASE_URL || !key) {
      return jsonNoStore(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }

    const client = createClient(SUPABASE_URL, key);

    const { data, error } = await client.rpc('get_cron_recent_runs', {
      p_lookback_hours: lookbackHours,
      p_limit: limit,
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
      { error: error?.message || 'Failed to fetch cron run details' },
      { status: 500 }
    );
  }
}
