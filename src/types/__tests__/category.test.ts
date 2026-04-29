// FILE: p2p-kids-admin/src/types/__tests__/category.test.ts
// ADMIN-V3-002: Unit tests for category types
// Module: MODULE-12-ADMIN-V3-CATEGORIES

import type {
  Category,
  CreateCategoryInput,
  UpdateCategoryInput,
  SuggestionStatus,
  CategorySuggestion,
  BonusCategory,
  CategorySPAnalytics,
  AnomalyFlag,
  ValidationResult,
  CategorySPPreview,
  CategoryReorderItem,
  IconType,
} from '../category';

describe('Category Type Definitions', () => {
  describe('Category interface', () => {
    it('should accept a valid category object with all required fields', () => {
      const category: Category = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Books',
        description: 'Educational books for kids',
        icon: '📚',
        icon_url: null,
        bonus_badge_icon_url: null,
        is_active: true,
        item_count: 42,
        display_order: 1,
        sp_earning_multiplier: 1.15,
        sp_spending_cap_percent: 70,
        sp_config_notes: 'Bonus category for educational items',
        sp_rate_change_notify: false,
        created_at: '2026-04-20T10:00:00Z',
        updated_at: '2026-04-20T10:00:00Z',
      };

      expect(category.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(category.name).toBe('Books');
      expect(category.sp_earning_multiplier).toBe(1.15);
      expect(category.item_count).toBe(42);
    });

    it('should allow null for optional fields', () => {
      const category: Category = {
        id: '123',
        name: 'Other',
        description: null,
        icon: null,
        icon_url: null,
        bonus_badge_icon_url: null,
        is_active: true,
        item_count: 0,
        display_order: 999,
        sp_earning_multiplier: 1.10,
        sp_spending_cap_percent: 70,
        sp_config_notes: null,
        sp_rate_change_notify: false,
        created_at: '2026-04-20T10:00:00Z',
        updated_at: '2026-04-20T10:00:00Z',
      };

      expect(category.description).toBeNull();
      expect(category.icon).toBeNull();
    });
  });

  describe('CreateCategoryInput interface', () => {
    it('should accept minimal required fields', () => {
      const input: CreateCategoryInput = {
        name: 'New Category',
      };

      expect(input.name).toBe('New Category');
      expect(input.description).toBeUndefined();
    });

    it('should accept all optional fields', () => {
      const input: CreateCategoryInput = {
        name: 'Books',
        description: 'Educational books',
        icon: '📚',
        icon_url: 'https://example.com/icon.png',
        bonus_badge_icon_url: 'https://example.com/badge.png',
        sp_earning_multiplier: 1.20,
        sp_spending_cap_percent: 75,
        sp_config_notes: 'High-value category',
        is_active: true,
      };

      expect(input.sp_earning_multiplier).toBe(1.20);
      expect(input.sp_spending_cap_percent).toBe(75);
    });
  });

  describe('UpdateCategoryInput interface', () => {
    it('should allow partial updates', () => {
      const update: UpdateCategoryInput = {
        name: 'Updated Name',
      };

      expect(update.name).toBe('Updated Name');
      expect(update.sp_earning_multiplier).toBeUndefined();
    });

    it('should allow SP rate updates', () => {
      const update: UpdateCategoryInput = {
        sp_earning_multiplier: 1.25,
        sp_spending_cap_percent: 80,
        sp_rate_change_notify: true,
      };

      expect(update.sp_earning_multiplier).toBe(1.25);
      expect(update.sp_rate_change_notify).toBe(true);
    });

    it('should not allow item_count or display_order updates (commented in type)', () => {
      // This is a compile-time check; if item_count were added, TypeScript would error
      const update: UpdateCategoryInput = {
        name: 'Test',
        // item_count: 100, // Should not exist
        // display_order: 5, // Should not exist
      };

      expect(update.name).toBe('Test');
    });
  });

  describe('SuggestionStatus type', () => {
    it('should accept all valid statuses', () => {
      const statuses: SuggestionStatus[] = ['pending', 'approved', 'rejected', 'merged'];

      expect(statuses).toHaveLength(4);
      expect(statuses).toContain('pending');
      expect(statuses).toContain('approved');
      expect(statuses).toContain('rejected');
      expect(statuses).toContain('merged');
    });

    it('should enforce type safety', () => {
      const status: SuggestionStatus = 'pending';
      // @ts-expect-error - invalid status
      const invalidStatus: SuggestionStatus = 'invalid';
      
      expect(status).toBe('pending');
    });
  });

  describe('CategorySuggestion interface', () => {
    it('should accept a complete suggestion object', () => {
      const suggestion: CategorySuggestion = {
        id: '456',
        suggested_name: 'Science Kits',
        seller_id: 'user-123',
        item_id: 'item-789',
        status: 'pending',
        approved_by: null,
        merged_to_category_id: null,
        admin_note: null,
        created_at: '2026-04-20T10:00:00Z',
        reviewed_at: null,
      };

      expect(suggestion.status).toBe('pending');
      expect(suggestion.approved_by).toBeNull();
    });

    it('should accept optional joined data', () => {
      const suggestion: CategorySuggestion = {
        id: '456',
        suggested_name: 'Science Kits',
        seller_id: 'user-123',
        item_id: 'item-789',
        status: 'approved',
        approved_by: 'admin-999',
        merged_to_category_id: null,
        admin_note: 'Good suggestion',
        created_at: '2026-04-20T10:00:00Z',
        reviewed_at: '2026-04-21T10:00:00Z',
        seller: {
          id: 'user-123',
          full_name: 'John Doe',
          email: 'john@example.com',
        },
        item: {
          id: 'item-789',
          name: 'Science Kit',
          status: 'available',
        },
      };

      expect(suggestion.seller?.full_name).toBe('John Doe');
      expect(suggestion.item?.name).toBe('Science Kit');
    });
  });

  describe('BonusCategory interface', () => {
    it('should represent a bonus category', () => {
      const bonusCategory: BonusCategory = {
        id: '123',
        name: 'Books',
        icon: '📚',
        icon_url: null,
        bonus_badge_icon_url: 'https://example.com/star.png',
        sp_earning_multiplier: 1.25, // > 1.10
        sp_spending_cap_percent: 70,
        item_count: 50,
      };

      expect(bonusCategory.sp_earning_multiplier).toBeGreaterThan(1.10);
      expect(bonusCategory.item_count).toBe(50);
    });
  });

  describe('CategorySPAnalytics interface', () => {
    it('should represent SP analytics data', () => {
      const analytics: CategorySPAnalytics = {
        category_id: '123',
        category_name: 'Books',
        velocity: 1.5, // SP earned / SP spent
        gap_percent: 8.5, // (available - spent) / available * 100
        avg_cash_per_trade: 15.75,
        anomaly_flags: ['low_velocity'],
      };

      expect(analytics.velocity).toBe(1.5);
      expect(analytics.anomaly_flags).toContain('low_velocity');
    });

    it('should accept multiple anomaly flags', () => {
      const analytics: CategorySPAnalytics = {
        category_id: '456',
        category_name: 'Toys',
        velocity: 0.3,
        gap_percent: 15,
        avg_cash_per_trade: 20.0,
        anomaly_flags: ['hoarding', 'low_velocity'],
      };

      expect(analytics.anomaly_flags).toHaveLength(2);
      expect(analytics.anomaly_flags).toContain('hoarding');
    });

    it('should accept empty anomaly flags', () => {
      const analytics: CategorySPAnalytics = {
        category_id: '789',
        category_name: 'Games',
        velocity: 1.0,
        gap_percent: 5,
        avg_cash_per_trade: 12.5,
        anomaly_flags: [],
      };

      expect(analytics.anomaly_flags).toHaveLength(0);
    });
  });

  describe('AnomalyFlag type', () => {
    it('should accept all valid flags', () => {
      const flags: AnomalyFlag[] = ['hoarding', 'low_velocity', 'spending_spike'];

      expect(flags).toHaveLength(3);
    });
  });

  describe('ValidationResult interface', () => {
    it('should represent a valid result', () => {
      const result: ValidationResult = {
        valid: true,
      };

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should represent an invalid result with error', () => {
      const result: ValidationResult = {
        valid: false,
        error: 'Category name must be 3-50 characters',
      };

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Category name must be 3-50 characters');
    });
  });

  describe('CategorySPPreview interface', () => {
    it('should represent SP preview calculation', () => {
      const preview: CategorySPPreview = {
        price: 50,
        earn_sp: 58, // Math.round(50 * 1.15)
        max_spend_sp: 35, // Math.floor(50 * 70 / 100)
        spend_percent: 70,
      };

      expect(preview.price).toBe(50);
      expect(preview.earn_sp).toBe(58);
      expect(preview.max_spend_sp).toBe(35);
    });
  });

  describe('CategoryReorderItem interface', () => {
    it('should represent reorder payload', () => {
      const reorderItem: CategoryReorderItem = {
        id: '123',
        display_order: 5,
      };

      expect(reorderItem.id).toBe('123');
      expect(reorderItem.display_order).toBe(5);
    });
  });

  describe('IconType type', () => {
    it('should accept valid icon types', () => {
      const type1: IconType = 'category';
      const type2: IconType = 'bonus_badge';

      expect(type1).toBe('category');
      expect(type2).toBe('bonus_badge');
    });
  });
});
