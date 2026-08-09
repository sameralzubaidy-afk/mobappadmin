// File: p2p-kids-admin/src/components/spconfig/SPRulesPanel.tsx
// Module: SP Economy Hub — Tab 4 (Rules & Impact, SIMULATE-ONLY)
// Purpose: Show current SP knobs (50% cap, earning multiplier, spending cap)
//          and let admin preview "if you change this, last 30d would have
//          produced X SP instead of Y". WRITES are intentionally disabled —
//          actual edits live in /config and /categories.

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { calculateCategorySP, getSPAnalyticsByCategory } from '@/lib/spConfigCategoryService';
import { createClient } from '@supabase/supabase-js';
import type { CategorySPAnalytics } from '@/types/category';

interface CategoryRow {
  id: string;
  name: string;
  sp_earning_multiplier: number;
  sp_spending_cap_percent: number;
}

const SP_EARNING_MIN = 1.05;
const SP_EARNING_MAX = 1.4;
const SP_SPENDING_CAP_MIN = 50;
const SP_SPENDING_CAP_MAX = 80;

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export function SPRulesPanel() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [analytics, setAnalytics] = useState<CategorySPAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simulation inputs (default to category's current values)
  const [selectedId, setSelectedId] = useState<string>('');
  const [simEarning, setSimEarning] = useState<number>(1.1);
  const [simSpending, setSimSpending] = useState<number>(50);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = getClient();
        const [{ data: cats, error: catErr }, ana] = await Promise.all([
          supabase
            .from('categories')
            .select('id, name, sp_earning_multiplier, sp_spending_cap_percent')
            .eq('is_active', true)
            .order('name', { ascending: true }),
          getSPAnalyticsByCategory({
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString(),
          }).catch(() => [] as CategorySPAnalytics[]),
        ]);
        if (catErr) throw new Error(catErr.message);
        if (cancelled) return;
        setCategories((cats ?? []) as CategoryRow[]);
        setAnalytics(ana);
        const first = (cats ?? [])[0] as CategoryRow | undefined;
        if (first) {
          setSelectedId(first.id);
          setSimEarning(first.sp_earning_multiplier);
          setSimSpending(first.sp_spending_cap_percent);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load categories');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => categories.find((c) => c.id === selectedId) ?? null,
    [categories, selectedId],
  );

  const selectedAnalytics = useMemo(
    () => analytics.find((a) => a.category_id === selectedId) ?? null,
    [analytics, selectedId],
  );

  // Reset sim values when a new category is picked
  useEffect(() => {
    if (selected) {
      setSimEarning(selected.sp_earning_multiplier);
      setSimSpending(selected.sp_spending_cap_percent);
    }
  }, [selected]);

  // Simulation: project last-30d SP earned/spent if rates were the simulated ones.
  // We approximate: total cash ≈ (avg_cash_per_trade * trades_count). We don't
  // have trade count from the analytics service, so we use a representative
  // sample price = avg_cash_per_trade and N=1 to compare per-trade impact.
  const baseline = selected
    ? calculateCategorySP(
        selected.id,
        selectedAnalytics?.avg_cash_per_trade ?? 50,
        selected.sp_earning_multiplier,
        selected.sp_spending_cap_percent,
      )
    : null;
  const simulated = selected
    ? calculateCategorySP(
        selected.id,
        selectedAnalytics?.avg_cash_per_trade ?? 50,
        simEarning,
        simSpending,
      )
    : null;

  const earnDelta =
    baseline && simulated ? simulated.earn_sp - baseline.earn_sp : 0;
  const spendDelta =
    baseline && simulated ? simulated.max_spend_sp - baseline.max_spend_sp : 0;

  return (
    <div data-testid="sp-rules-panel" className="space-y-6">
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <strong>Simulate-only.</strong> This panel does not write changes. To
        actually edit SP rules, use{' '}
        <Link
          href="/categories"
          className="underline font-medium"
          data-testid="sp-rules-link-categories"
        >
          /categories
        </Link>{' '}
        (per-category) or{' '}
        <Link
          href="/config"
          className="underline font-medium"
          data-testid="sp-rules-link-config"
        >
          /config
        </Link>{' '}
        (global SP rules).
      </div>

      {loading && <p className="text-sm text-gray-500">Loading SP rules…</p>}
      {error && (
        <div
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          data-testid="sp-rules-error"
        >
          {error}
        </div>
      )}

      {!loading && !error && categories.length > 0 && (
        <>
          {/* Category picker */}
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Category</span>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                data-testid="sp-rules-category-select"
                className="border border-gray-300 rounded-md px-3 py-1.5 bg-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {selected && (
              <span className="text-xs text-gray-500">
                Current: ×{selected.sp_earning_multiplier.toFixed(2)} earn ·{' '}
                {selected.sp_spending_cap_percent}% cap
              </span>
            )}
          </div>

          {/* Knob sliders */}
          {selected && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <KnobSlider
                label="SP earning multiplier"
                min={SP_EARNING_MIN}
                max={SP_EARNING_MAX}
                step={0.01}
                value={simEarning}
                baseline={selected.sp_earning_multiplier}
                onChange={setSimEarning}
                format={(v) => `×${v.toFixed(2)}`}
                testId="sp-rules-earning-slider"
              />
              <KnobSlider
                label="SP spending cap %"
                min={SP_SPENDING_CAP_MIN}
                max={SP_SPENDING_CAP_MAX}
                step={1}
                value={simSpending}
                baseline={selected.sp_spending_cap_percent}
                onChange={setSimSpending}
                format={(v) => `${v}%`}
                testId="sp-rules-spending-slider"
              />
            </div>
          )}

          {/* Impact preview */}
          {baseline && simulated && (
            <div
              className="rounded-lg border border-gray-200 bg-white p-4"
              data-testid="sp-rules-impact-preview"
            >
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Per-trade impact (sample price ${baseline.price.toFixed(2)})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ImpactRow
                  label="Earn SP per trade"
                  before={`${baseline.earn_sp} SP`}
                  after={`${simulated.earn_sp} SP`}
                  delta={earnDelta}
                />
                <ImpactRow
                  label="Max spend SP per trade"
                  before={`${baseline.max_spend_sp} SP`}
                  after={`${simulated.max_spend_sp} SP`}
                  delta={spendDelta}
                />
              </div>
              {selectedAnalytics && (
                <p className="mt-3 text-xs text-gray-500">
                  Last 30d in this category: avg cash $
                  {selectedAnalytics.avg_cash_per_trade.toFixed(2)} · velocity{' '}
                  {selectedAnalytics.velocity.toFixed(2)} · gap{' '}
                  {selectedAnalytics.gap_percent.toFixed(1)}%
                </p>
              )}
            </div>
          )}

          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            🔒 The 50% global SP cap (max % of price payable in SP) is enforced
            server-side and is not editable here. See{' '}
            <Link href="/config" className="underline">
              /config
            </Link>{' '}
            for global SP rules.
          </div>
        </>
      )}
    </div>
  );
}

