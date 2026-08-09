// File: p2p-kids-admin/src/__tests__/components/command-palette/CommandPalette.test.tsx
// Unit tests for the global command palette (⌘K / header search).
// Mocks the RPC fetch so no Supabase/DB is needed.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CommandPalette } from '@/components/command-palette/CommandPalette';
import { fetchGlobalSearch, type GlobalSearchResult } from '@/lib/globalSearch';

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
}));

// NOTE: do NOT use importOriginal here — the real globalSearch.ts calls
// createClient() at module load (throws without env vars). Mock the module
// wholesale with the runtime exports CommandPalette consumes.
vi.mock('@/lib/globalSearch', () => ({
  fetchGlobalSearch: vi.fn(),
  GLOBAL_GROUP_ORDER: ['settings', 'users', 'listings', 'trades'],
  GLOBAL_GROUP_LABELS: {
    settings: 'Settings',
    users: 'Users',
    listings: 'Listings',
    trades: 'Trades',
  },
  GLOBAL_SEARCH_MAX_LIMIT: 25,
  rowHref: (row: { href: string }) => row.href || '/',
  viewAllHref: (group: string, query: string) => `/viewall?g=${group}&q=${query}`,
}));

const mockFetch = vi.mocked(fetchGlobalSearch);

const sampleResult: GlobalSearchResult = {
  query: 'sara',
  settings: { total: 0, items: [] },
  users: {
    total: 1,
    items: [
      {
        source: 'users',
        profile_id: 'p1',
        user_id: 'u1',
        name: 'Sara Ahmed',
        email: 'sara@example.com',
        phone: null,
        avatar_url: null,
        account_status: 'active',
        breadcrumb: 'Users → Sara Ahmed',
        href: '/users?search=u1',
      },
    ],
  },
  listings: {
    total: 3, // > items.length so the "See all N results" affordance renders
    items: [
      {
        source: 'listings',
        id: 'l1',
        title: 'Sara Backpack',
        category_name: 'Bags',
        status: 'available',
        seller_id: 's1',
        seller_name: null,
        breadcrumb: 'Listings → Sara Backpack',
        href: '/listings?tab=search&q=l1',
      },
      {
        source: 'listings',
        id: 'l2',
        title: 'Sara Bike',
        category_name: 'Toys',
        status: 'pending',
        seller_id: 's2',
        seller_name: null,
        breadcrumb: 'Listings → Sara Bike',
        href: '/listings?tab=search&q=l2',
      },
    ],
  },
  trades: { total: 0, items: [] },
};

/** Render the palette open, type a query, advance the debounce, flush the fetch. */
async function typeAndSearch(term: string) {
  render(<CommandPalette open onOpenChange={onOpenChange} />);
  const input = screen.getByTestId('command-palette-input');
  fireEvent.change(input, { target: { value: term } });
  await act(async () => {
    vi.advanceTimersByTime(200); // debounce
    await Promise.resolve(); // resolve the fetch .then
  });
}

const onOpenChange = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  onOpenChange.mockClear();
  routerPush.mockClear();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CommandPalette', () => {
  it('shows the hint state while the query is empty', () => {
    render(<CommandPalette open onOpenChange={onOpenChange} />);
    expect(
      screen.getByText(/Search across settings, users, listings, and trades/i)
    ).toBeInTheDocument();
  });

  it('fetches after the ~200ms debounce and renders grouped results', async () => {
    mockFetch.mockResolvedValue({ ok: true, data: sampleResult });

    await typeAndSearch('sara');

    expect(mockFetch).toHaveBeenCalledWith('sara', 5);
    // Group section labels (uppercase) + result rows + breadcrumbs.
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Listings')).toBeInTheDocument();
    expect(screen.getByText('Sara Ahmed')).toBeInTheDocument();
    expect(screen.getByText('Sara Backpack')).toBeInTheDocument();
    expect(screen.getByText('Users → Sara Ahmed')).toBeInTheDocument();
    // Groups with no matches are omitted.
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    expect(screen.queryByText('Trades')).not.toBeInTheDocument();
  });

  it('navigates when a result row is selected and closes the palette', async () => {
    mockFetch.mockResolvedValue({ ok: true, data: sampleResult });
    await typeAndSearch('sara');

    fireEvent.click(screen.getByText('Sara Ahmed'));

    expect(routerPush).toHaveBeenCalledWith('/users?search=u1');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows "See all N results" and expands a group with a higher limit', async () => {
    mockFetch.mockResolvedValue({ ok: true, data: sampleResult });
    await typeAndSearch('sara');

    fireEvent.click(screen.getByTestId('command-palette-see-all-listings'));

    expect(mockFetch).toHaveBeenLastCalledWith('sara', 25);
  });

  it('navigates with ArrowDown + Enter (keyboard)', async () => {
    mockFetch.mockResolvedValue({ ok: true, data: sampleResult });
    await typeAndSearch('sara');

    const input = screen.getByTestId('command-palette-input');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Flattened order: [users.sara, listings.backpack, listings.bike].
    // ArrowDown moves to row index 1 = the first listing.
    expect(routerPush).toHaveBeenCalledWith('/listings?tab=search&q=l1');
  });

  it('closes on Escape and reports the non-admin error state', async () => {
    mockFetch.mockResolvedValue({ ok: false, error: 'Forbidden: admin role required' });
    await typeAndSearch('sara');

    expect(screen.getByText(/Only admins can use global search/i)).toBeInTheDocument();

    fireEvent.keyDown(screen.getByTestId('command-palette-input'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
