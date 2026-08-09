// File: p2p-kids-admin/src/app/trades/disputes/page.tsx
// TFV2-017: Dispute Admin Dashboard Queue
// Lists all disputes with filters: status, search by item name, reason, and pagination.

export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import DisputeViewer from './DisputeViewer';
import DisputeCostLedger from './DisputeCostLedger';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface DisputeTrade {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  dispute_status: 'reported' | 'under_review' | 'resolved' | 'none';
  dispute_reason: string | null;
  dispute_opened_at: string | null;
  cash_amount_cents: number;
  sp_amount: number;
  created_at: string;
  item_title: string | null;
}

export default async function DisputeQueuePage(props: {
  searchParams?: { status?: string; search?: string; reason?: string; page?: string };
}) {
  const sp = props.searchParams ?? {};
  const statusFilter = sp.status?.trim() || 'all';
  const searchFilter = sp.search?.trim() || '';
  const reasonFilter = sp.reason?.trim() || '';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Step 1: Fetch all disputed trades via direct PostgREST REST API call
  // (bypasses Supabase JS client query builder which has bugs with .or()/.not()/.neq() in v2.39.x)
  const selectCols = 'id,listing_id,buyer_id,seller_id,status,dispute_status,dispute_reason,dispute_opened_at,cash_amount_cents,sp_amount,created_at';
  const restUrl = `${supabaseUrl}/rest/v1/trades?select=${encodeURIComponent(selectCols)}&dispute_status=neq.none&order=dispute_opened_at.asc.nullsfirst`;

  const res = await fetch(restUrl, {
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Dispute Queue</h1>
        <p className="text-red-600">Failed to load disputes: HTTP {res.status}</p>
      </div>
    );
  }

  const trades = await res.json();

  // Apply status filter client-side
  let filteredTrades = trades ?? [];
  if (statusFilter && statusFilter !== 'all') {
    filteredTrades = filteredTrades.filter((t: any) => t.dispute_status === statusFilter);
  }

  // Step 2: Batch-fetch item titles for all listing_ids
  const listingIds = [...new Set(filteredTrades.map((t: any) => t.listing_id).filter(Boolean))];
  const titleMap: Record<string, string | null> = {};
  if (listingIds.length > 0) {
    const { data: items } = await supabaseAdmin
      .from('items')
      .select('id, title')
      .in('id', listingIds);
    if (items) {
      for (const item of items) {
        titleMap[item.id] = item.title;
      }
    }
  }

  const allDisputes: DisputeTrade[] = filteredTrades.map((t: any) => ({
    ...t,
    item_title: titleMap[t.listing_id] ?? null,
  }));

  const uniqueReasons = [
    ...new Set(allDisputes.map((d) => d.dispute_reason).filter((r): r is string => !!r)),
  ].sort();

  return (
    <>
      <DisputeViewer
        disputes={allDisputes}
        uniqueReasons={uniqueReasons}
        initialStatusFilter={statusFilter}
        initialSearchFilter={searchFilter}
        initialReasonFilter={reasonFilter}
      />
      {/* R4 (2026-08-09): finance surface — dispute cost ledger (fee + AOV x (1 - recovery_rate)) */}
      <DisputeCostLedger />
    </>
  );
}
