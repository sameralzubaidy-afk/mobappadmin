// File: p2p-kids-admin/src/app/sp-economy/page.tsx
// Module: SP Economy Hub
// Route: /sp-economy[?tab=health|flow|wallets|rules]
// Purpose: Single consolidated entry point for everything Swap-Points-related.
//          Tabs: Health (default), Flow, Wallets (link), Rules (simulate).

'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const SPHealthPanel = dynamic(
  () =>
    import('@/components/spconfig/SPHealthPanel').then((m) => ({
      default: m.SPHealthPanel,
    })),
  { ssr: false },
);
const SPFlowPanel = dynamic(
  () =>
    import('@/components/spconfig/SPFlowPanel').then((m) => ({
      default: m.SPFlowPanel,
    })),
  { ssr: false },
);
const SPRulesPanel = dynamic(
  () =>
    import('@/components/spconfig/SPRulesPanel').then((m) => ({
      default: m.SPRulesPanel,
    })),
  { ssr: false },
);

type TabId = 'health' | 'flow' | 'wallets' | 'rules';

const TABS: { id: TabId; label: string; testId: string }[] = [
  { id: 'health', label: 'Health', testId: 'sp-economy-tab-health' },
  { id: 'flow', label: 'Flow', testId: 'sp-economy-tab-flow' },
  { id: 'wallets', label: 'Wallets', testId: 'sp-economy-tab-wallets' },
  { id: 'rules', label: 'Rules & Impact', testId: 'sp-economy-tab-rules' },
];

function SPEconomyPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const rawTab = (params.get('tab') ?? 'health').toLowerCase();
  const activeTab: TabId = useMemo(
    () => (TABS.some((t) => t.id === rawTab) ? (rawTab as TabId) : 'health'),
    [rawTab],
  );

  const setTab = useCallback(
    (id: TabId) => {
      // Wallets is an external route (kept separate to avoid risky 522-line
      // refactor of /sp-wallet). Other tabs render in-page.
      if (id === 'wallets') {
        router.push('/sp-wallet');
        return;
      }
      const next = new URLSearchParams(params.toString());
      next.set('tab', id);
      router.replace(`/sp-economy?${next.toString()}`);
    },
    [router, params],
  );

  return (
    <div
      className="container mx-auto px-4 py-8 max-w-7xl"
      data-testid="sp-economy-page"
    >
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-1">💎 SP Economy</h1>
        <p className="text-gray-600 text-sm">
          One hub for Swap Points health, flow, wallets, and rules. All tabs
          read from the canonical{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">
            admin_sp_economy_summary
          </code>{' '}
          and{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">
            getSPAnalyticsByCategory
          </code>{' '}
          data sources.
        </p>
      </header>

      {/* Tab bar */}
      <nav
        className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto"
        data-testid="sp-economy-tabs"
      >
        {TABS.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              data-testid={t.testId}
              aria-current={isActive ? 'page' : undefined}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Tab content */}
      {activeTab === 'health' && <SPHealthPanel />}
      {activeTab === 'flow' && <SPFlowPanel />}
      {activeTab === 'rules' && <SPRulesPanel />}
      {activeTab === 'wallets' && (
        <div data-testid="sp-economy-wallets-redirect" className="text-sm text-gray-600">
          Redirecting to{' '}
          <Link href="/sp-wallet" className="underline text-indigo-700">
            /sp-wallet
          </Link>
          …
        </div>
      )}
    </div>
  );
}

export default function SPEconomyPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading…</div>}>
      <SPEconomyPageInner />
    </Suspense>
  );
}
