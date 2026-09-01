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
  auto_complete_notif_1_hours_before: number;
  auto_complete_notif_2_hours_before: number;
  pending_sp_release_days: number;
  transaction_fee_subscriber_cents: number;
  transaction_fee_non_subscriber_cents: number;
  max_pending_offers_per_seller: number;
  // N1 Configurability: pickup countdown window (hours) — tunable via
  // admin_config.pickup_window_hours. Shared dependency for pickup-deadline requirements.
  pickup_window_hours: number;
  // R2 (2026-08-10): pickup-window reminder thresholds (hours before the pickup/auto-complete
  // deadline) — admin_config.pickup_notif_1/2_hours_before. Buyer-only reminders.
  pickup_notif_1_hours_before: number;
  pickup_notif_2_hours_before: number;
  // N1 Configurability: payout buffer (days) — tunable via
  // admin_config.payout_buffer_days. Shared dependency for payout-release requirements.
  payout_buffer_days: number;
  // Fee params consolidated from /config → FEES so Trade Timing is the single
  // fee-management surface. Buyer platform fee (fixed cents) + (% of item price).
  platform_fee_buyer_fixed_cents: number;
  platform_fee_buyer_percentage: number;
  // Bundle fee behavior toggle (boolean; read by create-trade-offer).
  charge_one_fee_per_bundle: boolean;
  // Buyer Cancel Request & Admin Escalation (2026-09-01) — surfaced on the
  // Trade Timing settings page (Group N). Backend readers: the
  // fn_cancel_request_* SECURITY DEFINER helpers; both keys are seeded in
  // admin_config by 20260901000000_cancel_request_flow.sql.
  cancel_request_escalation_enabled: boolean;
  cancel_request_response_timeout_hours: number;
  // R1 — Tiered Buyer-Fee Engine (first-trade protection). All values are dynamic
  // from admin_config (fees category) and resolved at checkout by
  // fn_get_buyer_fee_for_checkout. Tiers:
  //   active member (trial/paid)                -> buyer_fee_active_member_cents (flat)
  //   free + 0 completed trades                 -> buyer_fee_first_trade_cents (flat, first-trade protection)
  //   free + 1+ completed trades                -> % of cash portion + fixed, capped
  buyer_fee_active_member_cents: number;
  buyer_fee_first_trade_cents: number;
  buyer_fee_subsequent_percentage: number;
  buyer_fee_subsequent_fixed_cents: number;
  buyer_fee_subsequent_max_cents: number;
  buyer_fee_label: string;
  // B2: Seller fee per subscription tier — ABSOLUTE % of the cash portion (item price − SP).
  //   platform_fee_seller_percentage                          = % for FREE (non-subscriber) sellers
  //   platform_fee_seller_discount_percentage_kids_club_plus  = % for Kids Club+ (subscriber) sellers
  // (key name keeps legacy "discount" wording; the value is the rate itself, not a discount)
  platform_fee_seller_percentage: number;
  platform_fee_seller_discount_percentage_kids_club_plus: number;
  // LEGACY fee keys (single-source consolidation 2026-08-09): seeded under the
  // old naming scheme; surfaced on Trade Timing for audit only. The current
  // checkout does NOT read them:
  //   - transaction_fee_member_cents / transaction_fee_non_member_cents — replaced
  //     by transaction_fee_subscriber_cents / transaction_fee_non_subscriber_cents
  //   - platform_fee_seller_discount_percentage_freemium — replaced by the
  //     absolute-per-tier platform_fee_seller_percentage (BP-38)
  transaction_fee_member_cents: number;
  transaction_fee_non_member_cents: number;
  platform_fee_seller_discount_percentage_freemium: number;
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
