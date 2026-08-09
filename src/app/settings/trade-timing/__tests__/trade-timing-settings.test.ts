// filepath: p2p-kids-admin/src/app/settings/trade-timing/__tests__/trade-timing-settings.test.ts
// TFV2-001: Admin trade timing settings page unit tests

/**
 * NOTE: This test file validates the validation logic extracted from the page.
 * Full integration tests would require a Next.js + @testing-library/react setup.
 * The validation logic below mirrors the validateSettings() function in page.tsx.
 */

interface TradeTimingConfig {
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
}

/**
 * Pure validation function mirroring page.tsx validateSettings().
 * Returns a record of field errors (empty = valid).
 */
function validateTradeTimingSettings(s: TradeTimingConfig): Record<string, string> {
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

  return e;
}

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
      };
      const errors = validateTradeTimingSettings(invalid);
      expect(Object.keys(errors).length).toBeGreaterThan(3);
    });
  });
});
