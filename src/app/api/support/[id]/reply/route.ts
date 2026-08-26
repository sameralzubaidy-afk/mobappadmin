// File: p2p-kids-admin/src/app/api/support/[id]/reply/route.ts
// Admin API — reply to a support ticket: stores the reply (support_message_replies)
// and emails the user via the send-email Edge Function (type: support_reply).

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

  let body: { reply?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const replyText = (body.reply ?? '').trim();
  if (!replyText) {
    return NextResponse.json({ error: 'Reply text is required' }, { status: 400 });
  }
  if (replyText.length > 5000) {
    return NextResponse.json(
      { error: 'Reply is too long (max 5000 characters)' },
      { status: 400 }
    );
  }

  // Load the ticket + the recipient: contact_email for guests, profile email for
  // authenticated users.
  const { data: msg, error: msgError } = await supabase
    .from('support_messages')
    .select('id, user_id, contact_email, subject, message, status')
    .eq('id', id)
    .single();

  if (msgError || !msg) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  let recipient = msg.contact_email;
  let recipientUserId = msg.user_id;
  if (msg.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', msg.user_id)
      .single();
    recipient = profile?.email ?? null;
  }

  if (!recipient) {
    return NextResponse.json(
      {
        error:
          'No recipient email available for this ticket (guest without email, or profile missing).',
      },
      { status: 400 }
    );
  }

  // Store the reply (source of truth for the admin thread)
  const { error: insertError } = await supabase.from('support_message_replies').insert({
    support_message_id: id,
    admin_id: auth.adminId ?? null,
    reply_text: replyText,
  });

  if (insertError) {
    console.error('[api/support/reply] insert error', insertError);
    return NextResponse.json(
      { error: 'Failed to save reply', details: insertError.message },
      { status: 500 }
    );
  }

  // Mark the ticket read
  await supabase.from('support_messages').update({ status: 'read' }).eq('id', id);

  // Email the reply.
  // CRITICAL: invoke headers use MATCHING keys (apikey + Authorization both
  // service-role). Mixing anon apikey with a service-role JWT caused the B02
  // UNAUTHORIZED_API_KEY_CONFLICTS 401. Reply is stored even if email fails.
  try {
    const { error: fnError } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'support_reply',
        to: recipient,
        userId: recipientUserId ?? undefined,
        category: 'system',
        isCritical: true,
        data: {
          subject: msg.subject,
          originalMessage: msg.message,
          reply: replyText,
        },
      },
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
    });

    if (fnError) {
      console.error('[api/support/reply] send-email invoke error', fnError);
      return NextResponse.json(
        {
          success: true,
          warning: `Reply saved but email delivery failed: ${fnError.message}`,
        },
        { status: 200 }
      );
    }
  } catch (err) {
    console.error('[api/support/reply] send-email exception', err);
  }

  return NextResponse.json({ success: true });
}
