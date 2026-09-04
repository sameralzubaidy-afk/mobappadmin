// File: p2p-kids-admin/src/lib/globalSearch.ts
// Types + data-fetch + navigation helpers for the global command palette
// (⌘K / header search). Backed by the SECURITY DEFINER RPC
// `admin_global_search(p_query, p_limit)` — see
// supabase/migrations/20260809000001_admin_global_search.sql for the contract.
// Row shapes here mirror the RPC's JSONB output 1:1.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ---------------------------------------------------------------------------
// RPC row shapes (each maps to the JSONB objects the RPC builds)
// ---------------------------------------------------------------------------

export interface GlobalSettingsRow {
  source: 'config' | 'sp_config';
  key: string;
  category: string;
  label: string;
  description: string | null;
  is_secret: boolean;
  breadcrumb: string;
  href: string;
}

export interface GlobalUserRow {
  source: 'users';
  profile_id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  account_status: string | null;
  breadcrumb: string;
  href: string;
}

export interface GlobalListingRow {
  source: 'listings';
  id: string;
  title: string;
  category_name: string | null;
  status: string;
  seller_id: string;
  seller_name: string | null;
  breadcrumb: string;
  href: string;
}

export interface GlobalTradeRow {
  source: 'trades';
  id: string;
  short_id: string;
  buyer_id: string;
  seller_id: string;
  buyer_name: string | null;
  seller_name: string | null;
  status: string;
  cash_amount_cents: number | null;
  sp_amount: number | null;
  created_at: string;
  bundle_id: string | null;
  breadcrumb: string;
  href: string;
}

export type GlobalResultRow =
  | GlobalSettingsRow
  | GlobalUserRow
  | GlobalListingRow
  | GlobalTradeRow;

export interface GlobalGroup {
  total: number;
  items: GlobalResultRow[];
}

export interface GlobalSearchResult {
  query: string;
  settings: GlobalGroup;
  users: GlobalGroup;
  listings: GlobalGroup;
  trades: GlobalGroup;
}

export interface GlobalSearchResponse {
  ok: boolean;
  data?: GlobalSearchResult | null;
  error?: string | null;
}

// ---------------------------------------------------------------------------
// Group metadata (display order + section labels)
// ---------------------------------------------------------------------------

export const GLOBAL_GROUP_ORDER = ['settings', 'users', 'listings', 'trades'] as const;
export type GlobalGroupKey = (typeof GLOBAL_GROUP_ORDER)[number];

export const GLOBAL_GROUP_LABELS: Record<GlobalGroupKey, string> = {
  settings: 'Settings',
  users: 'Users',
  listings: 'Listings',
  trades: 'Trades',
};

/** Max rows the RPC returns per group ("see all" cap). */
export const GLOBAL_SEARCH_MAX_LIMIT = 25;

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function fetchGlobalSearch(
  query: string,
  limit = 5
): Promise<GlobalSearchResponse> {
  try {
    const { data, error } = await supabase.rpc('admin_global_search', {
      p_query: query,
      p_limit: limit,
    });

    if (error) {
      console.error('[globalSearch] RPC error:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true, data: (data ?? null) as GlobalSearchResult | null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    console.error('[globalSearch] Unexpected error:', err);
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Navigation helpers (single source for palette hrefs)
// ---------------------------------------------------------------------------

export function settingsHref(category: string): string {
  return `/config?tab=${encodeURIComponent(category)}`;
}

export function usersSearchHref(search: string): string {
  return `/users?search=${encodeURIComponent(search)}`;
}

export function listingsSearchHref(search: string): string {
  return `/listings?tab=search&q=${encodeURIComponent(search)}`;
}

export function tradeHref(tradeId: string): string {
  return `/trades/${encodeURIComponent(tradeId)}`;
}

/** Resolve the destination for a single result row. */
export function rowHref(row: GlobalResultRow): string {
  switch (row.source) {
    case 'config':
    case 'sp_config':
      return settingsHref(row.category);
    case 'users':
      return usersSearchHref(row.user_id);
    case 'listings':
      // DEV-TASK-108 (Y08): the listings search page backs onto
      // admin_search_listings_v2, which matches TEXT columns (title, etc.),
      // never item UUIDs. Navigating with the row's UUID landed on an empty
      // "Results (0)" page. Pass the listing's title (the searchable text) so
      // the clicked listing actually surfaces; fall back to the id only if a
      // row somehow has no title.
      return listingsSearchHref(row.title || row.id);
    case 'trades':
      return tradeHref(row.id);
    default:
      return '/';
  }
}

/** "View all in <domain>" destination for the palette footer (prefilled list pages). */
export function viewAllHref(
  group: 'users' | 'listings' | 'trades',
  query: string
): string {
  if (group === 'users') return usersSearchHref(query);
  if (group === 'listings') return listingsSearchHref(query);
  return `/trades?search=${encodeURIComponent(query)}`;
}
