import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// MODULE-08 REVIEW-007: Admin "Keep" action for a reported review.
// - Marks the review review_status 'pending_review' → 'reviewed'
// - Keeps the review visible (is_hidden = false)
// - Resets report_count to 0 and deletes the reports (the report is REJECTED)
// - Notifies every reporter (in-app + push) that the review was kept
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

    // 1. Capture the distinct reporter ids BEFORE deleting the reports,
    //    so they can be notified of the decision.
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

    // 2. Keep the review: reviewed + visible, reset report count
    const { error: updateError } = await supabase
      .from('reviews')
      .update({
        review_status: 'reviewed',
        report_count: 0,
        is_hidden: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to keep review', details: updateError },
        { status: 500 }
      );
    }

    // 3. Delete all reports for this review (report rejected)
    const { error: deleteError } = await supabase
      .from('review_reports')
      .delete()
      .eq('review_id', reviewId);

    if (deleteError) {
      console.warn('Failed to delete review_reports for review:', reviewId);
    }

    // 4. Notify each reporter that their report was reviewed and the review was kept.
    const notificationResults: { reporter_id: string; success: boolean }[] = [];
    for (const reporterId of reporterIds) {
      const { error: notifError } = await supabase.rpc(
        'create_system_notification_with_preferences',
        {
          p_user_id: reporterId,
          p_type: 'review_report_kept',
          p_title: 'Report reviewed',
          p_body:
            'We reviewed your report about a review. After checking it, the review stays up because it follows our guidelines.',
          p_data: {
            review_id: reviewId,
            decision: 'kept',
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
      message: 'Review kept successfully',
      review_status: 'reviewed',
      reporters_notified: notificationResults.length,
    });
  } catch (err) {
    console.error('Error keeping review:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
