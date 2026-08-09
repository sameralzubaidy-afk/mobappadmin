// File: p2p-kids-admin/src/components/command-palette/CommandPalette.tsx
// Global command palette for the admin portal.
//   - Opens on ⌘K (Cmd/Ctrl + K) and from the header search bar (TopNavbar).
//   - Searches Settings / Users / Listings / Trades in parallel via the
//     `admin_global_search` RPC, grouped with section labels.
//   - ~200ms debounce; top 5 per group; "See all N results" inline expansion;
//     a footer "View all in <domain>" link navigates to the prefilled list page.
//   - Results are admin-scoped server-side (the RPC rejects non-admins).
//
// Visual style per docx/old/design-system.md: centered modal, white bg, 20px
// radius, Level 2 shadow, rgba(0,0,0,0.4) backdrop; pill search input
// (48px / 24px radius / Neutral 100); group labels 12px/500/uppercase/Neutral 700.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Package, Receipt, Search, Settings, Users, X } from 'lucide-react';
import {
  fetchGlobalSearch,
  GLOBAL_GROUP_LABELS,
  GLOBAL_GROUP_ORDER,
  GLOBAL_SEARCH_MAX_LIMIT,
  rowHref,
  viewAllHref,
  type GlobalGroupKey,
  type GlobalResultRow,
  type GlobalSearchResult,
} from '@/lib/globalSearch';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEBOUNCE_MS = 200; // spec: debounce input by ~200ms
const TOP_N = 5; // spec: top 3-5 results per group

const GROUP_ICONS: Record<GlobalGroupKey, React.ReactNode> = {
  settings: <Settings size={16} />,
  users: <Users size={16} />,
  listings: <Package size={16} />,
  trades: <Receipt size={16} />,
};

function rowKey(row: GlobalResultRow): string {
  switch (row.source) {
    case 'config':
    case 'sp_config':
      return `${row.source}:${row.key}`;
    case 'users':
      return `users:${row.user_id}`;
    case 'listings':
      return `listings:${row.id}`;
    case 'trades':
      return `trades:${row.id}`;
    default:
      return 'row';
  }
}

