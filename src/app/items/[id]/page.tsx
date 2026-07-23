/**
 * File: p2p-kids-admin/src/app/items/[id]/page.tsx
 * ADMIN-V3-005: Item detail page for category suggestion review context.
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

interface ItemRow {
  id: string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  price?: number | null;
  status?: string | null;
  seller_id?: string | null;
  category_id?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

interface SellerRow {
  id?: string;
  user_id?: string;
  email?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  name?: string | null;
}

interface CategoryRow {
  id?: string;
  name?: string | null;
  is_active?: boolean | null;
}

interface TaxCategoryRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const itemId = params?.id;

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [item, setItem] = useState<ItemRow | null>(null);
  const [seller, setSeller] = useState<SellerRow | null>(null);
  const [category, setCategory] = useState<CategoryRow | null>(null);
  const [taxCategory, setTaxCategory] = useState<TaxCategoryRow | null>(null);
  const [taxCategories, setTaxCategories] = useState<TaxCategoryRow[]>([]);
  const [showTaxCatSelector, setShowTaxCatSelector] = useState(false);
  const [selectedTaxCatId, setSelectedTaxCatId] = useState('');
  const [savingTaxCat, setSavingTaxCat] = useState(false);
  const [taxCatMsg, setTaxCatMsg] = useState<string | null>(null);
  const [taxCatErr, setTaxCatErr] = useState<string | null>(null);

  const loadItem = async () => {
    if (!itemId) {
      setErrorMessage('Missing item id');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .select('*')
        .eq('id', itemId)
        .maybeSingle();

      if (itemError) {
        throw itemError;
      }

      if (!itemData) {
        setErrorMessage('Item not found');
        setLoading(false);
        return;
      }

      const typedItem = itemData as ItemRow;
      setItem(typedItem);

      if (typedItem.seller_id) {
        const { data: sellerData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', typedItem.seller_id)
          .maybeSingle();

        if (sellerData) {
          setSeller(sellerData as SellerRow);
        }
      }

      if (typedItem.category_id) {
        const { data: categoryData } = await supabase
          .from('categories')
          .select('*')
          .eq('id', typedItem.category_id)
          .maybeSingle();

        if (categoryData) {
          setCategory(categoryData as CategoryRow);
        }
      }

      // tax-category-rules: load tax category info + full list for selector
      const [taxCatRes, taxCatsRes] = await Promise.all([
        typedItem.tax_category_id
          ? supabase.from('tax_categories').select('*').eq('id', typedItem.tax_category_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase.from('tax_categories').select('*').order('key', { ascending: true }),
      ]);

      if (taxCatsRes.data) {
        setTaxCategories(taxCatsRes.data as TaxCategoryRow[]);
      }
      if (taxCatRes.data) {
        setTaxCategory(taxCatRes.data as TaxCategoryRow);
        setSelectedTaxCatId(taxCatRes.data.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load item';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItem();
  }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const title = item?.title || item?.name || 'Untitled item';
  const sellerName = seller?.full_name || seller?.display_name || seller?.name || 'Unknown seller';

  /* ---- tax-category-rules: change item tax category ---- */
  const changeTaxCategory = async () => {
    if (!itemId || !selectedTaxCatId) return;
    setTaxCatErr(null);
    setTaxCatMsg(null);
    setSavingTaxCat(true);
    try {
      const { data, error } = await supabase.rpc('update_item_tax_category_admin', {
        p_item_id: itemId,
        p_tax_category_id: selectedTaxCatId,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: { message: string } };
      if (!result?.success) throw new Error(result?.error?.message ?? 'Update failed');
      setTaxCatMsg('Tax category updated.');
      setShowTaxCatSelector(false);
      // Reload item to reflect change
      const { data: freshItem } = await supabase.from('items').select('*').eq('id', itemId).maybeSingle();
      if (freshItem) {
        setItem(freshItem as ItemRow);
        const { data: freshTaxCat } = await supabase.from('tax_categories').select('*').eq('id', selectedTaxCatId).maybeSingle();
        if (freshTaxCat) setTaxCategory(freshTaxCat as TaxCategoryRow);
      }
      setTimeout(() => setTaxCatMsg(null), 5000);
    } catch (e: any) {
      setTaxCatErr(e?.message ?? 'Failed to update tax category');
    } finally {
      setSavingTaxCat(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-gray-600">Loading item details...</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">Item Details</h1>
        <p className="text-red-600">{errorMessage}</p>
        <div className="flex gap-3">
          <Link
            href="/categories"
            className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Back to Categories
          </Link>
          <Link
            href="/listings"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Open Listings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">Item Details</h1>
        <div className="flex gap-3">
          <Link
            href="/categories"
            className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Back to Categories
          </Link>
          <Link
            href="/listings"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Open Listings
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Item ID</dt>
            <dd className="mt-1 text-sm text-gray-900 break-all">{item?.id}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Title</dt>
            <dd className="mt-1 text-sm text-gray-900">{title}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Price</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {typeof item?.price === 'number' ? `$${item.price.toFixed(2)}` : 'N/A'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Status</dt>
            <dd className="mt-1 text-sm text-gray-900">{item?.status || 'unknown'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Seller</dt>
            <dd className="mt-1 text-sm text-gray-900">{sellerName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Seller Email</dt>
            <dd className="mt-1 text-sm text-gray-900">{seller?.email || 'N/A'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Category</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {category?.name || item?.category_id || 'Uncategorized'}
            </dd>
          </div>
          {/* tax-category-rules: Tax Category display + change */}
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-gray-500">Tax Category</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {taxCategory ? (
                <span>
                  {taxCategory.name}{' '}
                  <span className="text-xs text-gray-400">({taxCategory.key})</span>
                </span>
              ) : (
                <span className="text-gray-400">Not set (will backfill to general_tangible_goods)</span>
              )}
            </dd>
            {taxCatMsg && <p className="text-green-600 text-xs mt-1">{taxCatMsg}</p>}
            {taxCatErr && <p className="text-red-600 text-xs mt-1">{taxCatErr}</p>}
            {!showTaxCatSelector ? (
              <button
                onClick={() => { setShowTaxCatSelector(true); setTaxCatErr(null); setTaxCatMsg(null); }}
                className="mt-1 text-xs text-blue-600 hover:text-blue-800 underline"
                data-testid="change-tax-category-btn"
              >
                Change tax category
              </button>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <select
                  value={selectedTaxCatId}
                  onChange={(e) => setSelectedTaxCatId(e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                  data-testid="tax-category-select"
                >
                  {taxCategories.map((tc) => (
                    <option key={tc.id} value={tc.id}>
                      {tc.name} ({tc.key})
                    </option>
                  ))}
                </select>
                <button
                  onClick={changeTaxCategory}
                  disabled={savingTaxCat}
                  className="px-3 py-1 rounded bg-blue-600 text-white text-xs disabled:opacity-50"
                  data-testid="save-tax-category-btn"
                >
                  {savingTaxCat ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setShowTaxCatSelector(false)}
                  className="px-3 py-1 rounded border text-xs"
                  data-testid="cancel-tax-category-btn"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Created</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {item?.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}
            </dd>
          </div>
        </dl>

        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-900">Description</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
            {item?.description || 'No description provided.'}
          </p>
        </div>
      </div>
    </div>
  );
}
