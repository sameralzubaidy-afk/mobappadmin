// FILE: p2p-kids-admin/src/__tests__/integration/category-suggestions.integration.test.ts
// Integration tests for category suggestions flow
// ADMIN-V3-005
// Run with: RUN_SUPABASE_E2E=true npm run test:e2e

import { createClient } from '@supabase/supabase-js';
import {
  getCategorySuggestions,
  approveCategorySuggestion,
  mergeCategorySuggestion,
  rejectCategorySuggestion,
  getPendingSuggestionCount,
} from '../../lib/categorySuggestionService';
import { getCategories, deleteCategory } from '../../lib/categoryService';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const describeIf = (condition: boolean) => (condition ? describe : describe.skip);

describeIf(process.env.RUN_SUPABASE_E2E === 'true')(
  'Category Suggestions Integration Tests',
  () => {
    let supabase: ReturnType<typeof createClient>;
    let testItemId: string;
    let testSellerId: string;
    let testSuggestionId: string;
    let createdCategoryId: string | null = null;

    beforeAll(async () => {
      supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // Create test seller
      const { data: seller, error: sellerError } = await supabase
        .from('profiles')
        .insert({
          user_id: 'test-seller-' + Date.now(),
          full_name: 'Test Seller',
          email: 'testseller@example.com',
        })
        .select()
        .single();

      if (sellerError) throw sellerError;
      testSellerId = seller.user_id;

      // Create test item
      const { data: item, error: itemError } = await supabase
        .from('items')
        .insert({
          seller_id: testSellerId,
          name: 'Test Item for Suggestion',
          description: 'Test item',
          price: 10.0,
          status: 'available',
          category_id: 'other-category-id', // Assumes "Other" category exists
        })
        .select()
        .single();

      if (itemError) throw itemError;
      testItemId = item.id;

      // Create test suggestion
      const { data: suggestion, error: suggestionError } = await supabase
        .from('category_suggestions')
        .insert({
          suggested_name: 'Test Category Suggestion',
          seller_id: testSellerId,
          item_id: testItemId,
          status: 'pending',
        })
        .select()
        .single();

      if (suggestionError) throw suggestionError;
      testSuggestionId = suggestion.id;
    });

    afterAll(async () => {
      // Clean up created category
      if (createdCategoryId) {
        try {
          await deleteCategory(createdCategoryId);
        } catch (err) {
          console.warn('Failed to delete test category:', err);
        }
      }

      // Clean up test data
      await supabase.from('category_suggestions').delete().eq('id', testSuggestionId);
      await supabase.from('items').delete().eq('id', testItemId);
      await supabase.from('profiles').delete().eq('user_id', testSellerId);
    });

    describe('getCategorySuggestions', () => {
      test('fetches pending suggestions with joined data', async () => {
        const suggestions = await getCategorySuggestions('pending', true);

        expect(Array.isArray(suggestions)).toBe(true);
        const testSuggestion = suggestions.find((s) => s.id === testSuggestionId);
        expect(testSuggestion).toBeDefined();
        expect(testSuggestion?.suggested_name).toBe('Test Category Suggestion');
        expect(testSuggestion?.seller).toBeDefined();
        expect(testSuggestion?.item).toBeDefined();
      });
    });

    describe('getPendingSuggestionCount', () => {
      test('returns accurate count of pending suggestions', async () => {
        const count = await getPendingSuggestionCount();
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThan(0);
      });
    });

    describe('approveCategorySuggestion', () => {
      test('creates category and reassigns item', async () => {
        const adminUserId = '11111111-1111-4111-8111-111111111111';

        await approveCategorySuggestion(
          testSuggestionId,
          {
            categoryData: {
              name: 'Approved Test Category ' + Date.now(),
              description: 'Created from suggestion',
              is_active: true,
            },
            reassignItem: true,
          },
          adminUserId
        );

        // Verify suggestion status changed
        const { data: updatedSuggestion } = await supabase
          .from('category_suggestions')
          .select('*')
          .eq('id', testSuggestionId)
          .single();

        expect(updatedSuggestion?.status).toBe('approved');
        expect(updatedSuggestion?.approved_by).toBe(adminUserId);
        expect(updatedSuggestion?.reviewed_at).not.toBeNull();

        // Verify item was reassigned
        const { data: updatedItem } = await supabase
          .from('items')
          .select('category_id')
          .eq('id', testItemId)
          .single();

        expect(updatedItem?.category_id).not.toBe('other-category-id');

        // Store category ID for cleanup
        if (updatedItem?.category_id) {
          createdCategoryId = updatedItem.category_id;
        }
      });
    });

    describe('mergeCategorySuggestion', () => {
      let mergeSuggestionId: string;
      let mergeItemId: string;
      let targetCategoryId: string;

      beforeAll(async () => {
        // Create another test item and suggestion for merge test
        const { data: item } = await supabase
          .from('items')
          .insert({
            seller_id: testSellerId,
            name: 'Merge Test Item',
            description: 'Test',
            price: 15.0,
            status: 'available',
            category_id: 'other-category-id',
          })
          .select()
          .single();

        mergeItemId = item!.id;

        const { data: suggestion } = await supabase
          .from('category_suggestions')
          .insert({
            suggested_name: 'Should Merge Category',
            seller_id: testSellerId,
            item_id: mergeItemId,
            status: 'pending',
          })
          .select()
          .single();

        mergeSuggestionId = suggestion!.id;

        // Get an existing active category
        const categories = await getCategories(false);
        targetCategoryId = categories[0].id;
      });

      afterAll(async () => {
        await supabase.from('category_suggestions').delete().eq('id', mergeSuggestionId);
        await supabase.from('items').delete().eq('id', mergeItemId);
      });

      test('merges suggestion into existing category', async () => {
        const adminUserId = '22222222-2222-4222-8222-222222222222';

        await mergeCategorySuggestion(
          mergeSuggestionId,
          {
            target_category_id: targetCategoryId,
            admin_note: 'Merging into existing category',
          },
          adminUserId
        );

        // Verify suggestion status
        const { data: updatedSuggestion } = await supabase
          .from('category_suggestions')
          .select('*')
          .eq('id', mergeSuggestionId)
          .single();

        expect(updatedSuggestion?.status).toBe('merged');
        expect(updatedSuggestion?.merged_to_category_id).toBe(targetCategoryId);
        expect(updatedSuggestion?.admin_note).toBe('Merging into existing category');

        // Verify item reassigned
        const { data: updatedItem } = await supabase
          .from('items')
          .select('category_id')
          .eq('id', mergeItemId)
          .single();

        expect(updatedItem?.category_id).toBe(targetCategoryId);
      });
    });

    describe('rejectCategorySuggestion', () => {
      let rejectSuggestionId: string;

      beforeAll(async () => {
        // Create another test suggestion for reject test
        const { data: item } = await supabase
          .from('items')
          .insert({
            seller_id: testSellerId,
            name: 'Reject Test Item',
            description: 'Test',
            price: 20.0,
            status: 'available',
            category_id: 'other-category-id',
          })
          .select()
          .single();

        const { data: suggestion } = await supabase
          .from('category_suggestions')
          .insert({
            suggested_name: 'Should Reject Category',
            seller_id: testSellerId,
            item_id: item!.id,
            status: 'pending',
          })
          .select()
          .single();

        rejectSuggestionId = suggestion!.id;
      });

      afterAll(async () => {
        await supabase.from('category_suggestions').delete().eq('id', rejectSuggestionId);
      });

      test('rejects suggestion with admin note', async () => {
        const adminUserId = '33333333-3333-4333-8333-333333333333';

        await rejectCategorySuggestion(
          rejectSuggestionId,
          {
            admin_note: 'Too specific, use existing category',
          },
          adminUserId
        );

        // Verify suggestion status
        const { data: updatedSuggestion } = await supabase
          .from('category_suggestions')
          .select('*')
          .eq('id', rejectSuggestionId)
          .single();

        expect(updatedSuggestion?.status).toBe('rejected');
        expect(updatedSuggestion?.approved_by).toBe(adminUserId);
        expect(updatedSuggestion?.admin_note).toBe('Too specific, use existing category');
        expect(updatedSuggestion?.reviewed_at).not.toBeNull();
      });
    });
  }
);
