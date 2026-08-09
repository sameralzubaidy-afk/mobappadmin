// File: p2p-kids-admin/src/app/trades/pipeline/page.tsx
// Admin Trade Pipeline — server component that reads admin_trades_view via the
// service role (same pattern as /trades) and renders the live kanban board.
// R2 (2026-08-10): the view now also exposes offer_expires_at, auto_complete_at,
// authorization_expires_at, and dispute fields for stage countdowns.

import Link from 'next/link';
import TradePipelineBoard, { PipelineTrade } from '@/components/trades/TradePipelineBoard';

export const dynamic = 'force-dynamic';

export default async function TradePipelinePage() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <div className="p-6 text-red-600">
        <h1 className="text-xl font-bold mb-2">Missing server configuration</h1>
        <p>Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.</p>
      </div>
    );
  }

  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };

  // Most-recently-updated trades (pipeline focuses on active + recent stages).
  const url = `${SUPABASE_URL}/rest/v1/admin_trades_view?select=*&limit=500&order=updated_at.desc.nullslast`;
  const resp = await fetch(url, { headers, cache: 'no-store' });

  if (!resp.ok) {
    const errorText = await resp.text();
    return (
      <div className="p-6 text-red-600">
        <h1 className="text-xl font-bold mb-2">Error Fetching Trade Pipeline</h1>
        <p className="bg-red-50 p-4 rounded border border-red-200 font-mono text-sm">
          {resp.status} {resp.statusText}: {errorText}
        </p>
        <Link href="/" className="text-blue-600 hover:underline mt-4 block">← Back to Dashboard</Link>
      </div>
    );
  }

  const data = await resp.json();
  const trades: PipelineTrade[] = Array.isArray(data) ? data : [];

  return <TradePipelineBoard trades={trades} />;
}
