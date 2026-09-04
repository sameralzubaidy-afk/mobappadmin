// FILE: p2p-kids-admin/src/lib/spConfigCategoryService.ts
// ADMIN-V3-003: SP Config service for category-specific SP calculations & analytics
// Module: MODULE-12-ADMIN-V3-CATEGORIES

import { createClient } from '@supabase/supabase-js';
import type {
  Category,
  CategorySPPreview,
  CategorySPAnalytics,
  AnomalyFlag,
} from '../types/category';
import { SPRateOutOfRangeError } from '../types/errors';

const SP_EARNING_MIN = 1.05;
const SP_EARNING_MAX = 1.40;
const SP_SPENDING_CAP_MIN = 50;
const SP_SPENDING_CAP_MAX = 80;

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const isServer = typeof window === 'undefined';

  if (isServer && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, anonKey);
}

/**
 * Calculate SP earn/spend for a specific category and price
 * Used for: price suggestion cards, checkout UI, analytics preview
 * RULE: earn_sp = Math.round, max_spend_sp = Math.floor
 */
export function calculateCategorySP(
  categoryId: string,
  price: number,
  spEarningMultiplier: number,
  spSpendingCapPercent: number
): CategorySPPreview {
  return {
    price,
    earn_sp: Math.round(price * spEarningMultiplier),
    max_spend_sp: Math.floor((price * spSpendingCapPercent) / 100),
    spend_percent: spSpendingCapPercent,
  };
}

/**
 * Get bonus categories (sp_earning_multiplier > 1.10 AND is_active = true)
 * Ordered by multiplier DESC
 */
