// filepath: p2p-kids-admin/src/lib/payoutFees.test.ts
// Module: MODULE-06-TRADE-FLOW-sellerpayouts.md (TASK PAY-002)
// Description: Unit tests for payout fee helpers

import { describe, it, expect } from '@jest/globals';
import {
  getPayoutFeeCents,
  computeNetPayoutCents,
  getPayoutBreakdown,
  getPayoutFeeDescription,
  DEFAULT_PAYOUT_FEE_CONFIG,
  type PayoutFeeConfig,
} from './payoutFees';

describe('payoutFees', () => {
  describe('getPayoutFeeCents', () => {
    it('stripe_connect fee is percentage + fixed', () => {
      // $100 = 10000 cents
      // 0.25% of 10000 = 25 cents
      // Fixed = 25 cents
      // Total = 50 cents
      expect(getPayoutFeeCents('stripe_connect', 10000)).toBe(50);
    });

    it('stripe_connect fee for $1000', () => {
      // $1000 = 100000 cents
      // 0.25% of 100000 = 250 cents
      // Fixed = 25 cents
      // Total = 275 cents
      expect(getPayoutFeeCents('stripe_connect', 100000)).toBe(275);
    });

    it('paypal fee is 2%', () => {
      // $50 = 5000 cents
      // 2% of 5000 = 100 cents
      expect(getPayoutFeeCents('paypal', 5000)).toBe(100);
    });

    it('paypal fee is capped at $20', () => {
      // $2000 = 200000 cents
      // 2% of 200000 = 4000 cents ($40)
      // Cap = 2000 cents ($20)
      expect(getPayoutFeeCents('paypal', 200000)).toBe(2000);
    });

    it('paypal fee does not exceed cap for large amounts', () => {
      // $10000 = 1000000 cents
      // 2% of 1000000 = 20000 cents ($200)
      // Cap = 2000 cents ($20)
      expect(getPayoutFeeCents('paypal', 1000000)).toBe(2000);
    });

    it('venmo fee is 2%', () => {
      // $50 = 5000 cents
      // 2% of 5000 = 100 cents
      expect(getPayoutFeeCents('venmo', 5000)).toBe(100);
    });

    it('venmo fee is capped at $20', () => {
      // $2000 = 200000 cents
      // 2% of 200000 = 4000 cents ($40)
      // Cap = 2000 cents ($20)
      expect(getPayoutFeeCents('venmo', 200000)).toBe(2000);
    });

    it('bank_ach fee is flat $0.25', () => {
      expect(getPayoutFeeCents('bank_ach', 10000)).toBe(25);
      expect(getPayoutFeeCents('bank_ach', 100000)).toBe(25);
    });

    it('returns 0 for zero amount', () => {
      expect(getPayoutFeeCents('stripe_connect', 0)).toBe(0);
      expect(getPayoutFeeCents('paypal', 0)).toBe(0);
    });

    it('returns 0 for negative amount', () => {
      expect(getPayoutFeeCents('stripe_connect', -100)).toBe(0);
    });

    it('uses custom config when provided', () => {
      const customConfig: PayoutFeeConfig = {
        stripe_fixed_cents: 50,
        stripe_percentage: 0.5,
        paypal_percentage: 3.0,
        paypal_cap_cents: 1000,
        venmo_percentage: 3.0,
        venmo_cap_cents: 1000,
        bank_ach_cents: 50,
      };

      // Stripe: 0.5% of 10000 + 50 = 50 + 50 = 100
      expect(getPayoutFeeCents('stripe_connect', 10000, customConfig)).toBe(100);

      // PayPal: 3% of 5000 = 150
      expect(getPayoutFeeCents('paypal', 5000, customConfig)).toBe(150);

      // ACH: flat 50
      expect(getPayoutFeeCents('bank_ach', 10000, customConfig)).toBe(50);
    });
  });

  describe('computeNetPayoutCents', () => {
    it('computes net payout correctly', () => {
      // $100 - $0 platform - $0.50 payout = $99.50
      expect(computeNetPayoutCents(10000, 0, 50)).toBe(9950);
    });

    it('never goes negative', () => {
      // $10 - $9 - $2 = -$1, should return 0
      expect(computeNetPayoutCents(1000, 900, 200)).toBe(0);
    });

    it('handles zero fees', () => {
      expect(computeNetPayoutCents(10000, 0, 0)).toBe(10000);
    });

    it('handles platform fee only', () => {
      // $100 - $5 platform - $0 payout = $95
      expect(computeNetPayoutCents(10000, 500, 0)).toBe(9500);
    });

    it('handles both fees', () => {
      // $100 - $2 platform - $0.50 payout = $97.50
      expect(computeNetPayoutCents(10000, 200, 50)).toBe(9750);
    });
  });

  describe('getPayoutBreakdown', () => {
    it('returns complete breakdown for stripe', () => {
      const breakdown = getPayoutBreakdown('stripe_connect', 10000);
      
      expect(breakdown.grossCents).toBe(10000);
      expect(breakdown.platformFeeCents).toBe(0);
      expect(breakdown.payoutFeeCents).toBe(50);
      expect(breakdown.netCents).toBe(9950);
      expect(breakdown.grossFormatted).toBe('$100.00');
      expect(breakdown.netFormatted).toBe('$99.50');
    });

    it('returns complete breakdown for paypal', () => {
      const breakdown = getPayoutBreakdown('paypal', 5000);
      
      expect(breakdown.grossCents).toBe(5000);
      expect(breakdown.platformFeeCents).toBe(0);
      expect(breakdown.payoutFeeCents).toBe(100); // 2% of $50
      expect(breakdown.netCents).toBe(4900);
      expect(breakdown.grossFormatted).toBe('$50.00');
      expect(breakdown.netFormatted).toBe('$49.00');
    });

    it('handles paypal cap correctly', () => {
      const breakdown = getPayoutBreakdown('paypal', 200000);
      
      expect(breakdown.payoutFeeCents).toBe(2000); // Capped at $20
      expect(breakdown.netCents).toBe(198000); // $2000 - $20
    });
  });

  describe('getPayoutFeeDescription', () => {
    it('returns correct description for stripe', () => {
      const desc = getPayoutFeeDescription('stripe_connect');
      expect(desc).toContain('0.25%');
      expect(desc).toContain('$0.25');
    });

    it('returns correct description for paypal', () => {
      const desc = getPayoutFeeDescription('paypal');
      expect(desc).toContain('2%');
      expect(desc).toContain('$20.00');
    });

    it('returns correct description for venmo', () => {
      const desc = getPayoutFeeDescription('venmo');
      expect(desc).toContain('2%');
      expect(desc).toContain('$20.00');
    });

    it('returns correct description for bank_ach', () => {
      const desc = getPayoutFeeDescription('bank_ach');
      expect(desc).toBe('$0.25');
    });

    it('uses custom config when provided', () => {
      const customConfig: PayoutFeeConfig = {
        stripe_fixed_cents: 50,
        stripe_percentage: 0.5,
        paypal_percentage: 3.0,
        paypal_cap_cents: 1000,
        venmo_percentage: 3.0,
        venmo_cap_cents: 1000,
        bank_ach_cents: 50,
      };

      const desc = getPayoutFeeDescription('stripe_connect', customConfig);
      expect(desc).toContain('0.5%');
      expect(desc).toContain('$0.50');
    });
  });

  describe('edge cases', () => {
    it('handles very small amounts', () => {
      // $0.01 = 1 cent
      // Stripe: 0.25% of 1 = 0 (rounds down) + 25 = 25 cents
      expect(getPayoutFeeCents('stripe_connect', 1)).toBe(25);
    });

    it('handles very large amounts', () => {
      // $100,000 = 10,000,000 cents
      // Stripe: 0.25% of 10M = 25000 + 25 = 25025 cents ($250.25)
      expect(getPayoutFeeCents('stripe_connect', 10000000)).toBe(25025);
      
      // PayPal: 2% of 10M = 200000 cents, capped at 2000 cents
      expect(getPayoutFeeCents('paypal', 10000000)).toBe(2000);
    });

    it('net payout handles exact match (no fees left)', () => {
      // Gross exactly equals fees
      expect(computeNetPayoutCents(1000, 500, 500)).toBe(0);
    });
  });
});
