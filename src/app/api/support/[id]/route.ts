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
    .select('id, user_id, contact_email, contact_phone, subject, message, status, created_at, updated_at')
    .eq('id', id)
    .single();

  if (msgError || !msg) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  let profile = null;
  if (msg.user_id) {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, name, email, phone')
      .eq('user_id', msg.user_id)
      .single();
    profile = data ?? null;
  }

  // Admin reply thread for this ticket
  const { data: replies } = await supabase
    .from('support_message_replies')
    .select('id, admin_id, reply_text, created_at')
    .eq('support_message_id', id)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    ...msg,
    replies: replies ?? [],
    profiles: msg.user_id
      ? profile ?? { name: null, email: null, phone: null }
      : { name: 'Guest', email: msg.contact_email, phone: msg.contact_phone, is_guest: true },
  });
}
