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
  auto_complete_notif_hours_before: number;
  pending_sp_release_days: number;
  transaction_fee_subscriber_cents: number;
  transaction_fee_non_subscriber_cents: number;
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
  if (s.auto_complete_notif_hours_before >= s.auto_complete_hours) {
    e.auto_complete_notif_hours_before = `Must be less than auto-complete window (${s.auto_complete_hours}h)`;
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

  return e;
}

const DEFAULT_VALID: TradeTimingConfig = {
  offer_timeout_hours: 48,
  offer_notif_1_hours_before: 24,
  offer_notif_2_hours_before: 6,
  auto_complete_hours: 72,
  auto_complete_notif_hours_before: 24,
  pending_sp_release_days: 3,
  transaction_fee_subscriber_cents: 150,
  transaction_fee_non_subscriber_cents: 250,
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

    it('should error when auto_complete_notif_hours_before >= auto_complete_hours', () => {
      const errors = validateTradeTimingSettings({
        ...DEFAULT_VALID,
        auto_complete_hours: 24,
        auto_complete_notif_hours_before: 24,  // equal, should fail
      });
      expect(errors.auto_complete_notif_hours_before).toBeDefined();
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
  });

  describe('Multiple violations', () => {
    it('should return multiple errors for completely invalid config', () => {
      const invalid: TradeTimingConfig = {
        offer_timeout_hours: 0,
        offer_notif_1_hours_before: 48,  // > timeout
        offer_notif_2_hours_before: 24,  // > notif1 won't apply since notif1 < timeout errors first, but still >= notif1 may not
        auto_complete_hours: 0,
        auto_complete_notif_hours_before: 72,
        pending_sp_release_days: 0,
        transaction_fee_subscriber_cents: -50,
        transaction_fee_non_subscriber_cents: -100,
      };
      const errors = validateTradeTimingSettings(invalid);
      expect(Object.keys(errors).length).toBeGreaterThan(3);
    });
  });
});
