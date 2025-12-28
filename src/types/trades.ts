// File: p2p-kids-admin/src/types/trades.ts

export type TradeStatus =
  | 'pending'
  | 'payment_processing'
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

export interface TradeAnalytics {
  total_volume: number;
  status_counts: Record<TradeStatus, number>;
  avg_sp_usage: number;
  total_fee_revenue_cents: number;
}
