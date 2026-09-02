// filepath: p2p-kids-admin/src/lib/tradeTimingValidation.ts
// TFV2-001: Shared validation for the Trade Timing settings page.
//
// Single source of truth for trade-timing settings validation. Imported by BOTH:
//   - src/app/settings/trade-timing/page.tsx        (validateSettings on Save)
//   - src/app/settings/trade-timing/__tests__/trade-timing-settings.test.ts
//     (the mirror test — Dev Task 91: the page drifted behind its own spec, so
//      the validator now lives here so page and test can never diverge again).
//
// The set of validated keys mirrors the fields the page renders. Fields that
// the page manages but that have no cross-field rule (max_pending_offers,
// cancel-request escalation toggle, charge-one-fee toggle, R1 tiered-buyer-fee
// ranges, legacy audit keys) are validated page-side where they render, not in
// the shared core (the mirror test covers the core timing + fee + guardrail
// rules only).

/**
 * The fields the shared validator checks. Structural subset of
 * `TradeTimingConfig` (types/config.ts) — extra fields on the page's settings
 * object are allowed when calling.
 */
export interface TradeTimingConfigValidation {
  offer_timeout_hours: number;
  offer_notif_1_hours_before: number;
  offer_notif_2_hours_before: number;
  auto_complete_hours: number;
  auto_complete_notif_1_hours_before: number;
  auto_complete_notif_2_hours_before: number;
  pending_sp_release_days: number;
  transaction_fee_subscriber_cents: number;
  transaction_fee_non_subscriber_cents: number;
  platform_fee_seller_percentage: number;
  platform_fee_seller_discount_percentage_kids_club_plus: number;
  pickup_window_hours: number;
  pickup_notif_1_hours_before: number;
  pickup_notif_2_hours_before: number;
  payout_buffer_days: number;
  platform_fee_buyer_fixed_cents: number;
  platform_fee_buyer_percentage: number;
  charge_one_fee_per_bundle: boolean;
  cancel_request_escalation_enabled: boolean;
  cancel_request_response_timeout_hours: number;
}

/**
 * Pure validation for trade-timing settings. Returns a record of field errors
 * (empty = valid). Canonical source: trade-timing-settings.test.ts (the mirror
 * test's original self-contained copy was lifted verbatim here so the page and
 * the test exercise the SAME function — this is the fix for the F06 R2
 * guardrail drift, Dev Task 91).
 */
