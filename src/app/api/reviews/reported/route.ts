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
    // Query all reports from review_reports table
    // This approach works whether or not the has_been_reported column exists
    const { data: reports, error: reportsError } = await supabase
      .from('review_reports')
      .select(`
        id,
        review_id,
        reporter_id,
        reason,
        description,
        created_at,
        review:reviews (
          id,
          reviewee_id,
          reviewer_id,
          rating,
          comment,
          is_anonymous,
          is_hidden,
          review_status,
          created_at
        )
      `)
      .order('created_at', { ascending: false });

    if (reportsError) {
      console.error('Supabase error fetching review reports:', reportsError);
      return NextResponse.json(
        { error: 'Failed to fetch review reports', details: reportsError },
        { status: 500 }
      );
    }

    // Collect all user IDs involved (reviewers, reviewees, reporters) for name lookup
    const userIds = new Set<string>();
    (reports || []).forEach((report: any) => {
      if (report.review?.reviewer_id) userIds.add(report.review.reviewer_id);
      if (report.review?.reviewee_id) userIds.add(report.review.reviewee_id);
      if (report.reporter_id) userIds.add(report.reporter_id);
    });

    // Fetch display names + avatars from profiles (profiles.name is the canonical column)
    const nameByUserId: Record<string, string> = {};
    const avatarByUserId: Record<string, string> = {};
    if (userIds.size > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name, avatar_url')
        .in('user_id', Array.from(userIds));

      if (profileError) {
        console.warn('[Review Moderation] profile lookup warning:', profileError);
      } else {
        (profileRows || []).forEach((row: any) => {
          if (typeof row.user_id === 'string') {
            if (typeof row.name === 'string') nameByUserId[row.user_id] = row.name;
            if (typeof row.avatar_url === 'string') avatarByUserId[row.user_id] = row.avatar_url;
          }
        });
      }
    }

    // Group reports by review_id to show each reported review once
    const reviewGroups = new Map<string, any>();

    (reports || []).forEach((report: any) => {
      const reviewId = report.review_id;

      if (!reviewGroups.has(reviewId)) {
        reviewGroups.set(reviewId, {
          id: reviewId,
          review_id: reviewId,
          report_count: 0,
          is_hidden: report.review?.is_hidden || false,
          review_status: report.review?.review_status || 'active',
          created_at: report.review?.created_at || report.created_at,
          review: report.review,
          reports: []
        });
      }

      const group = reviewGroups.get(reviewId);
      group.reports.push({
        id: report.id,
        reporter_id: report.reporter_id,
        reporter_name: nameByUserId[report.reporter_id] || null,
        reason: report.reason,
        description: report.description,
        created_at: report.created_at
      });
    });

    const mappedData = Array.from(reviewGroups.values())
      .map((group) => {
        // report_count reflects the actual number of report rows shown in this queue
        group.report_count = group.reports.length;
        if (group.review) {
          const review = group.review;
          group.review = {
            ...review,
            // TC-Q04: anonymous reviews keep their identity masked, even in the admin queue
            reviewer_name: review.is_anonymous ? 'Anonymous User' : (nameByUserId[review.reviewer_id] || null),
            reviewer_avatar_url: avatarByUserId[review.reviewer_id] || null,
            reviewee_name: nameByUserId[review.reviewee_id] || null,
            reviewee_avatar_url: avatarByUserId[review.reviewee_id] || null
          };
        }
        return group;
      })
      .sort((a, b) => b.report_count - a.report_count);

    return NextResponse.json(mappedData);
  } catch (err) {
    console.error('Error fetching reported reviews:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
