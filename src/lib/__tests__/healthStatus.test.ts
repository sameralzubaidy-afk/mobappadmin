// File: p2p-kids-admin/src/lib/__tests__/healthStatus.test.ts
// Unit tests for the health-strip status derivation (HP-2: at least one unit
// test for non-trivial business logic — the threshold → dot-color mapping).

import { describe, it, expect } from 'vitest';
import { deriveHealthStatus, HEALTH_INDICATOR_META, getHealthIndicatorMeta } from '../healthStatus';

describe('deriveHealthStatus', () => {
  const thresholds = { warn: 2, crit: 5 };

  describe('high_is_bad (higher value = worse, e.g. failed payment %)', () => {
    it('returns healthy below the warn threshold', () => {
      expect(deriveHealthStatus(0, thresholds, 'high_is_bad')).toBe('healthy');
      expect(deriveHealthStatus(1.9, thresholds, 'high_is_bad')).toBe('healthy');
    });

    it('returns warning at/above warn but below crit', () => {
      expect(deriveHealthStatus(2, thresholds, 'high_is_bad')).toBe('warning');
      expect(deriveHealthStatus(4.9, thresholds, 'high_is_bad')).toBe('warning');
    });

    it('returns critical at/above crit', () => {
      expect(deriveHealthStatus(5, thresholds, 'high_is_bad')).toBe('critical');
      expect(deriveHealthStatus(8, thresholds, 'high_is_bad')).toBe('critical');
    });
  });

  describe('low_is_bad (lower value = worse, e.g. email delivery %)', () => {
    const uptime = { warn: 99.9, crit: 99.0 };

    it('returns healthy above the warn threshold', () => {
      expect(deriveHealthStatus(100, uptime, 'low_is_bad')).toBe('healthy');
      expect(deriveHealthStatus(99.95, uptime, 'low_is_bad')).toBe('healthy');
    });

    it('returns warning at/below warn but above crit', () => {
      expect(deriveHealthStatus(99.9, uptime, 'low_is_bad')).toBe('warning');
      expect(deriveHealthStatus(99.5, uptime, 'low_is_bad')).toBe('warning');
    });

    it('returns critical at/below crit', () => {
      expect(deriveHealthStatus(99.0, uptime, 'low_is_bad')).toBe('critical');
      expect(deriveHealthStatus(95, uptime, 'low_is_bad')).toBe('critical');
    });
  });
});

describe('HEALTH_INDICATOR_META registry', () => {
  it('has all 6 indicators with label, direction and click-through href', () => {
    expect(HEALTH_INDICATOR_META.map((m) => m.id)).toEqual([
      'payments',
      'email_delivery',
      'nodes_active',
      'failed_payouts',
      'uptime',
      'gmv_7d',
    ]);
    for (const meta of HEALTH_INDICATOR_META) {
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.href.startsWith('/')).toBe(true);
      expect(['high_is_bad', 'low_is_bad']).toContain(meta.direction);
    }
  });

  it('resolves metadata by id', () => {
    expect(getHealthIndicatorMeta('failed_payouts')?.href).toBe('/payouts/earnings?status=failed');
    expect(getHealthIndicatorMeta('nope')).toBeUndefined();
  });
});
