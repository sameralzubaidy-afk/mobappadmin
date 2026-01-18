import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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
          report_count,
          is_hidden,
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

    // Group reports by review_id to show each reported review once
    const reviewGroups = new Map<string, any>();

    (reports || []).forEach((report: any) => {
      const reviewId = report.review_id;
      
      if (!reviewGroups.has(reviewId)) {
        reviewGroups.set(reviewId, {
          id: reviewId,
          review_id: reviewId,
          report_count: report.review?.report_count || 0,
          is_hidden: report.review?.is_hidden || false,
          created_at: report.review?.created_at || report.created_at,
          review: report.review,
          reports: []
        });
      }
      
      const group = reviewGroups.get(reviewId);
      group.reports.push({
        id: report.id,
        reporter_id: report.reporter_id,
        reason: report.reason,
        description: report.description,
        created_at: report.created_at
      });
    });

    const mappedData = Array.from(reviewGroups.values())
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
