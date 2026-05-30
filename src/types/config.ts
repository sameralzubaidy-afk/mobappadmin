// filepath: p2p-kids-admin/src/types/config.ts

export interface AdminConfigItem {
  key: string;
  value: string | number | boolean;
  data_type?: string;
  category?: string;
  is_active?: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SMSRateLimitStats {
  totalSentToday: number;
  totalSentThisHour: number;
  uniquePhonesThisHour: number;
  rateLimitedAttempts: number;
}

/** TFV2-001: Strongly typed trade timing config keys for admin UI. */
export interface TradeTimingConfig {
  offer_timeout_hours: number;
  offer_notif_1_hours_before: number;
  offer_notif_2_hours_before: number;
  auto_complete_hours: number;
  auto_complete_notif_hours_before: number;
  pending_sp_release_days: number;
  transaction_fee_member_cents: number;
  transaction_fee_non_member_cents: number;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}