function KnobSlider(props: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  baseline: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  testId: string;
}) {
  const dirty = props.value !== props.baseline;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{props.label}</span>
        <span
          className={`text-sm font-mono ${dirty ? 'text-primary-700' : 'text-gray-500'}`}
        >
          {props.format(props.value)}
          {dirty && (
            <span className="ml-2 text-xs text-gray-400">
              (was {props.format(props.baseline)})
            </span>
          )}
        </span>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(parseFloat(e.target.value))}
        className="w-full"
        data-testid={props.testId}
      />
      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
        <span>{props.format(props.min)}</span>
        <span>{props.format(props.max)}</span>
      </div>
    </div>
  );
}

function ImpactRow(props: {
  label: string;
  before: string;
  after: string;
  delta: number;
}) {
  const tone =
    props.delta > 0
      ? 'text-green-700'
      : props.delta < 0
        ? 'text-red-700'
        : 'text-gray-500';
  return (
    <div className="rounded-md border border-gray-100 p-3">
      <p className="text-xs uppercase font-semibold text-gray-500 mb-1">
        {props.label}
      </p>
      <p className="text-sm">
        <span className="text-gray-500">{props.before}</span>
        <span className="mx-2 text-gray-400">→</span>
        <span className="font-bold text-gray-900">{props.after}</span>
      </p>
      <p className={`text-xs font-mono mt-0.5 ${tone}`}>
        Δ {props.delta > 0 ? '+' : ''}
        {props.delta}
      </p>
    </div>
  );
}

export default SPRulesPanel;
