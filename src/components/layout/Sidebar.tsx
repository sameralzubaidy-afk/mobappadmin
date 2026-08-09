// File: p2p-kids-admin/src/components/layout/Sidebar.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Coins,
  Award,
  BarChart2,
  MapPin,
  Settings,
  Menu,
  ChevronDown,
  Package,
  MessageSquare,
  FileText,
  TrendingUp,
  IdCard,
  Gift,
  AlertTriangle,
  GraduationCap,
  HelpCircle,
  HeadphonesIcon,
  Clock,
  Receipt,
  Percent,
  Wallet,
  ListChecks,
} from 'lucide-react';
import { useActionCenterCount } from '@/hooks/useActionCenterCount';

interface NavItem {
  label: string;
  href:  string;
  icon:  React.ReactNode;
}

interface NavSection {
  id:    string;
  label: string;
  items: NavItem[];
}

/**
 * Grouped navigation. Section order/labels mirror the admin IA:
 * OVERVIEW / TRADE OPERATIONS / USERS & TRUST / MONETIZATION / CATALOG /
 * PLATFORM CONFIG / ANALYTICS.
 *
 * NOTE (2026-08-08):
 * - "Action Center" is a pinned OVERVIEW item that aggregates every pending
 *   admin action (flagged items, disputes, ID badge requests, cancellation
 *   spikes, failed payouts, config drift) with a live count badge.
 * - "Badges" + "Listings" were kept (both were previously reachable from this
 *   sidebar) and placed in USERS & TRUST / CATALOG respectively, so no admin
 *   loses access to an existing page.
 */
const NAV_SECTIONS: NavSection[] = [
  {
    id:    'overview',
    label: 'Overview',
    items: [
      { label: 'Action Center', href: '/action-center', icon: <ListChecks size={18} /> },
      { label: 'Dashboard',     href: '/',               icon: <LayoutDashboard size={18} /> },
    ],
  },
  {
    id:    'trade-operations',
    label: 'Trade Operations',
    items: [
      { label: 'Trades',            href: '/trades',               icon: <TrendingUp    size={18} /> },
      { label: 'Disputes',          href: '/trades/disputes',      icon: <AlertTriangle size={18} /> },
      { label: 'Flagged Items',     href: '/items/flagged',        icon: <AlertTriangle size={18} /> },
      { label: 'Cancel Insights',   href: '/cancellation-insights', icon: <BarChart2   size={18} /> },
      { label: 'Reviews',           href: '/reviews',              icon: <MessageSquare size={18} /> },
    ],
  },
  {
    id:    'users-trust',
    label: 'Users & Trust',
    items: [
      { label: 'Users',     href: '/users',     icon: <Users    size={18} /> },
      { label: 'ID Badges', href: '/id-badges', icon: <IdCard   size={18} /> },
      { label: 'Waitlist',  href: '/waitlist',  icon: <FileText size={18} /> },
      { label: 'Badges',    href: '/badges',    icon: <Award    size={18} /> },
    ],
  },
  {
    id:    'monetization',
    label: 'Monetization',
    items: [
      { label: 'Subscriptions', href: '/subscriptions', icon: <CreditCard size={18} /> },
      { label: 'Payments',      href: '/payments',      icon: <Wallet     size={18} /> },
      { label: 'Payouts',       href: '/payouts',       icon: <FileText   size={18} /> },
      // SP Economy is the single hub that consolidates SP Wallet + SP Analytics.
      // Old routes (/sp-wallet, /sp-analytics) still work for direct deep-links.
      { label: 'SP Economy',    href: '/sp-economy',    icon: <Coins      size={18} /> },
      { label: 'Referrals',     href: '/referrals',     icon: <Gift       size={18} /> },
    ],
  },
  {
    id:    'catalog',
    label: 'Catalog',
    items: [
      { label: 'Categories',       href: '/categories',           icon: <Settings       size={18} /> },
      { label: 'Category Mapping', href: '/tax/category-mapping', icon: <Settings       size={18} /> },
      { label: 'Education',        href: '/education',            icon: <GraduationCap  size={18} /> },
      { label: 'FAQ',              href: '/education/faq',        icon: <HelpCircle     size={18} /> },
      { label: 'Listings',         href: '/listings',             icon: <Package       size={18} /> },
    ],
  },
  {
    id:    'platform-config',
    label: 'Platform Config',
    items: [
      { label: 'Config',        href: '/config',                icon: <Settings       size={18} /> },
      { label: 'Tax Rules',     href: '/tax/rules',             icon: <FileText       size={18} /> },
      { label: 'Tax Reports',   href: '/tax/reports',           icon: <Receipt        size={18} /> },
      { label: 'Tax Settings',  href: '/tax/settings',          icon: <Percent        size={18} /> },
      { label: 'Tax Nodes',     href: '/tax/nodes',             icon: <MapPin         size={18} /> },
      { label: 'Cart Settings', href: '/settings/cart',         icon: <Settings       size={18} /> },
      { label: 'Trade Timing',  href: '/settings/trade-timing', icon: <Clock          size={18} /> },
      { label: 'Policies',      href: '/settings/policies',     icon: <FileText       size={18} /> },
      { label: 'Support',       href: '/support',               icon: <HeadphonesIcon size={18} /> },
      { label: 'Nodes',         href: '/nodes',                 icon: <MapPin         size={18} /> },
    ],
  },
  {
    id:    'analytics',
    label: 'Analytics',
    items: [
      { label: 'Analytics', href: '/analytics', icon: <BarChart2 size={18} /> },
    ],
  },
];

/** Flat list of every item — used for the collapsed icon rail. */
const ALL_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

interface SidebarProps {
  collapsed: boolean;
  onToggle:  () => void;
  /** Stable per-admin identity used to scope persisted section state. */
  adminKey?: string;
}