export async function getBonusCategories(): Promise<Category[]> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .gt('sp_earning_multiplier', 1.10)
    .order('sp_earning_multiplier', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch bonus categories: ${error.message}`);
  }

  return data || [];
}

/**
 * Update category SP rates and optionally trigger notification
 * @param categoryId - Category ID
 * @param earningMultiplier - New earning multiplier (1.05–1.40)
 * @param spendingCapPercent - New spending cap % (50–80)
 * @param notifyUsers - If true, enqueue banner notification (MODULE-14)
 * @param configNotes - Optional strategy notes (max 500 chars)
 * @throws SPRateOutOfRangeError if rates outside bounds
 */
export async function updateCategorySPRates(
  categoryId: string,
  earningMultiplier: number,
  spendingCapPercent: number,
  notifyUsers: boolean,
  configNotes?: string | null
): Promise<void> {
  // Validate ranges
  if (earningMultiplier < SP_EARNING_MIN || earningMultiplier > SP_EARNING_MAX) {
    throw new SPRateOutOfRangeError(
      'sp_earning_multiplier',
      earningMultiplier,
      SP_EARNING_MIN,
      SP_EARNING_MAX
    );
  }

  if (spendingCapPercent < SP_SPENDING_CAP_MIN || spendingCapPercent > SP_SPENDING_CAP_MAX) {
    throw new SPRateOutOfRangeError(
      'sp_spending_cap_percent',
      spendingCapPercent,
      SP_SPENDING_CAP_MIN,
      SP_SPENDING_CAP_MAX
    );
  }

  const supabase = getAdminClient();

  // Fetch category for notification banner copy
  const { data: category, error: fetchError } = await supabase
    .from('categories')
    .select('id, name')
    .eq('id', categoryId)
    .single();

  if (fetchError || !category) {
    throw new Error(`Category not found: ${fetchError?.message || 'Not found'}`);
  }

  // Update category
  const { error: updateError } = await supabase
    .from('categories')
    .update({
      sp_earning_multiplier: earningMultiplier,
      sp_spending_cap_percent: spendingCapPercent,
      sp_config_notes: configNotes ?? null,
      sp_rate_change_notify: notifyUsers, // Set flag for one-shot notification
      updated_at: new Date().toISOString(),
    })
    .eq('id', categoryId);

  if (updateError) {
    throw new Error(`Failed to update SP rates: ${updateError.message}`);
  }

  // If notifyUsers=true, enqueue banner notification via MODULE-14
  if (notifyUsers) {
    try {
      // TODO: Wire to MODULE-14 NotificationService.enqueueBanner
      // For now, log intent
      console.log(
        `[updateCategorySPRates] Notification banner requested for category "${category.name}" (multiplier: ${earningMultiplier})`
      );

      // Example payload for MODULE-14:
      // await NotificationService.enqueueBanner({
      //   title: `${category.name} now earns bonus SP!`,
      //   message: `Items in ${category.name} earn more Swap Points. List yours now!`,
      //   type: 'info',
      //   category: 'sp_rate_change',
      // });

      // Reset the notification flag
      await supabase
        .from('categories')
        .update({ sp_rate_change_notify: false })
        .eq('id', categoryId);
    } catch (notifyError: any) {
      console.error('[updateCategorySPRates] Banner notification failed:', notifyError.message);
      // Non-blocking: SP rates updated successfully, notification failed
    }
  }
}

/**
 * Get SP analytics per category for a given date range
 * @param dateRange - { start: ISO date, end: ISO date }
 * @returns Array of CategorySPAnalytics with velocity, gap, cash flow, anomaly flags
 */
export async function getSPAnalyticsByCategory(dateRange: {
  start: string;
  end: string;
}): Promise<CategorySPAnalytics[]> {
  const supabase = getAdminClient();

  const normalizeRow = (row: any): CategorySPAnalytics => {
    const velocity = Number(row.velocity || 0);
    const gapPercent = Number(row.gap_percent || 0);
    const anomalyFlags: AnomalyFlag[] = Array.isArray(row.anomaly_flags)
      ? [...row.anomaly_flags]
      : [];

    if (gapPercent > 10 && !anomalyFlags.includes('hoarding')) {
      anomalyFlags.push('hoarding');
    }
    if (velocity < 0.5 && !anomalyFlags.includes('low_velocity')) {
      anomalyFlags.push('low_velocity');
    }
    if (velocity > 2 && !anomalyFlags.includes('spending_spike')) {
      anomalyFlags.push('spending_spike');
    }

    return {
      category_id: row.category_id,
      category_name: row.category_name,
      velocity,
      gap_percent: gapPercent,
      avg_cash_per_trade: Number(row.avg_cash_per_trade || 0),
      anomaly_flags: anomalyFlags,
    };
  };

  // DEV-TASK-109: read real per-category analytics from the SECURITY DEFINER
  // RPC get_category_sp_analytics(p_start, p_end), which aggregates REAL
  // completed trades within the requested window. (The old `category_sp_analytics`
  // table never existed — L02 FAIL "…in the schema cache".)
  try {
    const { data, error } = await supabase.rpc('get_category_sp_analytics', {
      p_start: dateRange.start,
      p_end: dateRange.end,
    });

    if (error) {
      throw new Error(error.message);
    }

    return ((data || []) as any[])
      .map(normalizeRow)
      .sort((a, b) => b.gap_percent - a.gap_percent);
  } catch (error: any) {
    const message = error?.message || '';
    // RPC absent (migration not applied yet) → fall back to the approximation
    // below. Matchers are broad so a pre-migration DB degrades instead of erroring.
    const shouldFallback =
      message.includes('does not exist') ||
      message.includes('schema cache') ||
      message.includes('not found') ||
      message.includes('is not a function');

    if (!shouldFallback) {
      throw error;
    }
  }

  // Aggregate points_transactions + items sold in date range
  // This is a simplified version — production should use a materialized view if slow
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('id, name')
    .eq('is_active', true);

  if (catError) {
    throw new Error(`Failed to fetch categories: ${catError.message}`);
  }

  const analytics: CategorySPAnalytics[] = [];

  for (const category of categories || []) {
    // 1. Get items in this category sold in date range
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('id, price')
      .eq('category_id', category.id)
      .eq('status', 'sold')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);

    if (itemsError) {
      console.error(`[getSPAnalyticsByCategory] Error fetching items for ${category.name}:`, itemsError);
      continue;
    }

    if (!items || items.length === 0) {
      // No data for this category in range
      continue;
    }

    // 2. Aggregate SP earned (seller) and spent (buyer) from points_transactions
    // Simplified: assume we have a points_transactions table with category_id FK
    // In reality, you'd join through items → transactions → points_transactions
    // For MVP, we'll calculate based on item prices and current category rates

    const { data: catData } = await supabase
      .from('categories')
      .select('sp_earning_multiplier, sp_spending_cap_percent')
      .eq('id', category.id)
      .single();

    if (!catData) continue;

    const totalEarnedSP = items.reduce((sum, item) => {
      return sum + Math.round(item.price * catData.sp_earning_multiplier);
    }, 0);

    // Spent SP: assume average 50% of max allowed (placeholder)
    const totalSpentSP = items.reduce((sum, item) => {
      const maxSpend = Math.floor((item.price * catData.sp_spending_cap_percent) / 100);
      return sum + maxSpend * 0.5; // Assume 50% utilization
    }, 0);

    // Calculate metrics
    const velocity = totalEarnedSP > 0 ? totalSpentSP / totalEarnedSP : 0;
    const gapPercent = totalEarnedSP > 0 ? ((totalEarnedSP - totalSpentSP) / totalEarnedSP) * 100 : 0;
    const avgCashPerTrade =
      items.reduce((sum, item) => sum + item.price, 0) / items.length;

    // Anomaly detection
    const anomalyFlags: AnomalyFlag[] = [];
    if (gapPercent > 10) anomalyFlags.push('hoarding');
    if (velocity < 0.5) anomalyFlags.push('low_velocity');
    if (velocity > 2) anomalyFlags.push('spending_spike');

    analytics.push(
      normalizeRow({
        category_id: category.id,
        category_name: category.name,
        velocity,
        gap_percent: gapPercent,
        avg_cash_per_trade: avgCashPerTrade,
        anomaly_flags: anomalyFlags,
      })
    );
  }

  return analytics.sort((a, b) => b.gap_percent - a.gap_percent);
}
