// File: p2p-kids-admin/src/app/page.tsx
// Admin Dashboard homepage — composed top-to-bottom per the admin IA:
//   1. Intro line (page title + blurb)
//   2. System health strip (HealthStatusStrip — Prompt 6)
//   3. Action Center feed (ActionCenterClient embedded — Prompt 3; top 5 items + View all)
//   4. KPI stat cards (TradeAnalytics + SPEconomySummary) below the Action Center
//
// The legacy duplicate card grid (Revenue & Analytics, SP Economy, Trades,
// Subscriptions, etc.) was removed — every one of those destinations already
// exists in the left sidebar (src/components/layout/Sidebar.tsx), so repeating
// them as homepage cards added noise without new navigation value.
//
// Visual spec (docx/old/design-system.md): 24px (lg) spacing between major
// sections; KPI cards are white with a 16px radius, Level 1 shadow, and 16px
// padding (see TradeAnalytics / SPEconomySummary).

import TradeAnalytics from './components/TradeAnalytics';
import SPEconomySummary from './components/SPEconomySummary';
import HealthStatusStrip from '../components/health/HealthStatusStrip';
import ActionCenterClient from './action-center/ActionCenterClient';

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <div>
        <h1 className="text-[32px] font-bold leading-10 mb-2" style={{ letterSpacing: '-0.5px' }}>
          Welcome to Admin Portal
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Manage system configuration, users, and review audit logs.
        </p>
      </div>

      {/* System health strip — always visible below the page title, above the Action Center */}
      <HealthStatusStrip />

      {/* Action Center (embedded) — top pending admin actions, "View all" → /action-center */}
      <section aria-label="Action Center">
        <ActionCenterClient variant="embedded" maxCards={5} />
      </section>

      {/* KPI stat cards — positioned below the Action Center */}
      <TradeAnalytics />
      <SPEconomySummary />
    </div>
  );
}
