/**
 * API Route: Ban User
 * Module: MODULE-08-REVIEWS-RATINGS (TASK REVIEW-007)
 * 
 * Bans a user by updating their profile status to 'banned'
 * and logs the action in audit_logs
 */

import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';

// Ban endpoint removed — feature deprecated.
// Keep a 410 response to avoid client errors from stale UI builds.
export async function POST(req: Request) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return NextResponse.json({ error: 'Ban user endpoint removed' }, { status: 410 });
}
