// File: p2p-kids-admin/src/app/api/admin/id-badges/[requestId]/decide/route.ts
// TASK BADGE-010: Admin decision endpoint (approve/reject)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const body = await request.json();
    const { decision, rejection_reason, rejection_notes, approval_notes } = body;

    if (!decision || !['approve', 'reject'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });
    }

    // Get request details first
    const { data: req, error: reqError } = await supabase
      .from('id_badge_verification_requests')
      .select('screenshot_path, user_id')
      .eq('id', params.requestId)
      .single();

    if (reqError) throw reqError;

    // Update request with decision
    const updateData: any = {
      status: decision === 'approve' ? 'approved' : 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: request.headers.get('x-admin-user-id') || null,
    };

    if (decision === 'reject') {
      updateData.rejection_reason = rejection_reason;
      updateData.rejection_notes = rejection_notes;
    } else {
      updateData.approval_notes = approval_notes;
    }

    const { error: updateError } = await supabase
      .from('id_badge_verification_requests')
      .update(updateData)
      .eq('id', params.requestId);

    if (updateError) throw updateError;

    // Delete screenshot from storage (immediate deletion)
    if (req.screenshot_path) {
      await supabase.storage
        .from('id-badge-verification-screenshots')
        .remove([req.screenshot_path]);
    }

    // TODO: Send notifications to user
    // TODO: Log admin activity

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing decision:', error);
    return NextResponse.json(
      { error: 'Failed to process decision' },
      { status: 500 }
    );
  }
}
