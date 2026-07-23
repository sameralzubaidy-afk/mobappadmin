import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
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
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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

    // Merge in manual run results from cron_manual_runs (created by Run Now button).
    // If a manual run is more recent than the last scheduled run, use its status.
    const jobs = (data || []) as any[];
    if (jobs.length > 0) {
      const { data: manualRuns, error: mrError } = await client
        .from('cron_manual_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);

      if (!mrError && manualRuns && manualRuns.length > 0) {
        // Group manual runs by jobid, take the most recent per job
        const latestManual = new Map<number, any>();
        for (const run of manualRuns) {
          if (!latestManual.has(run.jobid)) {
            latestManual.set(run.jobid, run);
          }
        }

        for (const job of jobs) {
          const manual = latestManual.get(job.jobid);
          if (
            manual &&
            (!job.last_start_time_utc ||
              new Date(manual.started_at) > new Date(job.last_start_time_utc))
          ) {
            job.last_status = manual.status;
            job.last_return_message = manual.return_message;
            job.last_start_time_utc = manual.started_at;
            job.last_start_time_local = manual.started_at;
            job.has_recent_run = true;
          }
        }
      }
    }

    return jsonNoStore({ data: jobs });
  } catch (error: any) {
    return jsonNoStore(
      { error: error?.message || 'Failed to fetch cron jobs status' },
      { status: 500 }
    );
  }
}
