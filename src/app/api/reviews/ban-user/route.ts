/**
 * API Route: Ban User
 * Module: MODULE-08-REVIEWS-RATINGS (TASK REVIEW-007)
 * 
 * Bans a user by updating their profile status to 'banned'
 * and logs the action in audit_logs
 */

import { NextResponse } from 'next/server';

// Ban endpoint removed — feature deprecated.
// Keep a 410 response to avoid client errors from stale UI builds.
export async function POST() {
  return NextResponse.json({ error: 'Ban user endpoint removed' }, { status: 410 });
}
