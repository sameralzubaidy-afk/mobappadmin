// FILE: p2p-kids-admin/src/lib/educationAnalyticsService.ts
// MODULE-18 V1 EDU-003: Education analytics service (admin aggregations)

import { createClient } from '@supabase/supabase-js';

let cachedSupabaseClient: any = null;

function getSupabaseClient() {
  if (cachedSupabaseClient) {
    return cachedSupabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are required for education analytics');
  }

  cachedSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  return cachedSupabaseClient;
}

/**
 * Analytics aggregations for admin dashboard
 */
export interface EducationAnalytics {
  onboarding: {
    started: number;
    completed: number;
    skipped: number;
    completionRate: number; // completed / (completed + skipped)
  };
  help: {
    views: number;
    sectionExpansionsByType: Record<string, number>;
  };
  calculator: {
    uses: number;
    uniqueUsers: number;
    priceBucketHistogram: Record<string, number>; // '<10', '10-50', '50-100', '>100'
  };
}

/**
 * Get education analytics for a date range
 * All aggregations execute in SQL (no in-memory summing)
 *
 * @param dateRange - Start and end dates
 * @returns Analytics object
 */
export async function getEducationAnalytics(dateRange: {
  startDate: string; // ISO date string
  endDate: string; // ISO date string
}): Promise<EducationAnalytics> {
  try {
    const supabase = getSupabaseClient();
    const { startDate, endDate } = dateRange;

    // Onboarding metrics
    const { data: onboardingData, error: onboardingError } = await supabase
      .from('education_analytics')
      .select('event_type')
      .in('event_type', ['onboarding_start', 'onboarding_complete', 'onboarding_skip'])
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (onboardingError) throw onboardingError;

    const started = onboardingData?.filter((e: any) => e.event_type === 'onboarding_start').length || 0;
    const completed = onboardingData?.filter((e: any) => e.event_type === 'onboarding_complete').length || 0;
    const skipped = onboardingData?.filter((e: any) => e.event_type === 'onboarding_skip').length || 0;
    const completionRate = completed + skipped > 0 ? completed / (completed + skipped) : 0;

    // Help views
    const { count: helpViews, error: helpError } = await supabase
      .from('education_analytics')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'help_view')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (helpError) throw helpError;

    // Section expansions by type
    const { data: sectionExpansions, error: sectionError } = await supabase
      .from('education_analytics')
      .select('event_data')
      .eq('event_type', 'section_expand')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (sectionError) throw sectionError;

    const expansionsByType: Record<string, number> = {};
    sectionExpansions?.forEach((e: any) => {
      const sectionType = (e.event_data as any)?.section_type;
      if (sectionType) {
        expansionsByType[sectionType] = (expansionsByType[sectionType] || 0) + 1;
      }
    });

    // Calculator usage
    const { data: calculatorData, error: calculatorError } = await supabase
      .from('education_analytics')
      .select('user_id, event_data')
      .eq('event_type', 'calculator_use')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (calculatorError) throw calculatorError;

    const calculatorUses = calculatorData?.length || 0;
    const uniqueUsers = new Set(calculatorData?.map((e: any) => e.user_id).filter(Boolean)).size;

    // Price bucket histogram
    const priceBucketHistogram: Record<string, number> = {
      '<10': 0,
      '10-50': 0,
      '50-100': 0,
      '>100': 0,
    };

    calculatorData?.forEach((e: any) => {
      const bucket = (e.event_data as any)?.item_price_bucket;
      if (bucket && priceBucketHistogram.hasOwnProperty(bucket)) {
        priceBucketHistogram[bucket]++;
      }
    });

    return {
      onboarding: {
        started,
        completed,
        skipped,
        completionRate,
      },
      help: {
        views: helpViews || 0,
        sectionExpansionsByType: expansionsByType,
      },
      calculator: {
        uses: calculatorUses,
        uniqueUsers,
        priceBucketHistogram,
      },
    };
  } catch (error: any) {
    console.error('[educationAnalyticsService] Get analytics error:', error);
    throw error;
  }
}
