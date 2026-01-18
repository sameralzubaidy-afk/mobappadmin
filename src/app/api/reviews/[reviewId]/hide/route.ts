import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: { reviewId: string } }
) {
  try {
    const { reviewId } = params;

    // Update review to mark as hidden (is_hidden = true)
    const { error: updateError } = await supabase
      .from('reviews')
      .update({ is_hidden: true })
      .eq('id', reviewId);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to hide review', details: updateError },
        { status: 500 }
      );
    }

    // We don't update review_reports here because they don't have an is_hidden column.
    // The review itself being hidden is what matters for the moderation UI and public profiles.

    return NextResponse.json({ success: true, message: 'Review hidden successfully' });
  } catch (err) {
    console.error('Error hiding review:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
