'use client';

/**
 * File: p2p-kids-admin/src/app/tax/category-mapping/page.tsx
 * Category-tax-mapping: Admin UI for managing product-category-to-tax-category
 * mappings.
 *
 * CRUD operations via RPCs:
 *   - list_category_tax_mappings  (read — joins categories + tax_categories)
 *   - list_tax_categories         (read — for the edit dropdown)
 *   - upsert_category_tax_mapping (create/update — audited)
 *
 * Rules:
 *   - Unmapped categories fall back to general_tangible_goods (backward compatible).
 *   - Changes take effect immediately for NEW listings (trigger reads mapping on INSERT).
 *   - Existing items are NOT retroactively updated (use per-item override via
 *     update_item_tax_category_admin for corrections).
 *   - Admin-only access (enforced server-side by RPC).
 */

import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface CategoryMapping {
  id: string;
  category_id: string;
  category_name: string;
  category_icon: string | null;
  tax_category_id: string;
  tax_category_key: string;
  tax_category_name: string;
  created_at: string;
  updated_at: string;
}

interface TaxCategory {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function CategoryTaxMappingPage() {
  const [mappings, setMappings] = useState<CategoryMapping[]>([]);
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [confirmReset, setConfirmReset] = useState<string | null>(null);

  /* ---- Load data ---- */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mapRes, taxCatRes] = await Promise.all([
        supabase.rpc('list_category_tax_mappings'),
        supabase.rpc('list_tax_categories'),
      ]);
      if (mapRes.error) throw mapRes.error;
      if (taxCatRes.error) throw taxCatRes.error;
      setMappings((mapRes.data ?? []) as CategoryMapping[]);
      setTaxCategories((taxCatRes.data ?? []) as TaxCategory[]);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ---- Open edit for a mapping ---- */
  const openEdit = (mapping: CategoryMapping) => {
    setEditingCategoryId(mapping.category_id);
    setEditValue(mapping.tax_category_id);
    setError(null);
  };

  /* ---- Save a single mapping ---- */
  const save = async () => {
    if (!editingCategoryId || !editValue) return;
    setSaving(editingCategoryId);
    setError(null);
    setSuccess(null);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'upsert_category_tax_mapping',
        {
          p_category_id: editingCategoryId,
          p_tax_category_id: editValue,
        }
      );

      if (rpcError) throw rpcError;

      const result = data as { success: boolean; error?: { message: string } };
      if (!result?.success) {
        throw new Error(result?.error?.message ?? 'Save failed');
      }

