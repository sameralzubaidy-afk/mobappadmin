// File: p2p-kids-admin/src/app/api/admin/id-badges/[requestId]/route.ts
// TASK BADGE-010: Get single ID badge request

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const { data, error } = await supabase
      .from('id_badge_verification_requests')
      .select('*')
      .eq('id', params.requestId)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching request:', error);
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
}
