// filepath: p2p-kids-admin/__tests__/payout-fees.e2e.test.ts
// Module: MODULE-06-TRADE-FLOW-sellerpayouts.md (TASK PAY-002)
// Description: E2E tests for payout fee configuration

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables for E2E tests');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

describe('Payout Fees E2E', () => {
  let originalConfig: Record<string, string> = {};

  beforeAll(async () => {
    // Backup original configuration
    const { data, error } = await supabase
      .from('admin_config')
      .select('key, value')
      .like('key', 'payout_fee_%');

    if (!error && data) {
      data.forEach((item) => {
        originalConfig[item.key] = item.value;
      });
    }
  });

  afterAll(async () => {
    // Restore original configuration
    for (const [key, value] of Object.entries(originalConfig)) {
      await supabase.rpc('upsert_admin_config', {
        p_key: key,
        p_value: value,
      });
    }
  });

  describe('Database Configuration', () => {
    it('should have all payout fee config keys in database', async () => {
      const { data, error } = await supabase
        .from('admin_config')
        .select('key, value, description, category')
        .eq('category', 'payout_fees')
        .order('key');

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(7);

      const keys = data!.map((item) => item.key);
      expect(keys).toContain('payout_fee_stripe_fixed_cents');
      expect(keys).toContain('payout_fee_stripe_percentage');
      expect(keys).toContain('payout_fee_paypal_percentage');
      expect(keys).toContain('payout_fee_paypal_cap_cents');
      expect(keys).toContain('payout_fee_venmo_percentage');
      expect(keys).toContain('payout_fee_venmo_cap_cents');
      expect(keys).toContain('payout_fee_bank_ach_cents');
    });

    it('should have valid default values', async () => {
      const { data, error } = await supabase
        .from('admin_config')
        .select('key, value')
        .eq('key', 'payout_fee_stripe_fixed_cents')
        .single();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(parseInt(data!.value)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('RPC Functions', () => {
    it('get_payout_fee_config should return all fee values', async () => {
      const { data, error } = await supabase.rpc('get_payout_fee_config');

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data!.length).toBe(1);

      const config = data![0];
      expect(config).toHaveProperty('stripe_fixed_cents');
      expect(config).toHaveProperty('stripe_percentage');
      expect(config).toHaveProperty('paypal_percentage');
      expect(config).toHaveProperty('paypal_cap_cents');
      expect(config).toHaveProperty('venmo_percentage');
      expect(config).toHaveProperty('venmo_cap_cents');
      expect(config).toHaveProperty('bank_ach_cents');
    });

    it('calculate_payout_fee_cents should calculate Stripe fees correctly', async () => {
      const { data, error } = await supabase.rpc('calculate_payout_fee_cents', {
        p_method_type: 'stripe_connect',
        p_amount_cents: 10000,
      });

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      // Default: 0.25% of 10000 = 25 + fixed 25 = 50 cents
      expect(data).toBe(50);
    });

    it('calculate_payout_fee_cents should calculate PayPal fees correctly', async () => {
      const { data, error } = await supabase.rpc('calculate_payout_fee_cents', {
        p_method_type: 'paypal',
        p_amount_cents: 5000,
      });

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      // Default: 2% of 5000 = 100 cents
      expect(data).toBe(100);
    });

    it('calculate_payout_fee_cents should apply PayPal cap', async () => {
      const { data, error } = await supabase.rpc('calculate_payout_fee_cents', {
        p_method_type: 'paypal',
        p_amount_cents: 200000,
      });

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      // Default: 2% of 200000 = 4000, capped at 2000 cents
      expect(data).toBe(2000);
    });

    it('calculate_payout_fee_cents should handle zero amount', async () => {
      const { data, error } = await supabase.rpc('calculate_payout_fee_cents', {
        p_method_type: 'stripe_connect',
        p_amount_cents: 0,
      });

      expect(error).toBeNull();
      expect(data).toBe(0);
    });

    it('compute_net_payout_cents should calculate net correctly', async () => {
      const { data, error } = await supabase.rpc('compute_net_payout_cents', {
        p_gross_cents: 10000,
        p_platform_fee_cents: 0,
        p_payout_fee_cents: 50,
      });

      expect(error).toBeNull();
      expect(data).toBe(9950);
    });

    it('compute_net_payout_cents should never return negative', async () => {
      const { data, error } = await supabase.rpc('compute_net_payout_cents', {
        p_gross_cents: 1000,
        p_platform_fee_cents: 900,
        p_payout_fee_cents: 200,
      });

      expect(error).toBeNull();
      expect(data).toBe(0);
    });
  });

  describe('Configuration Updates', () => {
    it('should update fee configuration via upsert_admin_config', async () => {
      // Update Stripe fixed fee to $0.50
      const { error } = await supabase.rpc('upsert_admin_config', {
        p_key: 'payout_fee_stripe_fixed_cents',
        p_value: '50',
      });

      expect(error).toBeNull();

      // Verify the update
      const { data: verifyData } = await supabase
        .from('admin_config')
        .select('value')
        .eq('key', 'payout_fee_stripe_fixed_cents')
        .single();

      expect(verifyData?.value).toBe('50');

      // Verify RPC reflects the change
      const { data: feeData } = await supabase.rpc('calculate_payout_fee_cents', {
        p_method_type: 'stripe_connect',
        p_amount_cents: 10000,
      });

      // 0.25% of 10000 = 25 + new fixed 50 = 75 cents
      expect(feeData).toBe(75);
    });

    it('should update percentage fee configuration', async () => {
      // Update PayPal percentage to 3%
      const { error } = await supabase.rpc('upsert_admin_config', {
        p_key: 'payout_fee_paypal_percentage',
        p_value: '3.0',
      });

      expect(error).toBeNull();

      // Verify RPC reflects the change
      const { data: feeData } = await supabase.rpc('calculate_payout_fee_cents', {
        p_method_type: 'paypal',
        p_amount_cents: 5000,
      });

      // 3% of 5000 = 150 cents
      expect(feeData).toBe(150);
    });
  });

  describe('API Routes', () => {
    it('GET /api/admin/payout-fees should return configuration', async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/payout-fees`);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toHaveProperty('data');
      expect(json).toHaveProperty('rpc_data');
      expect(json).toHaveProperty('can_write');
      expect(Array.isArray(json.data)).toBe(true);
    });

    it('POST /api/admin/payout-fees should update configuration', async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/payout-fees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'payout_fee_stripe_fixed_cents',
          value: '25',
        }),
      });

      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('POST /api/admin/payout-fees should reject invalid key', async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/payout-fees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'invalid_key',
          value: '100',
        }),
      });

      expect(res.status).toBe(400);
    });

    it('POST /api/admin/payout-fees should reject negative percentage', async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/payout-fees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'payout_fee_paypal_percentage',
          value: '-1',
        }),
      });

      expect(res.status).toBe(400);
    });
  });
});
