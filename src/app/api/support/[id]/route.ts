// File: p2p-kids-admin/src/app/api/support/[id]/route.ts
// Admin API — fetch a single support message with profile details.

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest,
  { params }: { params: { id: string } }) {
  const auth = await verifyAdminAuth(_request);
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

  const { data: msg, error: msgError } = await supabase
    .from('support_messages')
    .select('id, user_id, subject, message, status, created_at, updated_at')
    .eq('id', id)
    .single();

  if (msgError || !msg) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, name, email, phone')
    .eq('user_id', msg.user_id)
    .single();

  return NextResponse.json({
    ...msg,
    profiles: profile ?? { name: null, email: null, phone: null },
  });
}
