// filepath: p2p-kids-admin/src/lib/payoutFees.ts
// Module: MODULE-06-TRADE-FLOW-sellerpayouts.md (TASK PAY-002)
// Description: Payout fee calculation helpers (client-side mirror of DB logic)

export type PayoutMethodType = 'stripe_connect' | 'paypal' | 'venmo' | 'bank_ach';

export interface PayoutFeeConfig {
  stripe_fixed_cents: number;
  stripe_percentage: number;
  paypal_percentage: number;
  paypal_cap_cents: number;
  venmo_percentage: number;
  venmo_cap_cents: number;
  bank_ach_cents: number;
}

/**
 * Default payout fee configuration (used as fallback)
 */
export const DEFAULT_PAYOUT_FEE_CONFIG: PayoutFeeConfig = {
  stripe_fixed_cents: 25,
  stripe_percentage: 0.25,
  paypal_percentage: 2.0,
  paypal_cap_cents: 2000,
  venmo_percentage: 2.0,
  venmo_cap_cents: 2000,
  bank_ach_cents: 25,
};

/**
 * Calculate payout fee in cents for a given method and amount
 * @param method - Payout method type
 * @param amountCents - Payout amount in cents
 * @param config - Fee configuration (uses defaults if not provided)
 * @returns Fee in cents
 */
export function getPayoutFeeCents(
  method: PayoutMethodType,
  amountCents: number,
  config: PayoutFeeConfig = DEFAULT_PAYOUT_FEE_CONFIG
): number {
  if (amountCents <= 0) return 0;

  switch (method) {
    case 'stripe_connect': {
      // Stripe: percentage + fixed fee
      const percentageFee = Math.round(amountCents * (config.stripe_percentage / 100));
      return percentageFee + config.stripe_fixed_cents;
    }

    case 'paypal': {
      // PayPal: percentage capped at maximum
      const percentageFee = Math.round(amountCents * (config.paypal_percentage / 100));
      return Math.min(percentageFee, config.paypal_cap_cents);
    }

    case 'venmo': {
      // Venmo: percentage capped at maximum
      const percentageFee = Math.round(amountCents * (config.venmo_percentage / 100));
      return Math.min(percentageFee, config.venmo_cap_cents);
    }

    case 'bank_ach': {
      // ACH: flat fee (Post-MVP)
      return config.bank_ach_cents;
    }

    default:
      return 0;
  }
}

/**
 * Compute net payout after deducting fees
 * @param grossCents - Gross payout amount in cents
 * @param platformFeeCents - Platform fee in cents (typically $0)
 * @param payoutFeeCents - Payout provider fee in cents
 * @returns Net payout in cents (never negative)
 */
export function computeNetPayoutCents(
  grossCents: number,
  platformFeeCents: number,
  payoutFeeCents: number
): number {
  return Math.max(0, grossCents - platformFeeCents - payoutFeeCents);
}

/**
 * Format cents as currency string
 * @param cents - Amount in cents
 * @param currency - Currency code (default: USD)
 * @returns Formatted currency string
 */
export function formatCurrency(cents: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

/**
 * Get payout fee breakdown for display
 * @param method - Payout method type
 * @param amountCents - Payout amount in cents
 * @param config - Fee configuration
 * @returns Breakdown object with all amounts
 */
export function getPayoutBreakdown(
  method: PayoutMethodType,
  amountCents: number,
  config: PayoutFeeConfig = DEFAULT_PAYOUT_FEE_CONFIG
) {
  const payoutFeeCents = getPayoutFeeCents(method, amountCents, config);
  const platformFeeCents = 0; // Platform transaction fee is $0 per policy
  const netCents = computeNetPayoutCents(amountCents, platformFeeCents, payoutFeeCents);

  return {
    grossCents: amountCents,
    platformFeeCents,
    payoutFeeCents,
    netCents,
    grossFormatted: formatCurrency(amountCents),
    platformFeeFormatted: formatCurrency(platformFeeCents),
    payoutFeeFormatted: formatCurrency(payoutFeeCents),
    netFormatted: formatCurrency(netCents),
  };
}

/**
 * Get friendly fee description for a payout method
 * @param method - Payout method type
 * @param config - Fee configuration
 * @returns Human-readable fee description
 */
export function getPayoutFeeDescription(
  method: PayoutMethodType,
  config: PayoutFeeConfig = DEFAULT_PAYOUT_FEE_CONFIG
): string {
  switch (method) {
    case 'stripe_connect':
      return `${config.stripe_percentage}% + ${formatCurrency(config.stripe_fixed_cents)}`;
    case 'paypal':
      return `${config.paypal_percentage}% (max ${formatCurrency(config.paypal_cap_cents)})`;
    case 'venmo':
      return `${config.venmo_percentage}% (max ${formatCurrency(config.venmo_cap_cents)})`;
    case 'bank_ach':
      return formatCurrency(config.bank_ach_cents);
    default:
      return 'Unknown method';
  }
}
