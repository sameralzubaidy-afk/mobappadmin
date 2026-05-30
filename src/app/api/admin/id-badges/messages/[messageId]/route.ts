// File: p2p-kids-admin/src/app/api/admin/id-badges/messages/[messageId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function PUT(request: NextRequest,
  { params }: { params: { messageId: string } }) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { messageId } = params;
    const body = await request.json();
    const { message_text } = body;

    // Validation
    if (!message_text || message_text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message text cannot be empty' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // TODO(AUTH): Verify admin role from session
    // For now, service role key bypasses RLS

    const { data, error } = await supabase
      .from('id_badge_verification_messages')
      .update({ message_text: message_text.trim() })
      .eq('id', messageId)
      .select()
      .single();

    if (error) {
      console.error('[ID Badge Messages API] Error updating message:', error);
      return NextResponse.json(
        { error: 'Failed to update message', details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // Log admin activity
    // TODO(AUDIT): Add to admin_activity_log table
    console.log(`[ID Badge Messages API] Updated message ${messageId}`);

    return NextResponse.json({ success: true, message: data });
  } catch (error: any) {
    console.error('[ID Badge Messages API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