export function validateTradeTimingSettings(
  s: TradeTimingConfigValidation
): Record<string, string> {
  const e: Record<string, string> = {};

  if (s.offer_timeout_hours < 1) {
    e.offer_timeout_hours = 'Must be at least 1 hour';
  }
  if (s.offer_notif_1_hours_before >= s.offer_timeout_hours) {
    e.offer_notif_1_hours_before = `Must be less than offer timeout (${s.offer_timeout_hours}h)`;
  }
  if (s.offer_notif_2_hours_before >= s.offer_notif_1_hours_before) {
    e.offer_notif_2_hours_before = `Must be less than first reminder (${s.offer_notif_1_hours_before}h)`;
  }
  if (s.offer_notif_2_hours_before < 1) {
    e.offer_notif_2_hours_before = 'Must be at least 1 hour';
  }
  if (s.auto_complete_hours < 1) {
    e.auto_complete_hours = 'Must be at least 1 hour';
  }
  if (s.auto_complete_notif_1_hours_before < 1) {
    e.auto_complete_notif_1_hours_before = 'Must be at least 1 hour';
  }
  if (s.auto_complete_notif_1_hours_before >= s.auto_complete_hours) {
    e.auto_complete_notif_1_hours_before = `Must be less than auto-complete window (${s.auto_complete_hours}h)`;
  }
  if (s.auto_complete_notif_2_hours_before < 1) {
    e.auto_complete_notif_2_hours_before = 'Must be at least 1 hour';
  }
  if (s.auto_complete_notif_2_hours_before >= s.auto_complete_notif_1_hours_before) {
    e.auto_complete_notif_2_hours_before = `Must be less than first auto-complete reminder (${s.auto_complete_notif_1_hours_before}h)`;
  }
  if (s.pending_sp_release_days < 1) {
    e.pending_sp_release_days = 'Must be at least 1 day';
  }
  if (s.transaction_fee_subscriber_cents < 0) {
    e.transaction_fee_subscriber_cents = 'Cannot be negative';
  }
  if (s.transaction_fee_non_subscriber_cents < 0) {
    e.transaction_fee_non_subscriber_cents = 'Cannot be negative';
  }
  if (s.platform_fee_seller_percentage < 0 || s.platform_fee_seller_percentage > 100) {
    e.platform_fee_seller_percentage = 'Must be between 0 and 100';
  }
  if (
    s.platform_fee_seller_discount_percentage_kids_club_plus < 0 ||
    s.platform_fee_seller_discount_percentage_kids_club_plus > 100
  ) {
    e.platform_fee_seller_discount_percentage_kids_club_plus = 'Must be between 0 and 100';
  }
  // N1 Configurability — pickup countdown + payout buffer ranges.
  if (s.pickup_window_hours < 1) {
    e.pickup_window_hours = 'Must be at least 1 hour';
  }
  if (s.pickup_window_hours > 168) {
    e.pickup_window_hours = 'Maximum is 168 hours (7 days)';
  }
  // R2 pickup reminders — must be ordered and inside the pickup window.
  if (s.pickup_notif_1_hours_before < 1) {
    e.pickup_notif_1_hours_before = 'Must be at least 1 hour';
  }
  if (s.pickup_notif_1_hours_before >= s.pickup_window_hours) {
    e.pickup_notif_1_hours_before = `Must be less than pickup window (${s.pickup_window_hours}h)`;
  }
  if (s.pickup_notif_2_hours_before < 1) {
    e.pickup_notif_2_hours_before = 'Must be at least 1 hour';
  }
  if (s.pickup_notif_2_hours_before >= s.pickup_notif_1_hours_before) {
    e.pickup_notif_2_hours_before = `Must be less than first pickup reminder (${s.pickup_notif_1_hours_before}h)`;
  }
  // R2 (2026-08-10): 7-day Stripe authorization guardrail — HARD BLOCK.
  // Offer + pickup windows must total under 168h so capture always precedes the
  // 7-day authorization expiry. Mirrors fn_validate_trade_timing_config.
  if (s.offer_timeout_hours + s.pickup_window_hours > 167) {
    const total = s.offer_timeout_hours + s.pickup_window_hours;
    const msg = `Offer + pickup (${total}h) must stay under 168h (Stripe's 7-day authorization limit). Lower one window.`;
    e.offer_timeout_hours = msg;
    e.pickup_window_hours = msg;
  }
  if (s.payout_buffer_days < 0) {
    e.payout_buffer_days = 'Cannot be negative';
  }
  if (s.payout_buffer_days > 30) {
    e.payout_buffer_days = 'Maximum is 30 days';
  }
  if (s.platform_fee_buyer_fixed_cents < 0) {
    e.platform_fee_buyer_fixed_cents = 'Cannot be negative';
  }
  if (s.platform_fee_buyer_percentage < 0 || s.platform_fee_buyer_percentage > 100) {
    e.platform_fee_buyer_percentage = 'Must be between 0 and 100';
  }
  // Buyer Cancel Request (2026-09-01) — timeout validated to the same 1–336
  // range the backend enforces in fn_cancel_request_timeout_hours().
  if (
    s.cancel_request_response_timeout_hours < 1 ||
    s.cancel_request_response_timeout_hours > 336
  ) {
    e.cancel_request_response_timeout_hours = 'Must be between 1 and 336 hours';
  }

  return e;
}