      setSuccess('Mapping updated. New listings will use the updated tax category.');
      setEditingCategoryId(null);
      setEditValue('');
      await load();
      setTimeout(() => setSuccess(null), 5000);
    } catch (e: any) {
      setError(e?.message ?? 'Save failed');
    } finally {
      setSaving(null);
    }
  };

  /* ---- Cancel edit ---- */
  const cancelEdit = () => {
    setEditingCategoryId(null);
    setEditValue('');
    setError(null);
  };

  /* ---- Reset to default ---- */
  const resetToDefault = async () => {
    if (!confirmReset) return;
    setSaving(confirmReset);
    setError(null);
    setSuccess(null);

    try {
      // Look up the general_tangible_goods tax category ID
      const generalCat = taxCategories.find((tc) => tc.key === 'general_tangible_goods');
      if (!generalCat) throw new Error('Default tax category not found');

      const { data, error: rpcError } = await supabase.rpc(
        'upsert_category_tax_mapping',
        {
          p_category_id: confirmReset,
          p_tax_category_id: generalCat.id,
        }
      );

      if (rpcError) throw rpcError;

      const result = data as { success: boolean; error?: { message: string } };
      if (!result?.success) {
        throw new Error(result?.error?.message ?? 'Reset failed');
      }

      const categoryName = mappings.find((m) => m.category_id === confirmReset)?.category_name ?? confirmReset;
      setSuccess(`"${categoryName}" reset to General Tangible Goods.`);
      setConfirmReset(null);
      await load();
      setTimeout(() => setSuccess(null), 5000);
    } catch (e: any) {
      setError(e?.message ?? 'Reset failed');
    } finally {
      setSaving(null);
    }
  };

  /* ---- Get display name for a tax category ID ---- */
  const getTaxCategoryName = (id: string): string => {
    const tc = taxCategories.find((c) => c.id === id);
    return tc ? `${tc.name} (${tc.key})` : id;
  };

  /* ---- Get the fallback display for unmapped categories ---- */
  const isMappingToDefault = (mapping: CategoryMapping): boolean => {
    const generalCat = taxCategories.find((tc) => tc.key === 'general_tangible_goods');
    return generalCat ? mapping.tax_category_id === generalCat.id : true;
  };

  /* ============================================================== */
  /*  Render                                                        */
  /* ============================================================== */

  return (
    <div className="p-6" data-testid="category-tax-mapping-page">
      <h1 className="text-2xl font-semibold mb-1">Product Category → Tax Category Mapping</h1>
      <p className="text-sm text-gray-600 mb-4">
        Configure which tax category is automatically assigned to each product category
        when a seller creates a new listing. Changes apply immediately to <strong>new</strong>{' '}
        listings only — existing items are not retroactively updated.
      </p>

      {/* Help text */}
      <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded p-3 mb-4 text-sm">
        <strong>ℹ️ How mapping works</strong><br />
        When a seller selects a product category (e.g., "Books") and creates a listing,
        the system looks up this mapping to assign a tax category. The applicable tax rule
        is then determined from the assigned tax category's effective-dated rules.
        <br /><br />
        <strong>Examples (CT default):</strong>
        <ul className="list-disc ml-4 mt-1">
          <li>Books → Tax Exempt Goods → 0% tax</li>
          <li>Clothing → Clothing and Footwear → category-specific thresholds</li>
          <li>Toys, Electronics, etc. → General Tangible Goods → 6.35% tax</li>
        </ul>
        <br />
        To override an <em>individual</em> listing&apos;s tax category, use the
        Item Detail page &rarr; Change tax category.
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 rounded p-3 mb-4" data-testid="ctm-error">
          {error}
          <button className="ml-2 font-bold" onClick={() => setError(null)}>×</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-300 text-green-700 rounded p-3 mb-4" data-testid="ctm-success">
          {success}
          <button className="ml-2 font-bold" onClick={() => setSuccess(null)}>×</button>
        </div>
      )}

      {/* ---- Reset Confirmation Modal ---- */}
      {confirmReset && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => setConfirmReset(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
            data-testid="ctm-reset-modal"
          >
            <h3 className="text-lg font-semibold mb-2">Reset to General Tangible Goods?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will change the mapping for this product category back to
              &ldquo;General Tangible Goods.&rdquo; New listings in this category will
              default to standard tax treatment. Existing items are not affected.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmReset(null)}
                className="px-4 py-2 rounded border text-sm"
              >
                Cancel
              </button>
              <button
                onClick={resetToDefault}
                className="px-4 py-2 rounded bg-red-600 text-white text-sm"
                data-testid="ctm-reset-confirm"
              >
                Reset to Default
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Mappings Table ---- */}
      {loading ? (
        <div className="text-gray-500">Loading mappings…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border" data-testid="ctm-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2 border-b">Category</th>
                <th className="text-left p-2 border-b">Current Tax Category</th>
                <th className="text-left p-2 border-b">Last Updated</th>
                <th className="text-left p-2 border-b">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-500">
                    No mappings found. Run the database migration to seed initial mappings.
                  </td>
                </tr>
              ) : (
                mappings.map((mapping) => (
                  <tr
                    key={mapping.id}
                    className="border-b hover:bg-gray-50"
                    data-testid={`ctm-row-${mapping.category_id}`}
                  >
                    {/* Category name */}
                    <td className="p-2 font-medium">
                      {mapping.category_icon && (
                        <span className="mr-2">{mapping.category_icon}</span>
                      )}
                      {mapping.category_name}
                    </td>

                    {/* Current tax category / edit form */}
                    <td className="p-2">
                      {editingCategoryId === mapping.category_id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="border rounded px-2 py-1 text-sm w-64"
                            data-testid={`ctm-select-${mapping.category_id}`}
                          >
                            <option value="">Select tax category…</option>
                            {taxCategories
                              .filter((tc) => tc.is_active)
                              .map((tc) => (
                                <option key={tc.id} value={tc.id}>
                                  {tc.name} ({tc.key})
                                </option>
                              ))}
                          </select>
                          <button
                            onClick={save}
                            disabled={saving === mapping.category_id || !editValue}
                            className="px-3 py-1 rounded bg-green-600 text-white text-xs disabled:opacity-50 hover:bg-green-700"
                            data-testid={`ctm-save-${mapping.category_id}`}
                          >
                            {saving === mapping.category_id ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={saving === mapping.category_id}
                            className="px-3 py-1 rounded border text-xs disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <span className={`font-medium ${
                          mapping.tax_category_key === 'tax_exempt_goods'
                            ? 'text-green-600'
                            : mapping.tax_category_key === 'clothing_footwear'
                            ? 'text-blue-600'
                            : ''
                        }`}>
                          {mapping.tax_category_name}
                          <span className="text-gray-400 ml-1">({mapping.tax_category_key})</span>
                        </span>
                      )}
                    </td>

                    {/* Last updated */}
                    <td className="p-2 text-xs text-gray-500">
                      {fmtDate(mapping.updated_at ?? mapping.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="p-2">
                      {editingCategoryId !== mapping.category_id && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEdit(mapping)}
                            className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs hover:bg-blue-200"
                            data-testid={`ctm-edit-${mapping.category_id}`}
                          >
                            Change
                          </button>
                          {!isMappingToDefault(mapping) && (
                            <button
                              onClick={() => setConfirmReset(mapping.category_id)}
                              className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs hover:bg-red-200"
                              data-testid={`ctm-reset-${mapping.category_id}`}
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- Legend ---- */}
      <div className="mt-6 p-4 bg-gray-50 rounded border text-sm">
        <h3 className="font-semibold mb-2">Legend</h3>
        <ul className="space-y-1 text-gray-700">
          <li>
            <span className="text-green-600 font-medium">Green</span> — Tax Exempt Goods
            (items in this category are not subject to sales tax)
          </li>
          <li>
            <span className="text-blue-600 font-medium">Blue</span> — Clothing and Footwear
            (category-specific price thresholds may apply)
          </li>
          <li>
            <strong>Default</strong> — General Tangible Goods (standard sales tax rate applies)
          </li>
        </ul>
      </div>
    </div>
  );
}
