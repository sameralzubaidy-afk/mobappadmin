// FILE: admin-portal/src/types/education.ts
// MODULE-18 V1 EDU-002: Trading Education types (admin-facing)
// NOTE: This file does NOT import from p2p-kids-marketplace (independent packages)

/**
 * Section type enum — matches DB CHECK constraint exactly
 */
export type SectionType =
  | 'general'
  | 'sp_definition'
  | 'sp_earning'
  | 'sp_spending'
  | 'safety'
  | 'example';

/**
 * Education content section (admin view — includes draft metadata)
 */
export interface EducationSection {
  id: string;
  title: string; // 3-100 chars
  body: string; // 10-2000 chars, plain text with newline preservation
  image_url: string | null; // Supabase Storage public URL or null
  display_order: number;
  section_type: SectionType;
  is_published: boolean;
  published_at: string | null; // ISO timestamp
  published_by: string | null; // UUID of admin who published (FK to user_roles)
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * Input for creating a new section (admin)
 */
export interface CreateSectionInput {
  title: string;
  body: string;
  image_url?: string | null;
  display_order: number;
  section_type: SectionType;
}

/**
 * Input for updating an existing section (admin)
 */
export interface UpdateSectionInput {
  title?: string;
  body?: string;
  image_url?: string | null;
  display_order?: number;
}

/**
 * Example scenario for SP calculator demos (admin view)
 */
export interface EducationExample {
  id: string;
  item_name: string;
  item_price: number; // Dollars (e.g., 25.99)
  category_id: string | null; // FK to categories; null = "Other"
  display_order: number;
  is_published: boolean;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * Input for creating a new example (admin)
 */
export interface CreateExampleInput {
  item_name: string;
  item_price: number;
  category_id?: string | null;
  display_order: number;
}

/**
 * Input for updating an existing example (admin)
 */
export interface UpdateExampleInput {
  item_name?: string;
  item_price?: number;
  category_id?: string | null;
  display_order?: number;
}

/**
 * SP calculation result — discriminated union by mode
 */
export type SPCalculation = SellSPCalculation | BuySPCalculation;

/**
 * Sell mode: shows how much SP a seller earns
 */
export interface SellSPCalculation {
  mode: 'sell';
  price: number;
  category_id: string;
  category_name: string;
  earn_sp: number; // Math.round(price × multiplier)
  multiplier: number; // e.g., 1.30
  is_bonus: boolean; // true iff multiplier > 1.10
}

/**
 * Buy mode: shows max SP usable + cash breakdown
 */
export interface BuySPCalculation {
  mode: 'buy';
  price: number;
  category_id: string;
  category_name: string;
  max_sp_usable: number; // Math.floor(price × cap / 100)
  sp_spending_cap_percent: number; // e.g., 70
  sp_to_use: number; // User's selected SP amount
  cash_paid: number; // price - sp_to_use
  fee: number; // 10% of price (constant for MVP)
  total_cost: number; // cash_paid + fee
  is_bonus: boolean; // true iff multiplier > 1.10 (for badge display)
}

/**
 * Bonus category (subset of Category — mobile-facing)
 * Used for displaying bonus categories in admin preview
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
 * Analytics event type enum — the event types the app can emit. The DB CHECK
 * constraint `chk_education_analytics_event_type` is a SUPERSET (it also accepts
 * legacy section_collapse / prompt_* values) so every value here persists.
 */
export type EducationAnalyticsEventType =
  | 'onboarding_start'
  | 'onboarding_complete'
  | 'onboarding_skip'
  | 'help_view'
  | 'section_expand'
  | 'calculator_use'
  | 'seller_prompt_view'
  | 'buyer_prompt_view';

/**
 * Education analytics event (admin view)
 */
export interface EducationAnalyticsEvent {
  id: string;
  user_id: string | null; // Nullable for anonymous onboarding-start events
  event_type: EducationAnalyticsEventType;
  event_data: Record<string, unknown> | null; // JSONB payload (no PII)
  created_at: string; // ISO timestamp
}

/**
 * Analytics aggregation result (admin dashboard)
 */
export interface EducationAnalytics {
  onboarding: {
    started: number;
    completed: number;
    skipped: number;
    completionRate: number; // Percentage (0-100)
  };
  help: {
    views: number;
    uniqueUsers: number;
    sectionExpansionsByType: Record<SectionType, number>;
  };
  calculator: {
    uses: number;
    uniqueUsers: number;
    priceBucketHistogram: {
      '<10': number;
      '10-50': number;
      '50-100': number;
      '>100': number;
    };
  };
}
