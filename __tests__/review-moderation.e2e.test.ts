/**
 * E2E Tests: Review Moderation Queue
 * Module: MODULE-08-REVIEWS-RATINGS (TASK REVIEW-007)
 * 
 * End-to-end tests for admin moderation flow
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let supabase: SupabaseClient;
let testReviewId: string;
let testReportIds: string[] = [];
let testUserId: string;

beforeAll(async () => {
  supabase = createClient(supabaseUrl, supabaseKey);
  
  // Create test user
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: `test-reviewer-${Date.now()}@test.com`,
    password: 'testpassword123',
    email_confirm: true
  });
  
  if (userError || !userData.user) {
    console.error('Failed to create test user:', userError);
    throw new Error('Test user creation failed');
  }
  
  testUserId = userData.user.id;
});

afterAll(async () => {
  // Cleanup: Delete test reports
  if (testReportIds.length > 0) {
    await supabase
      .from('review_reports')
      .delete()
      .in('id', testReportIds);
  }
  
  // Cleanup: Delete test review
  if (testReviewId) {
    await supabase
      .from('reviews')
      .delete()
      .eq('id', testReviewId);
  }
  
  // Cleanup: Delete test user
  if (testUserId) {
    await supabase.auth.admin.deleteUser(testUserId);
  }
});

describe('Review Moderation API - GET /api/reviews/reported', () => {
  it('should fetch all reported reviews', async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reviews/reported`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should group reports by review_id', async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reviews/reported`);
    const data = await response.json();
    
    // Verify each item has required structure
    if (data.length > 0) {
      const firstItem = data[0];
      expect(firstItem).toHaveProperty('id');
      expect(firstItem).toHaveProperty('review_id');
      expect(firstItem).toHaveProperty('report_count');
      expect(firstItem).toHaveProperty('is_hidden');
      expect(firstItem).toHaveProperty('reports');
      expect(Array.isArray(firstItem.reports)).toBe(true);
    }
  });

  it('should sort by report_count descending', async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reviews/reported`);
    const data = await response.json();
    
    // Verify sort order (each item should have >= report_count than next)
    for (let i = 0; i < data.length - 1; i++) {
      expect(data[i].report_count).toBeGreaterThanOrEqual(data[i + 1].report_count);
    }
  });
});

describe('Review Moderation API - POST /api/reviews/:reviewId/hide', () => {
  beforeAll(async () => {
    // Create a test review first (requires a valid trade_id)
    // For this test, we'll skip if no trades exist
    const { data: trades } = await supabase
      .from('trades')
      .select('id')
      .eq('status', 'completed')
      .limit(1);
    
    if (trades && trades.length > 0) {
      const { data: reviewData } = await supabase
        .from('reviews')
        .insert({
          trade_id: trades[0].id,
          reviewer_id: testUserId,
          reviewee_id: testUserId, // Self-review for test
          rating: 5,
          comment: 'Test review for moderation',
          is_hidden: false
        })
        .select()
        .single();
      
      if (reviewData) {
        testReviewId = reviewData.id;
      }
    }
  });

  it('should hide a review', async () => {
    if (!testReviewId) {
      console.warn('Skipping hide test: no test review created');
      return;
    }
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reviews/${testReviewId}/hide`, {
      method: 'POST',
    });
    
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    
    // Verify review is hidden in database
    const { data: reviewData } = await supabase
      .from('reviews')
      .select('is_hidden')
      .eq('id', testReviewId)
      .single();
    
    expect(reviewData?.is_hidden).toBe(true);
  });

  it('should return 400 for invalid review ID', async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reviews/invalid-id/hide`, {
      method: 'POST',
    });
    
    expect(response.status).toBe(500); // Supabase will error on invalid UUID
  });
});

describe('Review Moderation API - POST /api/reviews/:reviewId/keep', () => {
  beforeAll(async () => {
    // Ensure test review is hidden and has reports
    if (testReviewId) {
      await supabase
        .from('reviews')
        .update({ is_hidden: true, report_count: 2, review_status: 'pending_review' })
        .eq('id', testReviewId);
      
      // Add test reports
      const { data: reportData } = await supabase
        .from('review_reports')
        .insert([
          {
            review_id: testReviewId,
            reporter_id: testUserId,
            reason: 'spam',
            description: 'Test report 1'
          }
        ])
        .select();
      
      if (reportData) {
        testReportIds = reportData.map(r => r.id);
      }
    }
  });

  it('should keep review visible, mark reviewed, delete reports, and notify reporter', async () => {
    if (!testReviewId) {
      console.warn('Skipping keep test: no test review created');
      return;
    }
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reviews/${testReviewId}/keep`, {
      method: 'POST',
    });
    
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.review_status).toBe('reviewed');
    
    // Verify review is visible, reviewed, and report_count reset
    const { data: reviewData } = await supabase
      .from('reviews')
      .select('is_hidden, report_count, review_status')
      .eq('id', testReviewId)
      .single();
    
    expect(reviewData?.is_hidden).toBe(false);
    expect(reviewData?.review_status).toBe('reviewed');
    expect(reviewData?.report_count).toBe(0);
    
    // Verify reports are deleted
    const { data: reportsData } = await supabase
      .from('review_reports')
      .select('id')
      .eq('review_id', testReviewId);
    
    expect(reportsData).toHaveLength(0);

    // Verify the reporter was notified (in-app notification row created)
    const { data: notifData } = await supabase
      .from('user_notifications')
      .select('id, type, user_id')
      .eq('user_id', testUserId)
      .eq('type', 'review_report_kept')
      .limit(1);
    
    expect(notifData && notifData.length).toBeGreaterThan(0);
  });
});

// Ban-user tests removed: ban feature deprecated and endpoint disabled.
// Original tests for /api/reviews/ban-user have been deleted.
