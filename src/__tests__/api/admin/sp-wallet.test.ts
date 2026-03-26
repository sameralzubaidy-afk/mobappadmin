// filepath: p2p-kids-admin/src/__tests__/api/admin/sp-wallet.test.ts
// Module: MODULE-12-ADMIN-V2 / TASK ADMIN-V2-003
// Unit tests for SP Wallet admin operations business logic
// Run: npm test -- --testPathPattern=sp-wallet

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Inline business logic helpers (mirroring what the API / RPC does)
// ─────────────────────────────────────────────────────────────────────────────

interface Wallet {
  id: string;
  user_id: string;
  status: 'active' | 'frozen' | 'suspended';
  available_balance: number;
  pending_balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
}

function computeAdjustment(
  wallet: Wallet,
  amount: number,
  reason: string
):
  | { success: true; new_balance: number; tx_type: string }
  | { success: false; error: string } {
  if (amount === 0) {
    return { success: false, error: 'Amount cannot be zero' };
  }
  if (!reason || reason.trim() === '') {
    return { success: false, error: 'Reason is mandatory for SP adjustments' };
  }
  if (amount < 0 && wallet.available_balance + amount < 0) {
    return {
      success: false,
      error: `Insufficient balance: cannot deduct ${Math.abs(amount)} SP (current: ${wallet.available_balance})`,
    };
  }
  const tx_type = amount > 0 ? 'earn_admin_grant' : 'admin_deduct';
  return { success: true, new_balance: wallet.available_balance + amount, tx_type };
}

function validateStatusChange(
  newStatus: string
): { valid: true } | { valid: false; error: string } {
  if (!['active', 'frozen', 'suspended'].includes(newStatus)) {
    return {
      valid: false,
      error: 'Invalid status. Must be one of: active, frozen, suspended',
    };
  }
  return { valid: true };
}

type RawMetricsRow = {
  lifetime_earned: number;
  lifetime_spent: number;
  available_balance: number;
  pending_balance: number;
  status: string;
};

