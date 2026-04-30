// File: p2p-kids-admin/src/app/api/admin/sp-economy/summary/route.ts
// Module: SP Economy Hub
// GET /api/admin/sp-economy/summary?start=ISO&end=ISO&node_id=UUID
//   -> calls public.admin_sp_economy_summary RPC
// GET /api/admin/sp-economy/summary?action=nodes
//   -> returns { nodes: [{ id, name }] } for the node filter dropdown

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
  'Apply migration: supabase/migrations/20260429000013_admin_sp_economy_summary.sql';

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
  const action = searchParams.get('action');

  // Sub-route: list nodes for filter dropdown
  if (action === 'nodes') {
    const { data, error } = await supabase
      .from('nodes')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) {
      console.error('[sp-economy/summary] nodes list error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, nodes: data ?? [] });
  }

  // Default: KPI summary
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');
  const nodeId = searchParams.get('node_id') || null;

  const end = endParam ? new Date(endParam) : new Date();
  const start = startParam
    ? new Date(startParam)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase.rpc('admin_sp_economy_summary', {
      p_start: start.toISOString(),
      p_end: end.toISOString(),
      p_node_id: nodeId,
    });

    if (error) {
      console.error('[sp-economy/summary] RPC error:', error);
      if (isMigrationMissing(error)) {
        return NextResponse.json(
          {
            error: `SP Economy summary RPC not installed. ${MIGRATION_HINT}`,
            code: 'MIGRATION_MISSING',
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, summary: data });
  } catch (err: any) {
    console.error('[sp-economy/summary] unexpected:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal server error' },
      { status: 500 },
    );
  }
}
