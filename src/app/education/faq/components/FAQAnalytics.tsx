'use client';

// FILE: p2p-kids-admin/src/app/education/faq/components/FAQAnalytics.tsx
// Sortable analytics table: Question | 👍 Yes | 👎 No | Total Votes | Helpful %
// Admin can reset vote counts per question.

import { useState } from 'react';
import { RotateCcw, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import type { FaqItem, FaqCategory } from '../../../../types/faq';
import { resetFaqVotes } from '../../../../lib/faqService';

interface FAQAnalyticsProps {
  items: FaqItem[];
  categories: FaqCategory[];
  onRefresh: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

type SortKey = 'question' | 'yes_count' | 'no_count' | 'total' | 'helpful_pct';
type SortDir = 'asc' | 'desc';

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={13} className="text-gray-300" />;
  return sortDir === 'asc'
    ? <ChevronUp size={13} className="text-blue-500" />
    : <ChevronDown size={13} className="text-blue-500" />;
}

export function FAQAnalytics({ items, categories, onRefresh, onError, onSuccess }: FAQAnalyticsProps) {
  const [sortKey, setSortKey] = useState<SortKey>('helpful_pct');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [resettingId, setResettingId] = useState<string | null>(null);

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? '—';

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const handleReset = async (item: FaqItem) => {
    if (!confirm(`Reset all vote counts for:\n"${item.question}"?\n\nThis cannot be undone.`)) return;
    setResettingId(item.id);
    try {
      await resetFaqVotes(item.id);
      onSuccess('Vote counts reset');
      onRefresh();
    } catch (err: any) {
      onError(err.message ?? 'Failed to reset votes');
    } finally {
      setResettingId(null);
    }
  };

  const rows = items.map((item) => {
    const yes = item.yes_count ?? 0;
    const no = item.no_count ?? 0;
    const total = yes + no;
    const pct = total > 0 ? Math.round((yes / total) * 100) : null;
    return { item, yes, no, total, pct };
  });

  const sorted = [...rows].sort((a, b) => {
    let aVal: number | string;
    let bVal: number | string;
    switch (sortKey) {
      case 'question':  aVal = a.item.question.toLowerCase(); bVal = b.item.question.toLowerCase(); break;
      case 'yes_count': aVal = a.yes;   bVal = b.yes;   break;
      case 'no_count':  aVal = a.no;    bVal = b.no;    break;
      case 'total':     aVal = a.total; bVal = b.total; break;
      case 'helpful_pct': aVal = a.pct ?? -1; bVal = b.pct ?? -1; break;
      default:          aVal = 0; bVal = 0;
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalYes = rows.reduce((s, r) => s + r.yes, 0);
  const totalNo  = rows.reduce((s, r) => s + r.no, 0);
  const grandTotal = totalYes + totalNo;
  const overallPct = grandTotal > 0 ? Math.round((totalYes / grandTotal) * 100) : null;

  const ThBtn = ({ col, label }: { col: SortKey; label: string }) => (
    <button
      onClick={() => handleSort(col)}
      className="flex items-center gap-1 hover:text-gray-900 transition-colors group"
    >
      {label}
      <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
    </button>
  );

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-center">
          <p className="text-2xl font-bold text-green-600">{totalYes.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total 👍 Yes</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-center">
          <p className="text-2xl font-bold text-red-500">{totalNo.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total 👎 No</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{grandTotal.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Votes</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-center">
          <p className={`text-2xl font-bold ${overallPct !== null && overallPct >= 70 ? 'text-green-600' : overallPct !== null && overallPct >= 40 ? 'text-yellow-600' : 'text-gray-400'}`}>
            {overallPct !== null ? `${overallPct}%` : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Overall Helpful</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">
                <ThBtn col="question" label="Question" />
              </th>
              <th className="px-4 py-3 text-left w-28">Category</th>
              <th className="px-4 py-3 text-center w-24">
                <ThBtn col="yes_count" label="👍 Yes" />
              </th>
              <th className="px-4 py-3 text-center w-24">
                <ThBtn col="no_count" label="👎 No" />
              </th>
              <th className="px-4 py-3 text-center w-28">
                <ThBtn col="total" label="Total" />
              </th>
              <th className="px-4 py-3 text-center w-32">
                <ThBtn col="helpful_pct" label="Helpful %" />
              </th>
              <th className="px-4 py-3 text-center w-20">Reset</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {sorted.map(({ item, yes, no, total, pct }) => {
              const isResetting = resettingId === item.id;
              return (
                <tr key={item.id} className={isResetting ? 'opacity-50' : 'hover:bg-gray-50'}>
                  {/* Question */}
                  <td className="px-4 py-3 max-w-xs">
                    <p className="font-medium text-gray-900 truncate">{item.question}</p>
                  </td>

                  {/* Category */}
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      {categoryName(item.category_id)}
                    </span>
                  </td>

                  {/* Yes */}
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-green-600">{yes.toLocaleString()}</span>
                  </td>

                  {/* No */}
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-red-500">{no.toLocaleString()}</span>
                  </td>

                  {/* Total */}
                  <td className="px-4 py-3 text-center text-gray-700 font-medium">
                    {total.toLocaleString()}
                  </td>

                  {/* Helpful % with bar */}
                  <td className="px-4 py-3 text-center">
                    {total === 0 ? (
                      <span className="text-gray-300 text-xs">No votes</span>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <span className={`font-semibold text-sm ${pct! >= 70 ? 'text-green-600' : pct! >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>
                          {pct}%
                        </span>
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct! >= 70 ? 'bg-green-500' : pct! >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Reset */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleReset(item)}
                      disabled={isResetting || total === 0}
                      title={total === 0 ? 'No votes to reset' : 'Reset vote counts'}
                      className="p-1.5 rounded text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">No FAQ items yet.</div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        * Each user can vote once per question. Helpful % = Yes ÷ Total × 100.
        Reset removes all recorded votes for that question.
      </p>
    </div>
  );
}
