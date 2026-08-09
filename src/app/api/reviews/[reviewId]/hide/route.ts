import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest,
  { params }: { params: { reviewId: string } }) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { reviewId } = params;

    // 1. Capture the distinct reporter ids BEFORE the action so they can be notified.
    const { data: reportRows, error: reportFetchError } = await supabase
      .from('review_reports')
      .select('reporter_id')
      .eq('review_id', reviewId);

    if (reportFetchError) {
      console.warn('Failed to fetch reporters for review:', reviewId, reportFetchError);
    }

    const reporterIds = Array.from(
      new Set((reportRows || []).map((r: any) => r.reporter_id).filter(Boolean))
    );

    // Update review to mark as hidden (is_hidden = true) + moderation status
    const { error: updateError } = await supabase
      .from('reviews')
      .update({
        is_hidden: true,
        review_status: 'hidden',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to hide review', details: updateError },
        { status: 500 }
      );
    }

    // We don't update review_reports here because they don't have an is_hidden column.
    // The review itself being hidden is what matters for the moderation UI and public profiles.

    // 2. Notify each reporter that the review was removed based on their report.
    const notificationResults: { reporter_id: string; success: boolean }[] = [];
    for (const reporterId of reporterIds) {
      const { error: notifError } = await supabase.rpc(
        'create_system_notification_with_preferences',
        {
          p_user_id: reporterId,
          p_type: 'review_report_hidden',
          p_title: 'Review removed',
          p_body:
            'The review you reported has been removed. Thanks for helping keep our community safe.',
          p_data: {
            review_id: reviewId,
            decision: 'hidden',
            type: 'review_moderation',
          },
        }
      );
      notificationResults.push({
        reporter_id: reporterId,
        success: !notifError,
      });
      if (notifError) {
        console.warn('Failed to notify reporter for review:', reviewId, notifError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Review hidden successfully',
      review_status: 'hidden',
      reporters_notified: notificationResults.length,
    });
  } catch (err) {
    console.error('Error hiding review:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
