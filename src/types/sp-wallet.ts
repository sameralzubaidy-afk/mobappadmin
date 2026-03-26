// filepath: p2p-kids-admin/src/types/sp-wallet.ts
// Module: MODULE-12-ADMIN-V2 / TASK ADMIN-V2-003

// The sp_wallets table column is 'state' (renamed from 'status' in migration 093)
export type SpWalletStatus = 'active' | 'frozen' | 'suspended' | 'grace_period';

export type SpLedgerTransactionType =
  | 'earn_starter_pack'
  | 'earn_reward'
  | 'earn_referral'
  | 'earn_challenge'
  | 'earn_refund'
  | 'earn_admin_grant'
  | 'earn_promotion'
  | 'spend_purchase'
  | 'spend_fee'
  | 'spend_boost'
  | 'expire'
  | 'freeze'
  | 'unfreeze'
  | 'admin_deduct';

export interface SpWallet {
  id: string;
  user_id: string;
  state: SpWalletStatus;  // DB column is 'state' (renamed from 'status' in migration 093)
  available_balance: number;
  pending_balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpLedgerEntry {
  id: string;
  transaction_type: SpLedgerTransactionType;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  admin_id: string | null;
  admin_note: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface SpWalletUserInfo {
  email: string | null;
  display_name: string | null;
}

export interface SpWalletDetail {
  user_info: SpWalletUserInfo;
  wallet: SpWallet;
  ledger: SpLedgerEntry[];
}

export interface SpEconomyMetrics {
  total_earned: number;
  total_spent: number;
  current_circulation: number;
  active_wallets: number;
  avg_balance: number;
  admin_adjustments_count: number;
  admin_adjustments_total: number;
}

export interface SpAdjustmentRequest {
  action: 'adjust';
  user_id: string;
  amount: number;
  reason: string;
  notes?: string;
}

export interface SpToggleStatusRequest {
  action: 'toggle_status';
  user_id: string;
  new_status: SpWalletStatus;
  notes?: string;
}

export type SpWalletActionRequest = SpAdjustmentRequest | SpToggleStatusRequest;
