// FILE: p2p-kids-admin/src/types/category.ts
// ADMIN-V3-002: Shared types for category management
// Module: MODULE-12-ADMIN-V3-CATEGORIES

/**
 * Complete category entity (all columns from categories table)
 */
export interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null; // Emoji or icon library name (max 50 chars)
  icon_url: string | null; // Custom uploaded icon URL
  bonus_badge_icon_url: string | null; // Custom bonus badge URL
  is_active: boolean;
  item_count: number; // Computed by trigger — READ-ONLY
  display_order: number;
  sp_earning_multiplier: number; // 1.05–1.40
  sp_spending_cap_percent: number; // 50–80
  sp_config_notes: string | null; // Max 500 chars
  sp_rate_change_notify: boolean; // One-shot notification flag
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * Input for creating a new category
 */
export interface CreateCategoryInput {
  name: string; // 3–50 chars, alphanumeric + spaces, unique case-insensitive
  description?: string | null; // Max 200 chars
  icon?: string | null; // Emoji or icon library name
  icon_url?: string | null;
  bonus_badge_icon_url?: string | null;
  sp_earning_multiplier?: number; // Default 1.10
  sp_spending_cap_percent?: number; // Default 70
  sp_config_notes?: string | null;
  is_active?: boolean; // Default true
}

/**
 * Input for updating an existing category
 */
export interface UpdateCategoryInput {
  name?: string;
  description?: string | null;
  icon?: string | null;
  icon_url?: string | null;
  bonus_badge_icon_url?: string | null;
  sp_earning_multiplier?: number;
  sp_spending_cap_percent?: number;
  sp_config_notes?: string | null;
  is_active?: boolean;
  sp_rate_change_notify?: boolean;
  // NOTE: item_count, display_order cannot be updated directly
}

/**
 * Category suggestion status
 */
export type SuggestionStatus = 'pending' | 'approved' | 'rejected' | 'merged';

/**
 * Category suggestion entity (from category_suggestions table)
 */
export interface CategorySuggestion {
  id: string;
  suggested_name: string;
  seller_id: string;
  item_id: string;
  status: SuggestionStatus;
  approved_by: string | null;
  merged_to_category_id: string | null;
  admin_note: string | null;
  created_at: string; // ISO timestamp
  reviewed_at: string | null; // ISO timestamp
  // Optional joined data
  seller?: {
    id: string;
    full_name: string;
    email: string;
  };
  item?: {
    id: string;
    name: string;
    status: string;
  };
  merged_to_category?: {
    id: string;
    name: string;
  };
}

/**
 * Input for approving a category suggestion
 */
export interface ApproveSuggestionInput {
  categoryData: CreateCategoryInput; // New category to create
  reassignItem?: boolean; // Whether to update item.category_id (default true)
}

/**
 * Input for merging a suggestion into an existing category
 */
export interface MergeSuggestionInput {
  target_category_id: string; // Existing category to merge into
  admin_note?: string | null;
}

/**
 * Input for rejecting a suggestion
 */
export interface RejectSuggestionInput {
  admin_note?: string | null;
}

/**
 * Category with bonus earning multiplier (filtered view)
 */
export interface BonusCategory {
  id: string;
  name: string;
  icon: string | null;
  icon_url: string | null;
  bonus_badge_icon_url: string | null;
  sp_earning_multiplier: number; // > 1.10
  sp_spending_cap_percent: number;
  item_count: number;
}

/**
 * SP analytics data per category
 */
export interface CategorySPAnalytics {
  category_id: string;
  category_name: string;
  velocity: number; // SP earned / SP spent ratio
  gap_percent: number; // (available - spent) / available * 100
  avg_cash_per_trade: number; // Average cash portion per trade
  anomaly_flags: AnomalyFlag[];
}

/**
 * Anomaly detection flags
 */
export type AnomalyFlag = 'hoarding' | 'low_velocity' | 'spending_spike';

/**
 * Validation result for category name/uniqueness checks
 */
export interface ValidationResult {
  valid: boolean;
  error?: string; // User-facing error message if invalid
}

/**
 * Preview calculation result for SP rates
 */
export interface CategorySPPreview {
  price: number; // Input price
  earn_sp: number; // Math.round(price * multiplier)
  max_spend_sp: number; // Math.floor(price * cap_percent / 100)
  spend_percent: number; // cap_percent value
}

/**
 * Reorder payload for reorder_categories RPC
 */
export interface CategoryReorderItem {
  id: string;
  display_order: number;
}

/**
 * Icon upload type
 */
export type IconType = 'category' | 'bonus_badge';
