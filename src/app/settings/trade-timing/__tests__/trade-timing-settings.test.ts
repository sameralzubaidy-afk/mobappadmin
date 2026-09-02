// filepath: p2p-kids-admin/src/app/settings/trade-timing/__tests__/trade-timing-settings.test.ts
// TFV2-001: Admin trade timing settings page unit tests

/**
 * NOTE: This test file validates the SHARED validation function that the page
 * itself uses — src/lib/tradeTimingValidation.ts. The page's validateSettings()
 * calls this same function, so the test can never drift from the page again
 * (Dev Task 91: the page had drifted behind its own mirror, keeping a stale
 * copy of the R2 168h guardrail only here).
 */

import {
  validateTradeTimingSettings,
  type TradeTimingConfigValidation as TradeTimingConfig,
} from '@/lib/tradeTimingValidation';

const DEFAULT_VALID: TradeTimingConfig = {
  offer_timeout_hours: 48,
  offer_notif_1_hours_before: 24,
  offer_notif_2_hours_before: 6,
  auto_complete_hours: 72,
  auto_complete_notif_1_hours_before: 24,
  auto_complete_notif_2_hours_before: 2,
  pending_sp_release_days: 3,
  transaction_fee_subscriber_cents: 150,
  transaction_fee_non_subscriber_cents: 250,
  platform_fee_seller_percentage: 5,
  platform_fee_seller_discount_percentage_kids_club_plus: 0,
  pickup_window_hours: 72,
  pickup_notif_1_hours_before: 24,
  pickup_notif_2_hours_before: 2,
  payout_buffer_days: 2,
  platform_fee_buyer_fixed_cents: 25,
  platform_fee_buyer_percentage: 2.5,
  charge_one_fee_per_bundle: false,
  cancel_request_escalation_enabled: true,
  cancel_request_response_timeout_hours: 48,
};

