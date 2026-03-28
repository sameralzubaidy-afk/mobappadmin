// API Route: Revenue Analytics
// filepath: p2p-kids-admin/src/app/api/admin/analytics/revenue/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { RevenueAnalyticsService } from '@/lib/revenueAnalytics';
import { createClient } from '../../../../../lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;
    
    // Get authenticated admin user
    const { data: { user }, error: authError } = bearerToken
      ? await supabase.auth.getUser(bearerToken)
      : await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date') 
      ? new Date(searchParams.get('start_date')!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const endDate = searchParams.get('end_date')
      ? new Date(searchParams.get('end_date')!)
      : new Date();
    const includeTimeSeries = searchParams.get('include_time_series') === 'true';
    const interval = (searchParams.get('interval') || 'day') as 'day' | 'week' | 'month';

    // Fetch metrics in parallel
    const [revenueMetrics, engagementMetrics, timeSeries] = await Promise.all([
      RevenueAnalyticsService.getRevenueMetrics(user.id, startDate, endDate),
      RevenueAnalyticsService.getEngagementMetrics(user.id, endDate),
      includeTimeSeries 
        ? RevenueAnalyticsService.getRevenueTimeSeries(user.id, startDate, endDate, interval)
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        revenue: revenueMetrics,
        engagement: engagementMetrics,
        timeSeries: includeTimeSeries ? timeSeries : undefined,
      },
    });
  } catch (error: any) {
    console.error('[API /admin/analytics/revenue] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to fetch analytics' 
      },
      { status: 500 }
    );
  }
}
