// API Route: POST /api/admin/users/[id]/reset-password
// Task: ADMIN-V2-006
// Triggers a password reset email for a user via Edge Function

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../../../lib/supabase/server';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const authHeader = req.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

    // Verify admin session
    const {
      data: { user },
      error: authError,
    } = bearerToken
      ? await supabase.auth.getUser(bearerToken)
      : await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = params.id;

    // Use incoming bearer token when present, fallback to cookie session.
    let accessToken = bearerToken;
    if (!accessToken) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      accessToken = session?.access_token;
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'No session found' }, { status: 401 });
    }

    // Call the Edge Function
    const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-trigger-password-reset`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        target_user_id: userId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Admin Reset Password API] Edge Function Error:', data);
      return NextResponse.json(
        { error: data.error || 'Failed to trigger password reset' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Admin Reset Password API] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