function isItemActive(item: NavItem, pathname: string): boolean {
  return item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
}

/** Reads saved section state. Returns null when nothing was persisted yet. */
function loadExpandedSections(storageKey: string): Record<string, boolean> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, boolean>;
    }
  } catch {
    /* corrupted stored state — treat as first visit */
  }
  return null;
}

export function Sidebar({ collapsed, onToggle, adminKey }: SidebarProps) {
  const pathname = usePathname();
  // Live pending-action count for the Action Center badge (polled in the hook).
  const { total: actionCount } = useActionCenterCount();

  // Per-admin storage key so each admin's expanded/collapsed choices are kept
  // separate across sessions (requirement: "persists per admin across sessions").
  const storageKey = useMemo(
    () => `kids-admin:sidebar-sections:${adminKey || 'default'}`,
    [adminKey],
  );

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const saved = loadExpandedSections(storageKey);
    if (saved) return saved;
    // First visit (or corrupt state) — default to everything expanded so no
    // navigation destinations are hidden from a new admin.
    return Object.fromEntries(NAV_SECTIONS.map((s) => [s.id, true]));
  });

  // Persist section state per admin across sessions.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(expandedSections));
    } catch {
      /* storage unavailable — state still works for this session */
    }
  }, [expandedSections, storageKey]);

  // Auto-expand the section that contains the active route (on load + on every
  // navigation), so the current page's parent group is always visible.
  useEffect(() => {
    const activeSection = NAV_SECTIONS.find((s) =>
      s.items.some((item) => isItemActive(item, pathname)),
    );
    if (activeSection) {
      setExpandedSections((prev) =>
        prev[activeSection.id] ? prev : { ...prev, [activeSection.id]: true },
      );
    }
  }, [pathname]);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderItem = (item: NavItem, isRail: boolean) => {
    const isActive = isItemActive(item, pathname);
    // Live count badge (Accent 500 background) on the Action Center item only.
    const isActionCenter = item.href === '/action-center';
    const showBadge = isActionCenter && actionCount > 0;
    return (
      <Link
        key={item.href}
        href={item.href}
        data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group"
        style={{
          background: isActive ? 'var(--sidebar-active)' : 'transparent',
          color:      isActive ? 'var(--sidebar-text)' : 'var(--sidebar-item-inactive)',
        }}
        title={isRail ? item.label : undefined}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; // light hover
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.background = 'transparent';
        }}
      >
        {/* Icon */}
        <span className="flex-shrink-0">{item.icon}</span>

        {/* Label — hidden in the collapsed icon rail */}
        {!isRail && (
          <span className="nav-label flex-1 text-sm font-medium">{item.label}</span>
        )}

        {/* Live count badge — Accent 500 background, white text (badge style) */}
        {showBadge && (
          <span
            className={`inline-flex items-center justify-center rounded-full text-white font-semibold ${
              isRail ? 'w-4 h-4 text-[9px]' : 'w-5 h-5 text-[10px]'
            }`}
            style={{ background: 'var(--brand-accent)' }}
            data-testid="action-center-nav-badge"
            title={`${actionCount} pending actions`}
          >
            {actionCount > 99 ? '99+' : actionCount}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside
      className="fixed top-0 left-0 h-screen flex flex-col z-30 transition-all duration-300"
      style={{
        width:      collapsed ? '64px' : 'var(--sidebar-width)',
        background: 'var(--sidebar-bg)',
        boxShadow:  'var(--sidebar-shadow)',
      }}
    >
      {/* Brand header */}
      <div className="flex items-center h-16 px-4 flex-shrink-0 border-b border-gray-200">
        <button
          onClick={onToggle}
          aria-label="Toggle sidebar"
          data-testid="sidebar-toggle"
          className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100 transition-colors text-gray-700 flex-shrink-0"
        >
          <Menu size={20} />
        </button>
        {!collapsed && (
          <div className="ml-3 flex items-center gap-2 sidebar-brand-text">
            {/* Brand logo circle — flat Primary 500 (no gradient) */}
            <div className="w-7 h-7 rounded-full flex-shrink-0" style={{ background: 'var(--brand-primary)' }} />
            {/* "Kids" Neutral 900 on light sidebar, "Admin" Primary 500 (brand accent) */}
            <span className="nav-label font-semibold text-sm tracking-wide">
              <span style={{ color: 'var(--text-primary)' }}>Kids </span>
              <span style={{ color: 'var(--brand-primary)' }}>Admin</span>
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {collapsed ? (
          /* Icon rail — every destination as an icon, labels hidden */
          <div className="space-y-1">
            {ALL_ITEMS.map((item) => renderItem(item, true))}
          </div>
        ) : (
          <div className="space-y-6">
            {NAV_SECTIONS.map((section) => {
              const isExpanded = !!expandedSections[section.id];
              return (
                <div key={section.id} className="sidebar-section">
                  {/* Section header — uppercase Label style + chevron */}
                  <button
                    type="button"
                    data-testid={`nav-section-${section.id}`}
                    aria-expanded={isExpanded}
                    onClick={() => toggleSection(section.id)}
                    className="flex items-center justify-between w-full px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    <span
                      className="nav-label text-xs font-medium uppercase"
                      style={{
                        color:        'var(--sidebar-section-label)',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {section.label}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`nav-arrow transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`}
                      style={{ color: 'var(--sidebar-muted)' }}
                    />
                  </button>

                  {/* Items — 8px vertical rhythm */}
                  {isExpanded && (
                    <div className="mt-1 space-y-2">
                      {section.items.map((item) => renderItem(item, false))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>

      {/* Footer spacer */}
      <div className="h-4 flex-shrink-0" />
    </aside>
  );
}
