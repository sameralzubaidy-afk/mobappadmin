// filepath: p2p-kids-admin/src/app/api/admin/sp-wallet/actions/route.ts
// Module: MODULE-12-ADMIN-V2 / TASK ADMIN-V2-003
// POST /api/admin/sp-wallet/actions
//   Body { action: 'adjust', user_id, amount, reason, notes? }
//      | { action: 'toggle_status', user_id, new_status, notes? }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { SpWalletActionRequest } from '@/types/sp-wallet';
import { getActingAdminId } from '@/lib/adminAuth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_UI_SECRET = process.env.ADMIN_UI_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function POST(request: NextRequest) {
  // Auth guard
  const adminSecret = request.headers.get('x-admin-secret');
  if (!adminSecret || adminSecret !== ADMIN_UI_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // DEV-TASK-62 (QA Task 8, Item 1): recover the acting admin's identity from
  // the client's Bearer JWT so sp_ledger.admin_id + admin_audit_logs.actor_id
  // record WHO adjusted the wallet. NULL fallback when no valid session.
  const actorId = await getActingAdminId(request);

  let body: SpWalletActionRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, user_id } = body;

  if (!action || !user_id) {
    return NextResponse.json({ error: 'action and user_id are required' }, { status: 400 });
  }

  try {
    if (action === 'adjust') {
      const { amount, reason, notes } = body as Extract<SpWalletActionRequest, { action: 'adjust' }>;

      if (amount === undefined || amount === null) {
        return NextResponse.json({ error: 'amount is required for adjust action' }, { status: 400 });
      }
      if (!reason || reason.trim() === '') {
        return NextResponse.json({ error: 'reason is required and cannot be empty' }, { status: 400 });
      }

      const { data, error } = await supabase.rpc('admin_adjust_sp_wallet', {
        p_user_id:     user_id,
        p_amount:      amount,
        p_reason:      reason.trim(),
        p_admin_notes: notes ?? null,
        p_actor_id:    actorId,
      });

      if (error) {
        console.error('[sp-wallet actions] admin_adjust_sp_wallet error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!data?.success) {
        return NextResponse.json({ error: data?.error ?? 'Adjustment failed' }, { status: 400 });
      }

      return NextResponse.json(data);
    }

    if (action === 'toggle_status') {
      const { new_status, notes } = body as Extract<SpWalletActionRequest, { action: 'toggle_status' }>;

      if (!new_status) {
        return NextResponse.json({ error: 'new_status is required' }, { status: 400 });
      }

      const { data, error } = await supabase.rpc('admin_toggle_sp_wallet_status', {
        p_user_id:     user_id,
        p_new_status:  new_status,
        p_admin_notes: notes ?? null,
        p_actor_id:    actorId,
      });

      if (error) {
        console.error('[sp-wallet actions] admin_toggle_sp_wallet_status error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!data?.success) {
        return NextResponse.json({ error: data?.error ?? 'Status change failed' }, { status: 400 });
      }

      return NextResponse.json(data);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[sp-wallet actions POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
