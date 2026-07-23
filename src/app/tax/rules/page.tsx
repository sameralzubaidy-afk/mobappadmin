'use client';

/**
 * File: p2p-kids-admin/src/app/tax/rules/page.tsx
 * Tax-category-rules: Admin UI for managing versioned/effective-dated tax rules
 * per catalog tax category.
 *
 * CRUD operations via RPCs:
 *   - list_tax_rules     (read)
 *   - list_tax_categories (category select)
 *   - upsert_tax_rule     (create/update — versioned)
 *   - deactivate_tax_rule (soft deactivate)
 *
 * Rules:
 *   - Admin edits create a new version (effective_to on old, new row inserted).
 *   - Overlap validation is enforced server-side by trigger.
 *   - Audit logged via trigger to admin_audit_logs.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface TaxCategory {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface TaxRule {
  id: string;
  tax_category_id: string;
  tax_category_key: string;
  tax_category_name: string;
  version: number;
  display_name: string;
  description: string | null;
  is_taxable: boolean;
  tax_rate: number | null;
  jurisdiction: string;
  is_active: boolean;
  min_item_price_cents: number | null;
  max_item_price_cents: number | null;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

interface RuleForm {
  tax_category_id: string;
  display_name: string;
  description: string;
  is_taxable: boolean;
  tax_rate_percent: string;
  jurisdiction: string;
  min_item_price_dollars: string;
  max_item_price_dollars: string;
  effective_from: string;
  effective_to: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const EMPTY_FORM: RuleForm = {
  tax_category_id: '',
  display_name: '',
  description: '',
  is_taxable: true,
  tax_rate_percent: '',
  jurisdiction: 'CT',
  min_item_price_dollars: '',
  max_item_price_dollars: '',
  effective_from: new Date().toISOString().slice(0, 10),
  effective_to: '',
};

function isoNow() {
  return new Date().toISOString().slice(0, 10);
}

function centsToDollars(c: number | null): string {
  if (c === null || c === undefined) return '';
  return (c / 100).toFixed(2);
}

function dollarsToCents(d: string): number | null {
  const n = parseFloat(d);
  if (isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function fmtRate(rate: number | null): string {
  if (rate === null) return 'Use node rate';
  return `${(rate * 100).toFixed(2)}%`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function TaxRulesPage() {
  const [categories, setCategories] = useState<TaxCategory[]>([]);
  const [rules, setRules] = useState<TaxRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null);

  /* ---- Load data ---- */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catRes, ruleRes] = await Promise.all([
        supabase.from('tax_categories').select('*').order('key', { ascending: true }),
        supabase.rpc('list_tax_rules', { p_active_only: false, p_tax_category_id: null }),
      ]);
      if (catRes.error) throw catRes.error;
      if (ruleRes.error) throw ruleRes.error;
      setCategories((catRes.data ?? []) as TaxCategory[]);
      setRules((ruleRes.data ?? []) as TaxRule[]);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ---- Open create form ---- */
  const openCreate = () => {
    setEditingRuleId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  /* ---- Open edit form (pre-populates from existing rule) ---- */
  const openEdit = (rule: TaxRule) => {
    setEditingRuleId(rule.id);
    setForm({
      tax_category_id: rule.tax_category_id,
      display_name: rule.display_name,
      description: rule.description ?? '',
      is_taxable: rule.is_taxable,
      tax_rate_percent: rule.tax_rate !== null ? (rule.tax_rate * 100).toFixed(2) : '',
      jurisdiction: rule.jurisdiction,
      min_item_price_dollars: centsToDollars(rule.min_item_price_cents),
      max_item_price_dollars: centsToDollars(rule.max_item_price_cents),
      effective_from: rule.effective_from ? rule.effective_from.slice(0, 10) : isoNow(),
      effective_to: rule.effective_to ? rule.effective_to.slice(0, 10) : '',
    });
    setShowForm(true);
  };

  /* ---- Validate form ---- */
  const validate = (): string | null => {
    if (!form.tax_category_id) return 'Select a tax category.';
    if (!form.display_name.trim()) return 'Display name is required.';
    if (form.tax_rate_percent.trim()) {
      const pct = parseFloat(form.tax_rate_percent);
      if (isNaN(pct) || pct < 0 || pct > 100) return 'Tax rate must be between 0% and 100%.';
    }
    if (!form.effective_from) return 'Effective-from date is required.';
    const minD = dollarsToCents(form.min_item_price_dollars);
    const maxD = dollarsToCents(form.max_item_price_dollars);
    if (minD !== null && maxD !== null && minD > maxD) {
      return 'Minimum price cannot exceed maximum price.';
    }
    if (form.effective_to && form.effective_from >= form.effective_to) {
      return 'Effective-to must be after effective-from.';
    }
    return null;
  };

  /* ---- Save (create or update) ---- */
  const save = async () => {
    const errMsg = validate();
    if (errMsg) { setError(errMsg); return; }
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const taxRate = form.tax_rate_percent.trim()
        ? parseFloat(form.tax_rate_percent) / 100
        : null;

      const { data, error: rpcError } = await supabase.rpc('upsert_tax_rule', {
        p_rule_id: editingRuleId,
        p_tax_category_id: form.tax_category_id,
        p_display_name: form.display_name.trim(),
        p_description: form.description.trim() || null,
        p_is_taxable: form.is_taxable,
        p_tax_rate: taxRate,
        p_jurisdiction: form.jurisdiction.trim() || 'CT',
        p_min_item_price_cents: dollarsToCents(form.min_item_price_dollars),
        p_max_item_price_cents: dollarsToCents(form.max_item_price_dollars),
        p_effective_from: form.effective_from + 'T00:00:00Z',
        p_effective_to: form.effective_to ? form.effective_to + 'T23:59:59Z' : null,
      });

      if (rpcError) throw rpcError;

      const result = data as { success: boolean; error?: { message: string }; data?: any };
      if (!result?.success) {
        throw new Error(result?.error?.message ?? 'Save failed');
      }

      setSuccess(editingRuleId
        ? `Rule updated — new version ${result.data?.version} created.`
        : 'Rule created successfully.');
      setShowForm(false);
      setEditingRuleId(null);
      await load();
      setTimeout(() => setSuccess(null), 5000);
    } catch (e: any) {
      setError(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  /* ---- Deactivate ---- */
  const deactivate = async (ruleId: string) => {
    setError(null);
    setSuccess(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('deactivate_tax_rule', {
        p_rule_id: ruleId,
      });
      if (rpcError) throw rpcError;
      const result = data as { success: boolean; error?: { message: string } };
      if (!result?.success) throw new Error(result?.error?.message ?? 'Deactivation failed');
      setSuccess('Rule deactivated.');
      setConfirmDeactivate(null);
      await load();
      setTimeout(() => setSuccess(null), 5000);
    } catch (e: any) {
      setError(e?.message ?? 'Deactivation failed');
    }
  };

  /* ---- Filter rules ---- */
  const filteredRules = rules.filter((r) => {
    if (!filterCategory) return true;
    return r.tax_category_id === filterCategory;
  });

  /* ---- Get history for a category ---- */
  const historyForCategory = rules.filter(
    (r) => showHistory && r.tax_category_id === showHistory
  ).sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime());

  /* ============================================================== */
  /*  Render                                                        */
  /* ============================================================== */

  return (
    <div className="p-6" data-testid="tax-rules-page">
      <h1 className="text-2xl font-semibold mb-1">Tax Rules — By Catalog Category</h1>
      <p className="text-sm text-gray-600 mb-4">
        Manage taxable treatment per catalog category. Each rule is versioned and
        effective-dated. Editing a rule creates a new prospective version — historical
        rules are preserved.
      </p>

      {/* Help text */}
      <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded p-3 mb-4 text-sm">
        <strong>ℹ️ Tax rules apply to new offers based on their effective date.</strong>{' '}
        Existing offers and completed trades keep their recorded tax calculation.
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 rounded p-3 mb-4" data-testid="tax-rules-error">
          {error}
          <button className="ml-2 font-bold" onClick={() => setError(null)}>×</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-300 text-green-700 rounded p-3 mb-4" data-testid="tax-rules-success">
          {success}
          <button className="ml-2 font-bold" onClick={() => setSuccess(null)}>×</button>
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded bg-green-600 text-white text-sm hover:bg-green-700"
          data-testid="tax-rule-create-btn"
        >
          + New Tax Rule
        </button>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
          data-testid="tax-rule-filter-category"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-2 rounded border text-sm disabled:opacity-50"
          data-testid="tax-rules-refresh"
        >
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      {/* ---- Create/Edit Form ---- */}
      {showForm && (
        <div className="border rounded-lg bg-white p-6 mb-6 shadow-sm" data-testid="tax-rule-form">
          <h2 className="text-lg font-semibold mb-4">
            {editingRuleId ? 'Edit Tax Rule (creates new version)' : 'Create Tax Rule'}
          </h2>
          {editingRuleId && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded p-2 mb-4 text-xs">
              ⚠️ Editing creates a new prospective version. The current rule is closed
              and all historical trades retain their original tax snapshot.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tax category */}
            <label className="flex flex-col text-sm">
              Tax Category *
              <select
                value={form.tax_category_id}
                onChange={(e) => setForm({ ...form, tax_category_id: e.target.value })}
                className="border rounded px-2 py-1 mt-1"
                data-testid="tax-rule-form-category"
              >
                <option value="">Select category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.key})
                  </option>
                ))}
              </select>
            </label>

            {/* Display name */}
            <label className="flex flex-col text-sm">
              Display Name *
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="e.g. Standard Tangible Goods Tax"
                className="border rounded px-2 py-1 mt-1"
                data-testid="tax-rule-form-name"
              />
            </label>

            {/* Description */}
            <label className="flex flex-col text-sm md:col-span-2">
              Description / Operations Note
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Internal notes about this tax rule"
                rows={2}
                className="border rounded px-2 py-1 mt-1"
                data-testid="tax-rule-form-desc"
              />
            </label>

            {/* Is taxable */}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_taxable}
                onChange={(e) => setForm({ ...form, is_taxable: e.target.checked })}
                data-testid="tax-rule-form-taxable"
              />
              Items in this category are taxable
            </label>

            {/* Tax rate */}
            <label className="flex flex-col text-sm">
              Tax Rate (%) — leave blank to use node rate
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.tax_rate_percent}
                onChange={(e) => setForm({ ...form, tax_rate_percent: e.target.value })}
                placeholder="e.g. 6.35"
                className="border rounded px-2 py-1 mt-1 w-40"
                data-testid="tax-rule-form-rate"
              />
            </label>

            {/* Jurisdiction */}
            <label className="flex flex-col text-sm">
              Jurisdiction
              <input
                type="text"
                value={form.jurisdiction}
                onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}
                placeholder="CT"
                className="border rounded px-2 py-1 mt-1 w-32"
                data-testid="tax-rule-form-jur"
              />
            </label>

            {/* Min price */}
            <label className="flex flex-col text-sm">
              Min Item Price ($) — leave blank for no floor
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.min_item_price_dollars}
                onChange={(e) => setForm({ ...form, min_item_price_dollars: e.target.value })}
                placeholder="e.g. 20.00"
                className="border rounded px-2 py-1 mt-1 w-32"
                data-testid="tax-rule-form-min-price"
              />
            </label>

            {/* Max price */}
            <label className="flex flex-col text-sm">
              Max Item Price ($) — leave blank for no ceiling
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.max_item_price_dollars}
                onChange={(e) => setForm({ ...form, max_item_price_dollars: e.target.value })}
                placeholder="e.g. 100.00"
                className="border rounded px-2 py-1 mt-1 w-32"
                data-testid="tax-rule-form-max-price"
              />
            </label>

            {/* Effective from */}
            <label className="flex flex-col text-sm">
              Effective From *
              <input
                type="date"
                value={form.effective_from}
                onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
                className="border rounded px-2 py-1 mt-1 w-40"
                data-testid="tax-rule-form-eff-from"
              />
            </label>

            {/* Effective to */}
            <label className="flex flex-col text-sm">
              Effective To — leave blank for ongoing
              <input
                type="date"
                value={form.effective_to}
                onChange={(e) => setForm({ ...form, effective_to: e.target.value })}
                className="border rounded px-2 py-1 mt-1 w-40"
                data-testid="tax-rule-form-eff-to"
              />
            </label>
          </div>

          {/* Form actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50 text-sm"
              data-testid="tax-rule-form-save"
            >
              {saving ? 'Saving…' : editingRuleId ? 'Create New Version' : 'Create Rule'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingRuleId(null); }}
              disabled={saving}
              className="px-4 py-2 rounded border text-sm disabled:opacity-50"
              data-testid="tax-rule-form-cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ---- Deactivation confirmation ---- */}
      {confirmDeactivate && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => setConfirmDeactivate(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
            data-testid="tax-rule-deactivate-modal"
          >
            <h3 className="text-lg font-semibold mb-2">Deactivate Tax Rule?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will set the rule as inactive and close its effective period.
              Historical trades that used this rule retain their recorded tax calculation.
              This action is audited.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDeactivate(null)}
                className="px-4 py-2 rounded border text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => deactivate(confirmDeactivate)}
                className="px-4 py-2 rounded bg-red-600 text-white text-sm"
                data-testid="tax-rule-deactivate-confirm"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Rules Table ---- */}
      {loading ? (
        <div className="text-gray-500">Loading rules…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border" data-testid="tax-rules-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2 border-b">Category</th>
                <th className="text-left p-2 border-b">Display Name</th>
                <th className="text-left p-2 border-b">Version</th>
                <th className="text-left p-2 border-b">Active</th>
                <th className="text-left p-2 border-b">Taxable</th>
                <th className="text-left p-2 border-b">Rate</th>
                <th className="text-left p-2 border-b">Jur.</th>
                <th className="text-left p-2 border-b">Price Range</th>
                <th className="text-left p-2 border-b">Effective</th>
                <th className="text-left p-2 border-b">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-4 text-center text-gray-500">
                    No tax rules found. Create one to get started.
                  </td>
                </tr>
              ) : (
                filteredRules.map((rule) => (
                  <tr key={rule.id} className="border-b hover:bg-gray-50" data-testid={`tax-rule-row-${rule.id}`}>
                    <td className="p-2 text-xs text-gray-500">{rule.tax_category_name}</td>
                    <td className="p-2 font-medium">{rule.display_name}</td>
                    <td className="p-2 text-xs text-gray-500">v{rule.version}</td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        rule.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-2">
                      {rule.is_taxable
                        ? <span className="text-green-600">Taxable</span>
                        : <span className="text-gray-500">Exempt</span>
                      }
                    </td>
                    <td className="p-2 text-xs">{fmtRate(rule.tax_rate)}</td>
                    <td className="p-2 text-xs">{rule.jurisdiction}</td>
                    <td className="p-2 text-xs">
                      {rule.min_item_price_cents !== null || rule.max_item_price_cents !== null
                        ? `$${(rule.min_item_price_cents ?? 0) / 100} – $${(rule.max_item_price_cents ?? 99999) / 100}`
                        : '—'
                      }
                    </td>
                    <td className="p-2 text-xs">
                      {fmtDate(rule.effective_from)}
                      {rule.effective_to ? <> → {fmtDate(rule.effective_to)}</> : ' → Ongoing'}
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(rule)}
                          className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs hover:bg-blue-200"
                          data-testid={`tax-rule-edit-${rule.id}`}
                        >
                          Edit
                        </button>
                        {rule.is_active && (
                          <button
                            onClick={() => setConfirmDeactivate(rule.id)}
                            className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs hover:bg-red-200"
                            data-testid={`tax-rule-deactivate-${rule.id}`}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- Version History ---- */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-2">Version History by Category</h2>
        <select
          value={showHistory ?? ''}
          onChange={(e) => setShowHistory(e.target.value || null)}
          className="border rounded px-3 py-2 text-sm mb-3"
          data-testid="tax-rule-history-select"
        >
          <option value="">Select a category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {showHistory && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border" data-testid="tax-rule-history-table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2 border-b">Ver</th>
                  <th className="text-left p-2 border-b">Display Name</th>
                  <th className="text-left p-2 border-b">Active</th>
                  <th className="text-left p-2 border-b">Taxable</th>
                  <th className="text-left p-2 border-b">Rate</th>
                  <th className="text-left p-2 border-b">Price Range</th>
                  <th className="text-left p-2 border-b">Effective From</th>
                  <th className="text-left p-2 border-b">Effective To</th>
                  <th className="text-left p-2 border-b">Updated</th>
                </tr>
              </thead>
              <tbody>
                {historyForCategory.map((rule) => (
                  <tr key={rule.id} className="border-b text-xs">
                    <td className="p-2">v{rule.version}</td>
                    <td className="p-2">{rule.display_name}</td>
                    <td className="p-2">
                      <span className={`px-1.5 py-0.5 rounded ${
                        rule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>{rule.is_active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="p-2">{rule.is_taxable ? 'Taxable' : 'Exempt'}</td>
                    <td className="p-2">{fmtRate(rule.tax_rate)}</td>
                    <td className="p-2">
                      {rule.min_item_price_cents !== null || rule.max_item_price_cents !== null
                        ? `$${(rule.min_item_price_cents ?? 0) / 100}–$${(rule.max_item_price_cents ?? 99999) / 100}`
                        : '—'
                      }
                    </td>
                    <td className="p-2">{fmtDate(rule.effective_from)}</td>
                    <td className="p-2">{fmtDate(rule.effective_to)}</td>
                    <td className="p-2">{fmtDate(rule.updated_at)}</td>
                  </tr>
                ))}
                {historyForCategory.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-3 text-center text-gray-500">
                      No rules found for this category.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
