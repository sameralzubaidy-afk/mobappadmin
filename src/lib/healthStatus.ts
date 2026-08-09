// File: p2p-kids-admin/src/lib/healthStatus.ts
// Admin dashboard health strip — pure status derivation + indicator registry.
//
// The RPC admin_health_summary() (migration 20260809000003_admin_health_strip.sql)
// returns each indicator's numeric `value` plus its configurable warn/crit
// `thresholds` (read from admin_config, category 'health' — tunable without a
// code change). This module derives the dot color from value + thresholds and
// maps each indicator id to its label / click-through href.
//
// Threshold semantics:
//   - 'high_is_bad':  higher value is worse (e.g. failed payment %, failed payout count)
//   - 'low_is_bad':   lower value is worse  (e.g. email delivery %, uptime %, nodes %, GMV)

export type HealthDirection = 'high_is_bad' | 'low_is_bad';
export type HealthStatus = 'healthy' | 'warning' | 'critical';

export interface HealthThresholds {
  warn: number;
  crit: number;
}

export interface HealthIndicatorData {
  id: string;
  value: number;
  display: string;
  detail?: string;
  thresholds: HealthThresholds;
}

export interface HealthSummary {
  generated_at?: string;
  indicators: HealthIndicatorData[];
}

export interface HealthIndicatorMeta {
  id: string;
  label: string;
  direction: HealthDirection;
  href: string;
}

/**
 * Derive the health dot color from a value + configurable thresholds.
 *
 * 'high_is_bad' (e.g. failure rate): critical when value >= crit, warning when
 * value >= warn, else healthy.
 * 'low_is_bad' (e.g. delivery %): critical when value <= crit, warning when
 * value <= warn, else healthy.
 */
export function deriveHealthStatus(
  value: number,
  thresholds: HealthThresholds,
  direction: HealthDirection
): HealthStatus {
  if (direction === 'high_is_bad') {
    if (value >= thresholds.crit) return 'critical';
    if (value >= thresholds.warn) return 'warning';
    return 'healthy';
  }
  if (value <= thresholds.crit) return 'critical';
  if (value <= thresholds.warn) return 'warning';
  return 'healthy';
}

/**
 * The 6-indicator registry. `direction` and `href` are UI concerns; the RPC
 * owns value + thresholds. Add a new indicator here AND in admin_health_summary()
 * to extend the strip.
 */
export const HEALTH_INDICATOR_META: HealthIndicatorMeta[] = [
  { id: 'payments', label: 'Payments', direction: 'high_is_bad', href: '/payments?status=failed' },
  { id: 'email_delivery', label: 'Email Delivery', direction: 'low_is_bad', href: '/monitoring' },
  { id: 'nodes_active', label: 'Nodes Active', direction: 'low_is_bad', href: '/nodes' },
  {
    id: 'failed_payouts',
    label: 'Failed Payouts',
    direction: 'high_is_bad',
    href: '/payouts/earnings?status=failed',
  },
  { id: 'uptime', label: 'Uptime', direction: 'low_is_bad', href: '/monitoring' },
  { id: 'gmv_7d', label: 'GMV (7d)', direction: 'low_is_bad', href: '/analytics' },
];

export function getHealthIndicatorMeta(id: string): HealthIndicatorMeta | undefined {
  return HEALTH_INDICATOR_META.find((m) => m.id === id);
}
