// File: p2p-kids-admin/src/app/api/admin/id-badges/stats/route.ts
// TASK BADGE-010: Admin ID Badge Stats API

import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get counts by status
    const { data: requests } = await supabase
      .from('id_badge_verification_requests')
      .select('status, submitted_at, reviewed_at');

    const pending = requests?.filter((r) => r.status === 'pending').length || 0;
    const approved = requests?.filter((r) => r.status === 'approved').length || 0;
    const rejected = requests?.filter((r) => r.status === 'rejected').length || 0;

    // Calculate avg review time for decided requests
    const decidedRequests = requests?.filter((r) => r.reviewed_at) || [];
    let avgReviewTimeHours = 0;
    if (decidedRequests.length > 0) {
      const totalHours = decidedRequests.reduce((sum, req) => {
        const submitted = new Date(req.submitted_at);
        const reviewed = new Date(req.reviewed_at!);
        const hours = (reviewed.getTime() - submitted.getTime()) / (1000 * 60 * 60);
        return sum + hours;
      }, 0);
      avgReviewTimeHours = totalHours / decidedRequests.length;
    }

    const approvalRate =
      approved + rejected > 0 ? (approved / (approved + rejected)) * 100 : 0;

    return NextResponse.json({
      pending_count: pending,
      approved_count: approved,
      rejected_count: rejected,
      avg_review_time_hours: avgReviewTimeHours,
      approval_rate: approvalRate,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
