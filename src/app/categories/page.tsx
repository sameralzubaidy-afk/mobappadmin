'use client';

// FILE: p2p-kids-admin/src/app/categories/page.tsx
// ADMIN-V3-004: Category Management Page (main container)
// Module: MODULE-12-ADMIN-V3-CATEGORIES

import { useState, useEffect, useCallback } from 'react';
import { CategoryTable } from './components/CategoryTable';
import { CategoryForm } from './components/CategoryForm';
import { CategorySuggestionsList } from './components/CategorySuggestionsList';
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '../../types/category';
import { getCategories } from '../../lib/categoryService';
import { getPendingSuggestionCount } from '../../lib/categorySuggestionService';

type FilterTab = 'all' | 'active' | 'inactive' | 'bonus';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'categories' | 'suggestions'>('categories');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [pendingSuggestionCount, setPendingSuggestionCount] = useState(0);

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Debounce search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load categories on mount
  useEffect(() => {
    loadCategories();
    loadPendingCount();
  }, []);

  // Poll pending count every 60s
  useEffect(() => {
    const interval = setInterval(loadPendingCount, 60000);
    return () => clearInterval(interval);
  }, []);

  // Filter categories when search/filter changes
  useEffect(() => {
    applyFilters();
  }, [categories, debouncedSearch, filterTab]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCategories(true); // Include inactive for admin
      setCategories(data);
    } catch (err: any) {
      console.error('Error loading categories:', err);
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const loadPendingCount = async () => {
    try {
      const count = await getPendingSuggestionCount();
      setPendingSuggestionCount(count);
    } catch (err: any) {
      console.error('Error loading pending count:', err);
    }
  };

  const applyFilters = useCallback(() => {
    let filtered = [...categories];

    // Apply filter tab
    if (filterTab === 'active') {
      filtered = filtered.filter((c) => c.is_active);
    } else if (filterTab === 'inactive') {
      filtered = filtered.filter((c) => !c.is_active);
    } else if (filterTab === 'bonus') {
      filtered = filtered.filter(
        (c) => c.is_active && Number(c.sp_earning_multiplier) > 1.10
      );
    }

    // Apply search
    if (debouncedSearch.trim()) {
      const search = debouncedSearch.toLowerCase();
      filtered = filtered.filter((c) => c.name.toLowerCase().includes(search));
    }

    setFilteredCategories(filtered);
  }, [categories, debouncedSearch, filterTab]);

  const handleCreateCategory = () => {
    setEditingCategory(null);
    setShowCategoryForm(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setShowCategoryForm(true);
  };

  const handleCategoryFormClose = () => {
    setShowCategoryForm(false);
    setEditingCategory(null);
  };

  const handleCategoryFormSuccess = (message: string) => {
    setShowCategoryForm(false);
    setEditingCategory(null);
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 4000);
    loadCategories();
  };

  const handleCategoryUpdated = () => {
    loadCategories();
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-gray-600">Loading categories...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="page-title">
            Category Management
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage product categories, SP rates, and seller suggestions
          </p>
        </div>
        <button
          onClick={handleCreateCategory}
          data-testid="create-category-btn"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          + New Category
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div
          className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md"
          data-testid="success-message"
        >
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md"
          data-testid="error-message"
        >
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('categories')}
            data-testid="tab-categories"
            className={`${
              activeTab === 'categories'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Categories ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab('suggestions')}
            data-testid="tab-suggestions"
            className={`${
              activeTab === 'suggestions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            Suggestions
            {pendingSuggestionCount > 0 && (
              <span
                data-testid="suggestions-badge"
                className="ml-2 px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-800 rounded-full"
              >
                {pendingSuggestionCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Categories Tab Content */}
      {activeTab === 'categories' && (
        <>
          {/* Search + Filters */}
          <div className="mb-6 space-y-4">
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="category-search"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Filter Tabs */}
            <div className="flex space-x-4">
              {(['all', 'active', 'inactive', 'bonus'] as FilterTab[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setFilterTab(filter)}
                  data-testid={`filter-${filter}`}
                  className={`${
                    filterTab === filter
                      ? 'bg-blue-100 text-blue-800 font-semibold'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } px-4 py-2 rounded-md text-sm transition-colors`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {filterTab === 'bonus' && filteredCategories.length === 0 && (
            <div
              className="p-3 rounded-md border border-amber-200 bg-amber-50"
              data-testid="bonus-filter-empty-hint"
            >
              <p className="text-sm text-amber-800">
                No active bonus categories yet. Set SP Earn above 1.10x on an active category
                to populate this tab.
              </p>
            </div>
          )}

          {/* Category Table */}
          <CategoryTable
            categories={filteredCategories}
            onEdit={handleEditCategory}
            onUpdate={handleCategoryUpdated}
          />
        </>
      )}

      {/* Suggestions Tab Content */}
      {activeTab === 'suggestions' && (
        <CategorySuggestionsList
          onCountChange={setPendingSuggestionCount}
          onActionSuccess={loadCategories}
        />
      )}

      {/* Category Form Modal */}
      {showCategoryForm && (
        <CategoryForm
          category={editingCategory}
          onClose={handleCategoryFormClose}
          onSuccess={handleCategoryFormSuccess}
        />
      )}
    </div>
  );
}
