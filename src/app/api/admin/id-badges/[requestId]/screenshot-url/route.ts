// File: p2p-kids-admin/src/app/api/admin/id-badges/[requestId]/screenshot-url/route.ts
// TASK BADGE-010: Get signed URL for ID screenshot

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest,
  { params }: { params: { requestId: string } }) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get request to find screenshot path
    const { data: req, error: reqError } = await supabase
      .from('id_badge_verification_requests')
      .select('screenshot_path')
      .eq('id', params.requestId)
      .single();

    if (reqError || !req?.screenshot_path) {
      return NextResponse.json({ error: 'Screenshot not found' }, { status: 404 });
    }

    // Generate signed URL (valid for 1 hour)
    const { data, error } = await supabase.storage
      .from('id-badge-verification-screenshots')
      .createSignedUrl(req.screenshot_path, 3600);

    if (error) throw error;

    return NextResponse.json({ url: data.signedUrl });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate URL' },
      { status: 500 }
    );
  }
}
