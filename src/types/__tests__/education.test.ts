// FILE: admin-portal/src/types/__tests__/education.test.ts
// MODULE-18 V1 EDU-002: Unit tests for admin education types

import {
  SectionType,
  EducationSection,
  CreateSectionInput,
  UpdateSectionInput,
  EducationExample,
  CreateExampleInput,
  UpdateExampleInput,
  SPCalculation,
  SellSPCalculation,
  BuySPCalculation,
  BonusCategory,
  EducationAnalyticsEventType,
  EducationAnalyticsEvent,
  EducationAnalytics,
} from '../education';

describe('Admin Education Types', () => {
  describe('EducationSection (admin view)', () => {
    it('should include admin-only fields', () => {
      const section: EducationSection = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'How Swap Points Work',
        body: 'Swap Points are earned when you sell items...',
        image_url: 'https://example.supabase.co/storage/v1/object/public/images/sp-illustration.png',
        display_order: 1,
        section_type: 'sp_definition',
        is_published: true,
        published_at: '2026-04-20T12:00:00Z',
        published_by: 'admin-user-123', // Admin-only field
        created_at: '2026-04-20T11:00:00Z',
        updated_at: '2026-04-20T11:30:00Z', // Admin-only field
      };

      expect(section.published_by).toBe('admin-user-123');
      expect(section.updated_at).toBe('2026-04-20T11:30:00Z');
    });

    it('should allow null for admin-only fields', () => {
      const section: EducationSection = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Draft Section',
        body: 'This is a draft...',
        image_url: null,
        display_order: 2,
        section_type: 'general',
        is_published: false,
        published_at: null,
        published_by: null, // Not yet published
        created_at: '2026-04-20T11:00:00Z',
        updated_at: '2026-04-20T11:00:00Z',
      };

      expect(section.published_by).toBeNull();
    });
  });

  describe('CreateSectionInput', () => {
    it('should have all required fields for creation', () => {
      const input: CreateSectionInput = {
        title: 'Safety Tips',
        body: 'Always meet in public places...',
        image_url: 'https://example.supabase.co/storage/v1/object/public/images/safety.png',
        display_order: 5,
        section_type: 'safety',
      };

      expect(input.title).toBe('Safety Tips');
      expect(input.section_type).toBe('safety');
    });

    it('should allow optional image_url', () => {
      const input: CreateSectionInput = {
        title: 'General Info',
        body: 'Welcome to our marketplace...',
        display_order: 1,
        section_type: 'general',
      };

      expect(input.image_url).toBeUndefined();
    });
  });

  describe('UpdateSectionInput', () => {
    it('should allow partial updates', () => {
      const input: UpdateSectionInput = {
        title: 'Updated Title',
      };

      expect(input.title).toBe('Updated Title');
      expect(input.body).toBeUndefined();
      expect(input.display_order).toBeUndefined();
    });

    it('should allow updating all fields', () => {
      const input: UpdateSectionInput = {
        title: 'New Title',
        body: 'New body text...',
        image_url: 'https://example.supabase.co/storage/v1/object/public/images/new.png',
        display_order: 10,
      };

      expect(Object.keys(input).length).toBe(4);
    });
  });

  describe('EducationExample (admin view)', () => {
    it('should include updated_at field', () => {
      const example: EducationExample = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        item_name: 'LEGO Set',
        item_price: 25.99,
        category_id: 'cat-toys-123',
        display_order: 1,
        is_published: true,
        created_at: '2026-04-20T11:00:00Z',
        updated_at: '2026-04-20T11:30:00Z', // Admin-only field
      };

      expect(example.updated_at).toBe('2026-04-20T11:30:00Z');
    });
  });

  describe('CreateExampleInput', () => {
    it('should have all required fields', () => {
      const input: CreateExampleInput = {
        item_name: 'LEGO Set',
        item_price: 25.99,
        category_id: 'cat-toys-123',
        display_order: 1,
      };

      expect(input.item_name).toBe('LEGO Set');
      expect(input.item_price).toBe(25.99);
    });

    it('should allow optional category_id', () => {
      const input: CreateExampleInput = {
        item_name: 'Mystery Item',
        item_price: 10.00,
        display_order: 2,
      };

      expect(input.category_id).toBeUndefined();
    });
  });

  describe('UpdateExampleInput', () => {
    it('should allow partial updates', () => {
      const input: UpdateExampleInput = {
        item_price: 29.99,
      };

      expect(input.item_price).toBe(29.99);
      expect(input.item_name).toBeUndefined();
    });
  });

  describe('SPCalculation (admin mirror)', () => {
    it('should match mobile sell mode structure', () => {
      const calculation: SellSPCalculation = {
        mode: 'sell',
        price: 25.00,
        category_id: 'cat-books-456',
        category_name: 'Books',
        earn_sp: 33,
        multiplier: 1.30,
        is_bonus: true,
      };

      expect(calculation.mode).toBe('sell');
      expect(calculation.earn_sp).toBe(33);
    });

    it('should match mobile buy mode structure', () => {
      const calculation: BuySPCalculation = {
        mode: 'buy',
        price: 25.00,
        category_id: 'cat-books-456',
        category_name: 'Books',
        max_sp_usable: 18,
        sp_spending_cap_percent: 75,
        sp_to_use: 15,
        cash_paid: 10.00,
        fee: 2.50,
        total_cost: 12.50,
        is_bonus: true,
      };

      expect(calculation.mode).toBe('buy');
      expect(calculation.total_cost).toBe(12.50);
    });
  });

  describe('BonusCategory (admin duplicate)', () => {
    it('should match mobile structure exactly', () => {
      const bonusCategory: BonusCategory = {
        id: 'cat-books-456',
        name: 'Books',
        icon: '📚',
        icon_url: null,
        bonus_badge_icon_url: null,
        sp_earning_multiplier: 1.30,
        sp_spending_cap_percent: 75,
        item_count: 42,
      };

      expect(bonusCategory.sp_earning_multiplier).toBeGreaterThan(1.10);
    });
  });

  describe('EducationAnalytics', () => {
    it('should have all aggregation sections', () => {
      const analytics: EducationAnalytics = {
        onboarding: {
          started: 1000,
          completed: 750,
          skipped: 200,
          completionRate: 75.0,
        },
        help: {
          views: 500,
          uniqueUsers: 300,
          sectionExpansionsByType: {
            general: 100,
            sp_definition: 200,
            sp_earning: 150,
            sp_spending: 180,
            safety: 120,
            example: 50,
          },
        },
        calculator: {
          uses: 800,
          uniqueUsers: 400,
          priceBucketHistogram: {
            '<10': 100,
            '10-50': 500,
            '50-100': 150,
            '>100': 50,
          },
        },
      };

      expect(analytics.onboarding.completionRate).toBe(75.0);
      expect(analytics.help.uniqueUsers).toBe(300);
      expect(analytics.calculator.priceBucketHistogram['10-50']).toBe(500);
    });

    it('should calculate completion rate correctly', () => {
      const analytics: EducationAnalytics = {
        onboarding: {
          started: 100,
          completed: 60,
          skipped: 30,
          completionRate: 60.0, // 60/100 = 60%
        },
        help: {
          views: 0,
          uniqueUsers: 0,
          sectionExpansionsByType: {
            general: 0,
            sp_definition: 0,
            sp_earning: 0,
            sp_spending: 0,
            safety: 0,
            example: 0,
          },
        },
        calculator: {
          uses: 0,
          uniqueUsers: 0,
          priceBucketHistogram: {
            '<10': 0,
            '10-50': 0,
            '50-100': 0,
            '>100': 0,
          },
        },
      };

      expect(analytics.onboarding.started).toBe(
        analytics.onboarding.completed + analytics.onboarding.skipped + 10 // 10 in-progress
      );
    });
  });

  describe('Type compatibility with mobile', () => {
    it('should NOT import from p2p-kids-marketplace', () => {
      // This test ensures packages remain independent
      // If this test fails, remove any direct imports from mobile package
      const fileContent = require('fs').readFileSync(
        __filename.replace('__tests__/education.test.ts', 'education.ts'),
        'utf-8'
      );

      // Check for actual import statements, not comments
      const importPattern = /^import .* from ['"].*p2p-kids-marketplace.*['"];?$/gm;
      const hasImport = importPattern.test(fileContent);

      expect(hasImport).toBe(false);
    });
  });
});