describe('validateTradeTimingSettings', () => {
  describe('Valid config', () => {
    it('should return no errors for default valid config', () => {
      const errors = validateTradeTimingSettings(DEFAULT_VALID);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should accept zero transaction fees', () => {
      const errors = validateTradeTimingSettings({
        ...DEFAULT_VALID,
        transaction_fee_subscriber_cents: 0,
        transaction_fee_non_subscriber_cents: 0,
      });
      expect(errors.transaction_fee_subscriber_cents).toBeUndefined();
      expect(errors.transaction_fee_non_subscriber_cents).toBeUndefined();
    });
  });

  describe('Offer expiry ordering constraints', () => {
    it('should error when offer_timeout_hours < 1', () => {
      const errors = validateTradeTimingSettings({ ...DEFAULT_VALID, offer_timeout_hours: 0 });
      expect(errors.offer_timeout_hours).toBeDefined();
    });

    it('should error when offer_notif_1_hours_before >= offer_timeout_hours', () => {
      const errors = validateTradeTimingSettings({
        ...DEFAULT_VALID,
        offer_timeout_hours: 12,
        offer_notif_1_hours_before: 12,  // equal, should fail
      });
      expect(errors.offer_notif_1_hours_before).toBeDefined();
    });

    it('should error when offer_notif_2_hours_before >= offer_notif_1_hours_before', () => {
      const errors = validateTradeTimingSettings({
        ...DEFAULT_VALID,
        offer_notif_1_hours_before: 6,
        offer_notif_2_hours_before: 6,  // equal, should fail
      });
      expect(errors.offer_notif_2_hours_before).toBeDefined();
    });

    it('should error when offer_notif_2_hours_before < 1', () => {
      const errors = validateTradeTimingSettings({
        ...DEFAULT_VALID,
        offer_notif_2_hours_before: 0,
      });
      expect(errors.offer_notif_2_hours_before).toBeDefined();
    });
  });

  describe('Auto-complete constraints', () => {
    it('should error when auto_complete_hours < 1', () => {
      const errors = validateTradeTimingSettings({ ...DEFAULT_VALID, auto_complete_hours: 0 });
      expect(errors.auto_complete_hours).toBeDefined();
    });

    it('should error when auto_complete_notif_1_hours_before >= auto_complete_hours', () => {
      const errors = validateTradeTimingSettings({
        ...DEFAULT_VALID,
        auto_complete_hours: 24,
        auto_complete_notif_1_hours_before: 24, // equal, should fail
      });
      expect(errors.auto_complete_notif_1_hours_before).toBeDefined();
    });

    it('should error when auto_complete_notif_2_hours_before >= auto_complete_notif_1_hours_before', () => {
      const errors = validateTradeTimingSettings({
        ...DEFAULT_VALID,
        auto_complete_notif_1_hours_before: 12,
        auto_complete_notif_2_hours_before: 12, // equal, should fail
      });
      expect(errors.auto_complete_notif_2_hours_before).toBeDefined();
    });
  });

  describe('SP release constraints', () => {
    it('should error when pending_sp_release_days < 1', () => {
      const errors = validateTradeTimingSettings({ ...DEFAULT_VALID, pending_sp_release_days: 0 });
      expect(errors.pending_sp_release_days).toBeDefined();
    });

    it('should accept pending_sp_release_days = 1 (minimum)', () => {
      const errors = validateTradeTimingSettings({ ...DEFAULT_VALID, pending_sp_release_days: 1 });
      expect(errors.pending_sp_release_days).toBeUndefined();
    });
  });

  describe('Fee constraints', () => {
    it('should error when transaction_fee_subscriber_cents is negative', () => {
      const errors = validateTradeTimingSettings({
        ...DEFAULT_VALID,
        transaction_fee_subscriber_cents: -1,
      });
      expect(errors.transaction_fee_subscriber_cents).toBeDefined();
    });

    it('should error when transaction_fee_non_subscriber_cents is negative', () => {
      const errors = validateTradeTimingSettings({
        ...DEFAULT_VALID,
        transaction_fee_non_subscriber_cents: -100,
      });
      expect(errors.transaction_fee_non_subscriber_cents).toBeDefined();
    });

    it('should error when platform_fee_seller_percentage is negative', () => {
      const errors = validateTradeTimingSettings({
        ...DEFAULT_VALID,
        platform_fee_seller_percentage: -1,
      });
      expect(errors.platform_fee_seller_percentage).toBeDefined();
    });

    it('should error when platform_fee_seller_percentage > 100', () => {
      const errors = validateTradeTimingSettings({
        ...DEFAULT_VALID,
        platform_fee_seller_percentage: 101,
      });
      expect(errors.platform_fee_seller_percentage).toBeDefined();
    });

    it('should error when platform_fee_seller_discount_percentage_kids_club_plus is negative', () => {
      const errors = validateTradeTimingSettings({
        ...DEFAULT_VALID,
        platform_fee_seller_discount_percentage_kids_club_plus: -5,
      });
      expect(errors.platform_fee_seller_discount_percentage_kids_club_plus).toBeDefined();
    });

    it('should accept zero seller fee percentages', () => {
      const errors = validateTradeTimingSettings({
        ...DEFAULT_VALID,
        platform_fee_seller_percentage: 0,
        platform_fee_seller_discount_percentage_kids_club_plus: 0,
      });
      expect(errors.platform_fee_seller_percentage).toBeUndefined();
      expect(errors.platform_fee_seller_discount_percentage_kids_club_plus).toBeUndefined();
    });
  });

  describe('N1 configurability constraints', () => {
    it('should error when pickup_window_hours < 1', () => {
      const errors = validateTradeTimingSettings({ ...DEFAULT_VALID, pickup_window_hours: 0 });
      expect(errors.pickup_window_hours).toBeDefined();
    });

    it('should error when pickup_window_hours > 168', () => {
      const errors = validateTradeTimingSettings({ ...DEFAULT_VALID, pickup_window_hours: 169 });
      expect(errors.pickup_window_hours).toBeDefined();
    });

    it('should accept a large pickup window within the 7-day combined guardrail (48 + 119 = 167)', () => {
      const errors = validateTradeTimingSettings({ ...DEFAULT_VALID, pickup_window_hours: 119 });
      expect(errors.pickup_window_hours).toBeUndefined();
      expect(errors.offer_timeout_hours).toBeUndefined();
    });

    it('should error when payout_buffer_days is negative', () => {
      const errors = validateTradeTimingSettings({ ...DEFAULT_VALID, payout_buffer_days: -1 });
      expect(errors.payout_buffer_days).toBeDefined();
    });

    it('should error when payout_buffer_days > 30', () => {
      const errors = validateTradeTimingSettings({ ...DEFAULT_VALID, payout_buffer_days: 31 });
      expect(errors.payout_buffer_days).toBeDefined();
    });

    it('should accept payout_buffer_days = 0 (immediate release)', () => {
      const errors = validateTradeTimingSettings({ ...DEFAULT_VALID, payout_buffer_days: 0 });
      expect(errors.payout_buffer_days).toBeUndefined();
    });
  });

  describe('R2 — 7-day guardrail + pickup reminders', () => {
    it('should error when offer + pickup meets the 7-day limit (100 + 72 = 172)', () => {
      const errors = validateTradeTimingSettings({ ...DEFAULT_VALID, offer_timeout_hours: 100 });
      expect(errors.offer_timeout_hours).toBeDefined();
      expect(errors.pickup_window_hours).toBeDefined();
    });

    it('should error when offer + pickup = 168h exactly (48 + 120)', () => {
      const errors = validateTradeTimingSettings({ ...DEFAULT_VALID, pickup_window_hours: 120 });
      expect(errors.offer_timeout_hours).toBeDefined();
      expect(errors.pickup_window_hours).toBeDefined();
    });

    it('should accept offer + pickup = 167h (48 + 119)', () => {
      const errors = validateTradeTimingSettings({ ...DEFAULT_VALID, pickup_window_hours: 119 });
      expect(errors.offer_timeout_hours).toBeUndefined();
      expect(errors.pickup_window_hours).toBeUndefined();
    });

    it('should error when pickup_notif_1_hours_before >= pickup_window_hours', () => {
      const errors = validateTradeTimingSettings({
        ...DEFAULT_VALID,
        pickup_window_hours: 24,
        pickup_notif_1_hours_before: 24,
      });
      expect(errors.pickup_notif_1_hours_before).toBeDefined();
    });

    it('should error when pickup_notif_2_hours_before >= pickup_notif_1_hours_before', () => {
      const errors = validateTradeTimingSettings({
        ...DEFAULT_VALID,
        pickup_notif_1_hours_before: 12,
        pickup_notif_2_hours_before: 12,
      });
      expect(errors.pickup_notif_2_hours_before).toBeDefined();
    });

    it('should accept the default pickup reminders (24h / 2h)', () => {
      const errors = validateTradeTimingSettings(DEFAULT_VALID);
      expect(errors.pickup_notif_1_hours_before).toBeUndefined();
      expect(errors.pickup_notif_2_hours_before).toBeUndefined();
    });
  });

  describe('Buyer fee constraints (consolidated from /config → FEES)', () => {
    it('should error when platform_fee_buyer_fixed_cents is negative', () => {
      const errors = validateTradeTimingSettings({
        ...DEFAULT_VALID,
        platform_fee_buyer_fixed_cents: -1,
      });
      expect(errors.platform_fee_buyer_fixed_cents).toBeDefined();
    });

    it('should error when platform_fee_buyer_percentage > 100', () => {
      const errors = validateTradeTimingSettings({
        ...DEFAULT_VALID,
        platform_fee_buyer_percentage: 101,
      });
      expect(errors.platform_fee_buyer_percentage).toBeDefined();
    });

    it('should accept valid buyer fees', () => {
      const errors = validateTradeTimingSettings({
        ...DEFAULT_VALID,
        platform_fee_buyer_fixed_cents: 25,
        platform_fee_buyer_percentage: 2.5,
      });
      expect(errors.platform_fee_buyer_fixed_cents).toBeUndefined();
      expect(errors.platform_fee_buyer_percentage).toBeUndefined();
    });
  });

  describe('Buyer cancel request constraints', () => {
    it('should error when cancel_request_response_timeout_hours < 1', () => {
      const errors = validateTradeTimingSettings({
        ...DEFAULT_VALID,
        cancel_request_response_timeout_hours: 0,
      });
      expect(errors.cancel_request_response_timeout_hours).toBeDefined();
    });

    it('should error when cancel_request_response_timeout_hours > 336', () => {
      const errors = validateTradeTimingSettings({
        ...DEFAULT_VALID,
        cancel_request_response_timeout_hours: 337,
      });
      expect(errors.cancel_request_response_timeout_hours).toBeDefined();
    });

    it('should accept the boundary values (1 and 336)', () => {
      const minErrors = validateTradeTimingSettings({
        ...DEFAULT_VALID,
        cancel_request_response_timeout_hours: 1,
      });
      expect(minErrors.cancel_request_response_timeout_hours).toBeUndefined();
      const maxErrors = validateTradeTimingSettings({
        ...DEFAULT_VALID,
        cancel_request_response_timeout_hours: 336,
      });
      expect(maxErrors.cancel_request_response_timeout_hours).toBeUndefined();
    });
  });

  describe('Multiple violations', () => {
    it('should return multiple errors for completely invalid config', () => {
      const invalid: TradeTimingConfig = {
        offer_timeout_hours: 0,
        offer_notif_1_hours_before: 48,  // > timeout
        offer_notif_2_hours_before: 24,  // > notif1 won't apply since notif1 < timeout errors first, but still >= notif1 may not
        auto_complete_hours: 0,
        auto_complete_notif_1_hours_before: 72,
        auto_complete_notif_2_hours_before: 72,
        pending_sp_release_days: 0,
        transaction_fee_subscriber_cents: -50,
        transaction_fee_non_subscriber_cents: -100,
        platform_fee_seller_percentage: -1,
        platform_fee_seller_discount_percentage_kids_club_plus: 101,
        pickup_window_hours: 0,
        pickup_notif_1_hours_before: 0,
        pickup_notif_2_hours_before: 0,
        payout_buffer_days: -1,
        platform_fee_buyer_fixed_cents: -25,
        platform_fee_buyer_percentage: 101,
        charge_one_fee_per_bundle: false,
        cancel_request_escalation_enabled: true,
        cancel_request_response_timeout_hours: 0,
      };
      const errors = validateTradeTimingSettings(invalid);
      expect(Object.keys(errors).length).toBeGreaterThan(3);
    });
  });
});