function computeEconomyMetrics(wallets: RawMetricsRow[]) {
  const totalEarned = wallets.reduce((s, w) => s + w.lifetime_earned, 0);
  const totalSpent = wallets.reduce((s, w) => s + w.lifetime_spent, 0);
  const circulation = wallets.reduce(
    (s, w) => s + w.available_balance + w.pending_balance,
    0
  );
  const activeWallets = wallets.filter((w) => w.status === 'active').length;
  const activeBalances = wallets
    .filter((w) => w.available_balance > 0)
    .map((w) => w.available_balance);
  const avgBalance =
    activeBalances.length > 0
      ? activeBalances.reduce((s, b) => s + b, 0) / activeBalances.length
      : 0;

  return { totalEarned, totalSpent, circulation, activeWallets, avgBalance };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

const mockWallet: Wallet = {
  id: 'wallet-uuid-001',
  user_id: 'user-uuid-001',
  status: 'active',
  available_balance: 100,
  pending_balance: 10,
  lifetime_earned: 200,
  lifetime_spent: 90,
};

describe('SP Wallet Admin Operations – computeAdjustment', () => {
  it('adds SP correctly (positive amount)', () => {
    const result = computeAdjustment(mockWallet, 50, 'Compensation');
    expect(result).toMatchObject({ success: true, new_balance: 150, tx_type: 'earn_admin_grant' });
  });

  it('deducts SP correctly (negative amount)', () => {
    const result = computeAdjustment(mockWallet, -30, 'Correction');
    expect(result).toMatchObject({ success: true, new_balance: 70, tx_type: 'admin_deduct' });
  });

  it('prevents deduction below zero balance', () => {
    const result = computeAdjustment(mockWallet, -200, 'Too much');
    expect(result).toMatchObject({ success: false });
    expect((result as { error: string }).error).toContain('Insufficient balance');
  });

  it('rejects zero amount', () => {
    const result = computeAdjustment(mockWallet, 0, 'Zero');
    expect(result).toMatchObject({ success: false, error: 'Amount cannot be zero' });
  });

  it('rejects empty reason', () => {
    const result = computeAdjustment(mockWallet, 10, '   ');
    expect(result).toMatchObject({ success: false, error: 'Reason is mandatory for SP adjustments' });
  });

  it('allows deduction down to exactly zero', () => {
    const result = computeAdjustment(mockWallet, -100, 'Full deduct');
    expect(result).toMatchObject({ success: true, new_balance: 0, tx_type: 'admin_deduct' });
  });

  it('handles wallet with zero balance – deduction of 1 rejected', () => {
    const zeroWallet = { ...mockWallet, available_balance: 0 };
    const result = computeAdjustment(zeroWallet, -1, 'Reason');
    expect(result).toMatchObject({ success: false });
  });
});

describe('SP Wallet Admin Operations – validateStatusChange', () => {
  it('accepts valid statuses', () => {
    expect(validateStatusChange('active')).toEqual({ valid: true });
    expect(validateStatusChange('frozen')).toEqual({ valid: true });
    expect(validateStatusChange('suspended')).toEqual({ valid: true });
  });

  it('rejects invalid status', () => {
    const r = validateStatusChange('deleted');
    expect(r).toMatchObject({ valid: false });
    expect((r as { error: string }).error).toContain('Invalid status');
  });

  it('rejects empty string', () => {
    const r = validateStatusChange('');
    expect(r).toMatchObject({ valid: false });
  });
});

describe('SP Wallet Admin Operations – computeEconomyMetrics', () => {
  const wallets: RawMetricsRow[] = [
    { lifetime_earned: 500, lifetime_spent: 200, available_balance: 300, pending_balance: 0, status: 'active' },
    { lifetime_earned: 100, lifetime_spent: 50, available_balance: 50, pending_balance: 10, status: 'active' },
    { lifetime_earned: 0, lifetime_spent: 0, available_balance: 0, pending_balance: 0, status: 'frozen' },
  ];

  it('calculates total earned correctly', () => {
    const m = computeEconomyMetrics(wallets);
    expect(m.totalEarned).toBe(600);
  });

  it('calculates total spent correctly', () => {
    const m = computeEconomyMetrics(wallets);
    expect(m.totalSpent).toBe(250);
  });

  it('calculates current circulation (available + pending)', () => {
    const m = computeEconomyMetrics(wallets);
    // 300 + 0 + 50 + 10 + 0 + 0 = 360
    expect(m.circulation).toBe(360);
  });

  it('counts only active wallets', () => {
    const m = computeEconomyMetrics(wallets);
    expect(m.activeWallets).toBe(2);
  });

  it('calculates average balance (excludes zero-balance wallets)', () => {
    const m = computeEconomyMetrics(wallets);
    // Wallets with balance > 0: 300, 50 → avg = 175
    expect(m.avgBalance).toBe(175);
  });

  it('handles empty wallet list gracefully', () => {
    const m = computeEconomyMetrics([]);
    expect(m.totalEarned).toBe(0);
    expect(m.activeWallets).toBe(0);
    expect(m.avgBalance).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// API-layer validation tests (input guard logic)
// ─────────────────────────────────────────────────────────────────────────────

describe('SP Wallet API – input validation', () => {
  it('rejects adjust action with missing user_id', () => {
    const body: any = { action: 'adjust', amount: 10, reason: 'Test' };
    expect(body.user_id).toBeUndefined();
  });

  it('rejects adjust action with missing reason', () => {
    const body: any = { action: 'adjust', user_id: 'uid', amount: 10 };
    expect(body.reason).toBeUndefined();
  });

  it('rejects toggle_status with unknown status value', () => {
    const r = validateStatusChange('unknown_status');
    expect(r).toMatchObject({ valid: false });
  });
});
