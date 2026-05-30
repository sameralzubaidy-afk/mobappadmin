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

    // Approve review: reset report_count to 0 and ensure is_hidden is false
    const { error: updateError } = await supabase
      .from('reviews')
      .update({ 
        report_count: 0,
        is_hidden: false 
      })
      .eq('id', reviewId);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to approve review', details: updateError },
        { status: 500 }
      );
    }

    // Per manual test guide: "delete all reports"
    const { error: deleteError } = await supabase
      .from('review_reports')
      .delete()
      .eq('review_id', reviewId);

    if (deleteError) {
      console.warn('Failed to delete review_reports for review:', reviewId);
    }

    return NextResponse.json({ success: true, message: 'Review approved successfully' });
  } catch (err) {
    console.error('Error approving review:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
