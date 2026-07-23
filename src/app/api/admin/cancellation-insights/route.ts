// File: p2p-kids-admin/src/app/api/admin/cancellation-insights/route.ts
// Module: Admin — Cancellation Insights Dashboard
// GET /api/admin/cancellation-insights?start=ISO&end=ISO
//   -> calls public.admin_cancellation_insights RPC
// GET /api/admin/cancellation-insights?user_id=UUID&start=ISO&end=ISO
//   -> calls public.admin_cancellation_user_detail RPC for drill-down

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_UI_SECRET = process.env.ADMIN_UI_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MIGRATION_HINT =
  'Apply migration: supabase/migrations/20260712000001_admin_cancellation_insights.sql';

function isMigrationMissing(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === 'PGRST202' ||
    /function.*does not exist|could not find the function/i.test(error.message ?? '')
  );
}

export async function GET(request: NextRequest) {
  // Auth guard
  const adminSecret = request.headers.get('x-admin-secret');
  if (!adminSecret || adminSecret !== ADMIN_UI_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userDetailId = searchParams.get('user_id');
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  const end = endParam ? new Date(endParam) : new Date();
  const start = startParam
    ? new Date(startParam)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
  }

  try {
    if (userDetailId) {
      // Per-user drill-down
      const { data, error } = await supabase.rpc('admin_cancellation_user_detail', {
        p_user_id: userDetailId,
        p_start: start.toISOString(),
        p_end: end.toISOString(),
      });

      if (error) {
        console.error('[cancellation-insights] user detail RPC error:', error);
        if (isMigrationMissing(error)) {
          return NextResponse.json(
            { error: `Cancellation user detail RPC not installed. ${MIGRATION_HINT}`, code: 'MIGRATION_MISSING' },
            { status: 503 },
          );
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, cancellations: data });
    }

    // Default: KPI summary + reasons + top users
    const { data, error } = await supabase.rpc('admin_cancellation_insights', {
      p_start: start.toISOString(),
      p_end: end.toISOString(),
    });

    if (error) {
      console.error('[cancellation-insights] RPC error:', error);
      if (isMigrationMissing(error)) {
        return NextResponse.json(
          { error: `Cancellation insights RPC not installed. ${MIGRATION_HINT}`, code: 'MIGRATION_MISSING' },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    console.error('[cancellation-insights] unexpected:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal server error' },
      { status: 500 },
    );
  }
}
