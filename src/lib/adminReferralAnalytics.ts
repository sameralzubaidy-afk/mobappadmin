// Admin Referral Analytics Service
// filepath: p2p-kids-admin/src/lib/adminReferralAnalytics.ts

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);

export interface ReferralMetrics {
  total_users: number;
  users_with_referrals: number;
  total_referrals: number;
  pending_referrals: number;
  completed_referrals: number;
  k_factor: number;
  signup_to_trade_rate: number;
  total_sp_distributed: number;
}

export interface TopReferrer {
  user_id: string;
  email: string;
  total_referrals: number;
  completed_referrals: number;
  total_sp_earned: number;
  trial_extensions_earned: number;
}

export interface ReferralFunnel {
  invites_sent: number;
  signups: number;
  first_trades: number;
  rewards_granted: number;
  signup_rate: number;
  trade_rate: number;
  reward_rate: number;
}

export class AdminReferralAnalyticsService {
  /**
   * Get referral program metrics
   */
  static async getMetrics(): Promise<ReferralMetrics> {
    const { data, error } = await adminClient.rpc('get_referral_metrics');

    if (error) {
      console.error('[AdminReferralAnalytics] Failed to get metrics:', error);
      throw new Error(`Failed to get referral metrics: ${error.message}`);
    }

    return data as ReferralMetrics;
  }

  /**
   * Get top referrers leaderboard
   */
  static async getTopReferrers(limit: number = 10): Promise<TopReferrer[]> {
    const { data, error } = await adminClient.rpc('get_top_referrers', {
      p_limit: limit,
    });

    if (error) {
      console.error('[AdminReferralAnalytics] Failed to get top referrers:', error);
      throw new Error(`Failed to get top referrers: ${error.message}`);
    }

    return (data || []) as TopReferrer[];
  }

  /**
   * Get referral conversion funnel
   */
  static async getFunnel(): Promise<ReferralFunnel> {
    const { data, error } = await adminClient.rpc('get_referral_funnel');

    if (error) {
      console.error('[AdminReferralAnalytics] Failed to get funnel:', error);
      throw new Error(`Failed to get referral funnel: ${error.message}`);
    }

    return data as ReferralFunnel;
  }
}
