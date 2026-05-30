// File: p2p-kids-admin/src/app/api/admin/id-badges/[requestId]/decide/route.ts
// TASK BADGE-010: Admin decision endpoint (approve/reject)

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest,
  { params }: { params: { requestId: string } }) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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

    const adminUserId = request.headers.get('x-admin-user-id') || null;

    // Update request with decision
    const updateData: any = {
      status: decision === 'approve' ? 'approved' : 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
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

    // Trigger user notification (Edge Function)
    try {
      console.log(`[ADMIN-DECISION] Triggering notification for ${req.user_id}`);
      const notificationRes = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/id-badge-notifications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
          },
          body: JSON.stringify({
            type: decision === 'approve' ? 'id_badge_approved' : 'id_badge_rejected',
            userId: req.user_id,
            requestId: params.requestId,
            rejectionReason: rejection_reason,
            adminNotes: decision === 'approve' ? approval_notes : rejection_notes,
          }),
        }
      );

      if (!notificationRes.ok) {
        throw new Error(`Notification function error: ${notificationRes.status}`);
      }
      console.log('[ADMIN-DECISION] Notification triggered successfully');
    } catch (notifErr) {
      console.error('[ADMIN-DECISION] Notification failure (non-blocking):', notifErr);
    }

    // Log admin activity
    if (adminUserId) {
      try {
        await supabase.from('admin_activity_log').insert({
          admin_id: adminUserId,
          action_type: decision === 'approve' ? 'id_badge_approved' : 'id_badge_rejected',
          entity_type: 'id_badge_verification',
          entity_id: params.requestId,
          details: {
            decision,
            rejection_reason: decision === 'reject' ? rejection_reason : null,
            notes: decision === 'approve' ? approval_notes : rejection_notes,
          },
        });
      } catch (logErr) {
        console.error('[ADMIN-DECISION] Activity log failure:', logErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing decision:', error);
    return NextResponse.json(
      { error: 'Failed to process decision' },
      { status: 500 }
    );
  }
}
