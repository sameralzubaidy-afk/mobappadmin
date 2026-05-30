// File: p2p-kids-admin/src/app/api/support/route.ts
// Admin API — list all support messages joined with user profile details.
// Uses service role key so RLS is bypassed (admin-only endpoint).

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'unread' | 'read' | null (all)

    // Step 1: Fetch support messages
    let msgQuery = supabase
      .from('support_messages')
      .select('id, user_id, subject, message, status, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (status === 'unread' || status === 'read') {
      msgQuery = msgQuery.eq('status', status);
    }

    const { data: messages, error: msgError } = await msgQuery;

    if (msgError) {
      console.error('[api/support GET] messages query', msgError);
      return NextResponse.json(
        { error: 'Failed to fetch support messages', details: msgError.message },
        { status: 500 }
      );
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json([]);
    }

    // Step 2: Fetch profiles for those user_ids
    // (support_messages.user_id → auth.users.id, profiles.user_id → auth.users.id — no direct FK)
    const userIds = [...new Set(messages.map((m) => m.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, name, email, phone')
      .in('user_id', userIds);

    const profileMap = Object.fromEntries(
      (profiles ?? []).map((p) => [p.user_id, p])
    );

    // Step 3: Enrich messages with profile data
    const enriched = messages.map((m) => ({
      ...m,
      profiles: profileMap[m.user_id] ?? { name: null, email: null, phone: null },
    }));

    return NextResponse.json(enriched);
  } catch (err) {
    console.error('[api/support GET] unexpected error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