function rowLabel(row: GlobalResultRow): string {
  switch (row.source) {
    case 'config':
    case 'sp_config':
      return row.label;
    case 'users':
      return row.name || row.email || row.user_id;
    case 'listings':
      return row.title;
    case 'trades': {
      const parties = [row.buyer_name, row.seller_name].filter(Boolean).join(' · ');
      return parties ? `${row.short_id} · ${parties}` : row.short_id;
    }
    default:
      return '';
  }
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();

  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [fetchLimit, setFetchLimit] = useState(TOP_N);
  const [result, setResult] = useState<GlobalSearchResult | null>(null);
  const [expanded, setExpanded] = useState<Set<GlobalGroupKey>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Global ⌘K listener — active even when the palette is closed (to open it).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
        return;
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        onOpenChange(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  // Lock body scroll while open; reset + autofocus on open/close.
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => {
        document.body.style.overflow = prev;
        clearTimeout(t);
      };
    }
    setQuery('');
    setDebouncedQuery('');
    setResult(null);
    setExpanded(new Set());
    setError(null);
    setActiveIndex(0);
    return undefined;
  }, [open]);

  // Debounce the raw input into the fetch trigger (~200ms).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setExpanded(new Set());
      setFetchLimit(TOP_N);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, open]);

  // Fetch whenever the debounced query or expansion limit changes.
  useEffect(() => {
    if (!open || !debouncedQuery) {
      setResult(null);
      setExpanded(new Set());
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setActiveIndex(0);
    fetchGlobalSearch(debouncedQuery, fetchLimit).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error ?? 'Search failed');
        setResult(null);
      } else {
        // res.data is typed `GlobalSearchResult | null | undefined`; the state
        // slot accepts `null` but not `undefined`, so normalize here (pre-existing
        // typecheck error, unrelated to the health strip).
        setResult(res.data ?? null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, debouncedQuery, fetchLimit]);

  // Flatten the visible rows (top-N, or all when a group is expanded) into a
  // single list so ArrowUp/Down/Enter keyboard navigation can walk them.
  const flattened = useMemo(() => {
    const rows: { group: GlobalGroupKey; row: GlobalResultRow }[] = [];
    if (!result) return rows;
    for (const g of GLOBAL_GROUP_ORDER) {
      const group = result[g];
      const items = group?.items ?? [];
      if (!items.length) continue;
      const shown = expanded.has(g) ? items : items.slice(0, TOP_N);
      shown.forEach((row) => rows.push({ group: g, row }));
    }
    return rows;
  }, [result, expanded]);

  const rowIndexMap = useMemo(() => {
    const m = new Map<GlobalResultRow, number>();
    flattened.forEach((f, i) => m.set(f.row, i));
    return m;
  }, [flattened]);

  const goTo = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [router, onOpenChange]
  );

  const handleRowClick = (row: GlobalResultRow) => goTo(rowHref(row));

  const handleExpand = (g: GlobalGroupKey) => {
    setExpanded((prev) => new Set(prev).add(g));
    setFetchLimit(GLOBAL_SEARCH_MAX_LIMIT);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(flattened.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const active = flattened[activeIndex];
      if (active) {
        e.preventDefault();
        goTo(rowHref(active.row));
      }
    }
  };

  // Lightweight focus trap: keep Tab inside the modal.
  const handlePanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>('button, input, [tabindex]');
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  return (
    <div
      data-testid="command-palette"
      className="fixed inset-0 z-[1000] flex items-start justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.4)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        ref={panelRef}
        onKeyDown={handlePanelKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        className="flex flex-col overflow-hidden"
        style={{
          width: 'min(620px, calc(100vw - 32px))',
          maxHeight: 'min(72vh, 640px)',
          marginTop: '10vh',
          background: 'var(--card-bg)',
          borderRadius: 20,
          boxShadow: 'var(--shadow-level-2)',
        }}
      >
        {/* Search input — pill (design-system Search Bar) */}
        <div className="relative flex items-center px-4 pt-4 pb-2">
          <Search size={20} className="absolute left-8" style={{ color: 'var(--neutral-700)' }} />
          <input
            ref={inputRef}
            data-testid="command-palette-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search settings, users, listings, trades…"
            aria-label="Global search"
            className="w-full pl-11 pr-10 text-[15px] outline-none"
            style={{
              height: 48,
              borderRadius: 24,
              background: 'var(--neutral-100)',
              border: 'none',
              color: 'var(--text-primary)',
            }}
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              data-testid="command-palette-clear"
              className="absolute right-7 flex items-center justify-center w-6 h-6 rounded-full"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => setQuery('')}
            >
              <X size={16} />
            </button>
          ) : null}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-2 pb-3" style={{ minHeight: 120 }}>
          {loading ? (
            <div
              className="flex items-center justify-center py-10"
              data-testid="command-palette-loading"
            >
              <Loader2
                size={20}
                className="animate-spin"
                style={{ color: 'var(--brand-primary)' }}
              />
            </div>
          ) : error ? (
            <div className="px-4 py-10 text-center" data-testid="command-palette-error">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Global search isn’t available right now.
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {error.toLowerCase().includes('forbidden')
                  ? 'Only admins can use global search.'
                  : 'Please try again in a moment.'}
              </p>
            </div>
          ) : !debouncedQuery ? (
            <div className="px-4 py-10 text-center" data-testid="command-palette-hint">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Search across settings, users, listings, and trades.
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Tip: try a setting name, user email, item title, or trade ID.
              </p>
            </div>
          ) : !result || flattened.length === 0 ? (
            <div className="px-4 py-10 text-center" data-testid="command-palette-empty">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                No results for “{debouncedQuery}”.
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Try a different spelling, or search by email, name, title, or ID.
              </p>
            </div>
          ) : (
            <div>
              {GLOBAL_GROUP_ORDER.map((g) => {
                const group = result[g];
                const items = group?.items ?? [];
                if (!items.length) return null;
                const shown = expanded.has(g) ? items : items.slice(0, TOP_N);
                const canExpand = group.total > shown.length;
                return (
                  <div key={g} data-testid={`command-palette-group-${g}`}>
                    {/* Group label — design-system Label style */}
                    <div
                      className="px-4 pt-3 pb-1"
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--neutral-700)',
                      }}
                    >
                      {GLOBAL_GROUP_LABELS[g]}
                    </div>
                    {shown.map((row) => {
                      const idx = rowIndexMap.get(row) ?? 0;
                      const isActive = idx === activeIndex;
                      return (
                        <div
                          key={rowKey(row)}
                          data-testid="command-palette-row"
                          className="flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer"
                          style={{
                            background: isActive ? 'var(--content-bg)' : 'transparent',
                          }}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => handleRowClick(row)}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              background: 'var(--neutral-100)',
                              color: 'var(--neutral-700)',
                            }}
                          >
                            {GROUP_ICONS[g]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-sm font-medium truncate"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {rowLabel(row)}
                            </p>
                            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                              {row.breadcrumb}
                            </p>
                          </div>
                          {isActive && (
                            <ArrowRight size={16} style={{ color: 'var(--brand-primary)' }} />
                          )}
                        </div>
                      );
                    })}
                    {canExpand && (
                      <button
                        type="button"
                        data-testid={`command-palette-see-all-${g}`}
                        className="w-full text-left px-4 py-2 text-[13px] font-medium"
                        style={{ color: 'var(--brand-primary)' }}
                        onClick={() => handleExpand(g)}
                      >
                        See all {group.total} results
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer — keyboard hints + navigate to prefilled list page */}
        {result && flattened.length > 0 && (
          <div
            className="flex items-center gap-4 px-6 py-3 text-xs border-t"
            style={{ borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}
          >
            <span className="flex items-center gap-1">
              <kbd
                className="px-1.5 py-0.5 rounded border"
                style={{ borderColor: 'var(--card-border)', background: 'var(--neutral-100)' }}
              >
                ↑
              </kbd>
              <kbd
                className="px-1.5 py-0.5 rounded border"
                style={{ borderColor: 'var(--card-border)', background: 'var(--neutral-100)' }}
              >
                ↓
              </kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd
                className="px-1.5 py-0.5 rounded border"
                style={{ borderColor: 'var(--card-border)', background: 'var(--neutral-100)' }}
              >
                ↵
              </kbd>
              open
            </span>
            <span className="flex items-center gap-1">
              <kbd
                className="px-1.5 py-0.5 rounded border"
                style={{ borderColor: 'var(--card-border)', background: 'var(--neutral-100)' }}
              >
                esc
              </kbd>
              close
            </span>
            <span className="ml-auto flex items-center gap-3">
              {(['users', 'listings', 'trades'] as const).map((g) => {
                const group = result[g];
                if (!group || group.total === 0) return null;
                return (
                  <button
                    key={g}
                    type="button"
                    data-testid={`command-palette-view-all-${g}`}
                    className="font-medium hover:underline"
                    style={{ color: 'var(--text-secondary)' }}
                    onClick={() => goTo(viewAllHref(g, debouncedQuery))}
                  >
                    View all {GLOBAL_GROUP_LABELS[g].toLowerCase()} →
                  </button>
                );
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
