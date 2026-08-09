// File: p2p-kids-admin/src/types/trades.ts

export type TradeStatus =
  | 'pending'
  | 'payment_failed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface Trade {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: TradeStatus;
  sp_amount: number;
  cash_amount_cents: number;
  buyer_transaction_fee_cents: number;
  cash_currency: string;
  buyer_subscription_status: string | null;
  stripe_payment_intent_id: string | null;
  stripe_refund_id?: string | null;
  sp_debit_ledger_entry_id: string | null;
  sp_credit_ledger_entry_id: string | null;
  cancellation_reason: string | null;
  /** UUID shared by all trades in a bundle — null for single-item trades */
  bundle_id?: string | null;
  /** Number of items in the bundle (1 for single-item trades) */
  bundle_size?: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  last_status_change_at: string;
  buyer?: {
    email: string;
    name: string;
    phone?: string;
    subscriptions?: { status: string }[];
  };
  seller?: {
    email: string;
    name: string;
    phone?: string;
  };
}

/** Represents a grouped bundle of trades sharing the same bundle_id */
export interface BundleGroup {
  bundle_id: string;
  bundle_size: number;
  trades: Trade[];
  buyer_id: string;
  seller_id: string;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  seller_name: string | null;
  seller_email: string | null;
  seller_phone: string | null;
  total_cash_cents: number;
  total_sp: number;
  total_fee_cents: number;
  statuses: string[];
  created_at: string;
  earliest_created_at: string;
}

export interface TradeAnalytics {
  total_volume: number;
  status_counts: Record<TradeStatus, number>;
  avg_sp_usage: number;
  total_fee_revenue_cents: number;
}
