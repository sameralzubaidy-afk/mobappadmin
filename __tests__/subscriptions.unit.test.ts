/**
 * Unit Tests: Subscription Management Utilities
 * File: p2p-kids-admin/__tests__/subscriptions.unit.test.ts
 * Module: MODULE-11-SUBSCRIPTIONS-V2.md
 * Task: SUB-011
 */

import { describe, it, expect } from 'vitest';

// Helper functions to test
function formatPrice(cents: number | null): string {
  if (cents === null || cents === undefined) return '$0.00';
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function parseReminderThresholds(input: string): number[] {
  return input
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n) && n > 0);
}

function validateGracePeriodDays(input: string): { valid: boolean; value: number | null; error: string | null } {
  const days = parseInt(input, 10);
  
  if (isNaN(days)) {
    return { valid: false, value: null, error: 'Must be a number' };
  }
  
  if (days < 1) {
    return { valid: false, value: null, error: 'Must be at least 1 day' };
  }
  
  if (days > 365) {
    return { valid: false, value: null, error: 'Cannot exceed 365 days' };
  }
  
  return { valid: true, value: days, error: null };
}

describe('Subscription Management Utilities', () => {
  describe('formatPrice', () => {
    it('formats cents to dollars correctly', () => {
      expect(formatPrice(499)).toBe('$4.99');
      expect(formatPrice(1000)).toBe('$10.00');
      expect(formatPrice(50)).toBe('$0.50');
      expect(formatPrice(0)).toBe('$0.00');
    });

    it('handles null and undefined', () => {
      expect(formatPrice(null)).toBe('$0.00');
      expect(formatPrice(undefined as any)).toBe('$0.00');
    });

    it('handles large amounts', () => {
      expect(formatPrice(999999)).toBe('$9999.99');
    });
  });

  describe('formatDate', () => {
    it('formats valid ISO dates', () => {
      const result = formatDate('2026-03-15T10:00:00Z');
      expect(result).toMatch(/Mar.*2026/);
    });

    it('handles null dates', () => {
      expect(formatDate(null)).toBe('—');
    });

    it('handles empty strings', () => {
      expect(formatDate('')).toBe('—');
    });
  });

  describe('parseReminderThresholds', () => {
    it('parses comma-separated integers', () => {
      expect(parseReminderThresholds('60, 30, 7, 1')).toEqual([60, 30, 7, 1]);
      expect(parseReminderThresholds('90,60,30,14,7,3,1')).toEqual([90, 60, 30, 14, 7, 3, 1]);
    });

    it('filters out invalid values', () => {
      expect(parseReminderThresholds('60, abc, 30, -5, 7')).toEqual([60, 30, 7]);
      expect(parseReminderThresholds('60, , 30, 0, 7')).toEqual([60, 30, 7]);
    });

    it('handles whitespace gracefully', () => {
      expect(parseReminderThresholds('  60  ,  30  ,  7  ')).toEqual([60, 30, 7]);
    });

    it('returns empty array for all invalid input', () => {
      expect(parseReminderThresholds('abc, def, xyz')).toEqual([]);
      expect(parseReminderThresholds('')).toEqual([]);
    });
  });

  describe('validateGracePeriodDays', () => {
    it('validates positive integers', () => {
      expect(validateGracePeriodDays('90')).toEqual({ valid: true, value: 90, error: null });
      expect(validateGracePeriodDays('1')).toEqual({ valid: true, value: 1, error: null });
      expect(validateGracePeriodDays('365')).toEqual({ valid: true, value: 365, error: null });
    });

    it('rejects non-numeric input', () => {
      const result = validateGracePeriodDays('abc');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Must be a number');
    });

    it('rejects zero and negative numbers', () => {
      expect(validateGracePeriodDays('0').valid).toBe(false);
      expect(validateGracePeriodDays('-5').valid).toBe(false);
    });

    it('rejects values over 365', () => {
      const result = validateGracePeriodDays('366');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Cannot exceed 365 days');
    });
  });
});
