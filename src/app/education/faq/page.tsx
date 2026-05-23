'use client';

// FILE: p2p-kids-admin/src/app/education/faq/page.tsx
// Main FAQ management page — composing FAQTable, FAQForm modal, and CategoryManager.

import { useState, useEffect, useCallback } from 'react';
import { Plus, BookOpen } from 'lucide-react';
import type { FaqItem, FaqCategory } from '../../../types/faq';
import { getAllFaqItems, getAllCategories } from '../../../lib/faqService';
import { FAQTable } from './components/FAQTable';
import { FAQForm } from './components/FAQForm';
import { CategoryManager } from './components/CategoryManager';
import { FAQAnalytics } from './components/FAQAnalytics';

type Tab = 'questions' | 'categories' | 'analytics';

export default function FAQPage() {
  const [activeTab, setActiveTab] = useState<Tab>('questions');
  const [items, setItems] = useState<FaqItem[]>([]);
  const [categories, setCategories] = useState<FaqCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<FaqItem | null | undefined>(undefined); // undefined = closed; null = create
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedItems, fetchedCats] = await Promise.all([
        getAllFaqItems(),
        getAllCategories(),
      ]);
      setItems(fetchedItems);
      setCategories(fetchedCats);
    } catch (err: any) {
      showToast('error', err.message ?? 'Failed to load FAQ data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const publishedCount = items.filter((i) => i.status === 'published').length;
  const draftCount = items.filter((i) => i.status === 'draft').length;
  const nextSortOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 1;

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <BookOpen size={20} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">FAQ Management</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Manage Help &amp; Support questions shown in the mobile app
              </p>
            </div>
          </div>
          <button
            onClick={() => setEditItem(null)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Add Question
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pt-6 space-y-6">
        {/* Stat chips */}
        <div className="flex gap-3 flex-wrap">
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-center min-w-[100px]">
            <p className="text-2xl font-bold text-gray-900">{items.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total FAQs</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-center min-w-[100px]">
            <p className="text-2xl font-bold text-green-600">{publishedCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Published</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-center min-w-[100px]">
            <p className="text-2xl font-bold text-yellow-600">{draftCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Drafts</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-center min-w-[100px]">
            <p className="text-2xl font-bold text-blue-600">{categories.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Categories</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 self-start w-fit">
          {(['questions', 'categories', 'analytics'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'questions' && (
              <FAQTable
                items={items}
                categories={categories}
                onEdit={(item) => setEditItem(item)}
                onRefresh={refresh}
                onError={(m) => showToast('error', m)}
                onSuccess={(m) => showToast('success', m)}
              />
            )}

            {activeTab === 'categories' && (
              <CategoryManager
                categories={categories}
                onRefresh={refresh}
                onError={(m) => showToast('error', m)}
                onSuccess={(m) => showToast('success', m)}
              />
            )}
            {activeTab === 'analytics' && (
              <FAQAnalytics
                items={items}
                categories={categories}
                onRefresh={refresh}
                onError={(m) => showToast('error', m)}
                onSuccess={(m) => showToast('success', m)}
              />
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {editItem !== undefined && (
        <FAQForm
          item={editItem}
          categories={categories}
          nextSortOrder={nextSortOrder}
          onClose={() => setEditItem(undefined)}
          onSuccess={(m) => { showToast('success', m); refresh(); }}
          onError={(m) => showToast('error', m)}
        />
      )}
    </div>
  );
}
