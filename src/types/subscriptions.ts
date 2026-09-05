// filepath: p2p-kids-admin/src/types/subscriptions.ts

export type SubscriptionStatus =
  | "free"
  | "trial"
  | "active"
  | "cancelled"
  | "paused"
  | "grace_period"
  | "expired";

export interface Subscription {
  id: string;
  user_id: string;
  tier_id: string | null;
  status: SubscriptionStatus;

  // Trial fields
  trial_start_date: string | null;
  trial_end_date: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  has_used_trial: boolean;

  // Billing fields
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_payment_method_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  monthly_price_cents: number | null;
  last_payment_date: string | null;
  last_payment_amount: number | null;
  next_billing_date: string | null;

  // Payment failure tracking
  payment_failed_at: string | null;
  payment_retry_count: number;

  // Cancellation tracking
  cancelled_at: string | null;
  cancel_reason: string | null;
  cancel_at_period_end: boolean;
  auto_renew_enabled: boolean;

  // Pause and grace period
  paused_until: string | null;
  grace_started_at: string | null;
  grace_ends_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface SubscriptionWithProfile extends Subscription {
  profile?: {
    display_name: string | null;
    email: string | null;
  };
  display_price_cents?: number | null;
  tier?: {
    id: string;
    display_name: string | null;
    price_cents: number | null;
    stripe_price_id: string | null;
  } | null;
  // DEV-TASK-117 (item 8): the most recent admin subscription action recorded
  // in admin_audit_logs (entity_type='subscription') for this user, if any.
  latest_admin_action?: {
    actor_id: string | null;
    actor_name: string | null;
    actor_email: string | null;
    action_type: string;
    created_at: string | null;
  } | null;
}

export interface SubscriptionMetrics {
  totalSubscribers: number; // trial + active
  activeSubscribers: number; // active only
  trialUsers: number;
  gracePeriodUsers: number;
  expiredUsers: number;
  mrr: number; // Monthly Recurring Revenue in cents
  churnRate: number; // Percentage
  graceToResubscribeRate: number; // Percentage
  // Cancellations grouped by the stored cancel_reason (raw value + count), desc by count.
  cancellationsByReason?: { reason: string; count: number }[];
}

export interface GracePeriodConfig {
  grace_period_days: number;
  grace_reminder_thresholds: number[]; // e.g., [60, 30, 7, 1]
}
