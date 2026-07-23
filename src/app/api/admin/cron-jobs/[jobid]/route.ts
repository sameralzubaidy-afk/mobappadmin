import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

function isServiceKeyValid(serviceKey: string | undefined) {
  return !!serviceKey && serviceKey.length > 10 && !serviceKey.includes('REPLACE');
}

/**
 * POST /api/admin/cron-jobs/[jobid]
 * Body: { action: "run-now" }
 *
 * Executes a pg_cron job's command immediately (one-time run).
 */
export async function POST(
  req: Request,
  { params }: { params: { jobid: string } }
) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const jobId = parseInt(params.jobid, 10);
    if (isNaN(jobId) || jobId <= 0) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    const body = await req.json();
    if (body?.action !== 'run-now') {
      return NextResponse.json({ error: 'Invalid action. Use "run-now".' }, { status: 400 });
    }

    const key = isServiceKeyValid(SERVICE_KEY) ? SERVICE_KEY : ANON_KEY;
    if (!SUPABASE_URL || !key) {
      return NextResponse.json({ error: 'Missing Supabase configuration' }, { status: 500 });
    }

    const client = createClient(SUPABASE_URL, key);

    const { data, error } = await client.rpc('run_cron_job_now', {
      p_job_id: jobId,
    });

    if (error) {
      console.error('[api/admin/cron-jobs/run-now] RPC error:', error);
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    const result = data as { success: boolean; error?: string; jobname?: string; result?: string };

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to run job' }, { status: 400 });
    }

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('[api/admin/cron-jobs/run-now] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to run cron job' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/cron-jobs/[jobid]
 * Body: { schedule: "cron expression" }
 *
 * Updates a pg_cron job's schedule expression.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { jobid: string } }
) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const jobId = parseInt(params.jobid, 10);
    if (isNaN(jobId) || jobId <= 0) {
      return NextResponse.json(
        { error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { schedule } = body;

    if (!schedule || typeof schedule !== 'string') {
      return NextResponse.json(
        { error: 'Schedule expression is required' },
        { status: 400 }
      );
    }

    const key = isServiceKeyValid(SERVICE_KEY) ? SERVICE_KEY : ANON_KEY;
    if (!SUPABASE_URL || !key) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }

    const client = createClient(SUPABASE_URL, key);

    const { data, error } = await client.rpc('update_cron_job_schedule', {
      p_job_id: jobId,
      p_schedule: schedule,
    });

    if (error) {
      console.error('[api/admin/cron-jobs/update] RPC error:', error);
      return NextResponse.json(
        { error: error.message, details: error },
        { status: 500 }
      );
    }

    const result = data as { success: boolean; error?: string; jobname?: string; new_schedule?: string };

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update cron job schedule' },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('[api/admin/cron-jobs/update] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update cron job schedule' },
      { status: 500 }
    );
  }
}
