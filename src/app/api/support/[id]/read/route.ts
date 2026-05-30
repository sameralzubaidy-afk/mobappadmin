// File: p2p-kids-admin/src/app/api/support/[id]/read/route.ts
// Admin API — mark a support message as read.
// Uses service role key so RLS is bypassed (admin-only endpoint).

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest,
  { params }: { params: { id: string } }) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: 'Missing message id' }, { status: 400 });
  }

  const { error } = await supabase
    .from('support_messages')
    .update({ status: 'read', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[api/support/[id]/read POST]', error);
    return NextResponse.json(
      { error: 'Failed to update message status', details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
