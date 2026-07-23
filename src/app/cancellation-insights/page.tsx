// File: p2p-kids-admin/src/app/cancellation-insights/page.tsx
// Module: Admin — Cancellation Insights Dashboard
// Read-only monitoring page showing offer and trade cancellation data.

export const dynamic = 'force-dynamic';

import CancellationInsightsClient from './CancellationInsightsClient';

export default function CancellationInsightsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Cancellation Insights</h1>
          <p className="text-gray-500 text-sm mt-1">
            Read-only monitoring of offer and trade cancellation patterns across the marketplace.
          </p>
        </div>
      </div>
      <CancellationInsightsClient />
    </div>
  );
}
