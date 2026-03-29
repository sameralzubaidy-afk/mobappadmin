// File: p2p-kids-admin/src/components/layout/Sidebar.tsx
'use client';

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
  ChevronRight,
  Package,
  MessageSquare,
  FileText,
  TrendingUp,
  IdCard,
  Gift,
  AlertTriangle,
} from 'lucide-react';

interface NavItem {
  label:    string;
  href:     string;
  icon:     React.ReactNode;
  /** If true, show a chevron arrow (purely decorative for now) */
  hasSubmenu?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',     href: '/',               icon: <LayoutDashboard size={18} /> },
  { label: 'Users',         href: '/users',          icon: <Users          size={18} /> },
  { label: 'Subscriptions', href: '/subscriptions',  icon: <CreditCard     size={18} /> },
  { label: 'SP Wallet',     href: '/sp-wallet',      icon: <Coins          size={18} /> },
  { label: 'Badges',        href: '/badges',         icon: <Award          size={18} /> },
  { label: 'Listings',      href: '/listings',       icon: <Package        size={18} /> },
  { label: 'Flagged Items', href: '/items/flagged',  icon: <AlertTriangle  size={18} /> },
  { label: 'Trades',        href: '/trades',         icon: <TrendingUp     size={18} /> },
  { label: 'Reviews',       href: '/reviews',        icon: <MessageSquare  size={18} /> },
  { label: 'Analytics',     href: '/analytics',      icon: <BarChart2      size={18} /> },
  { label: 'Payouts',       href: '/payouts',        icon: <FileText       size={18} /> },
  { label: 'Referrals',     href: '/referrals',      icon: <Gift           size={18} /> },
  { label: 'ID Badges',     href: '/id-badges',      icon: <IdCard         size={18} /> },
  { label: 'Nodes',         href: '/nodes',          icon: <MapPin         size={18} /> },
  { label: 'Config',        href: '/config',         icon: <Settings       size={18} />, hasSubmenu: true },
];

interface SidebarProps {
  collapsed:    boolean;
  onToggle:     () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

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
      <div className="flex items-center h-16 px-4 flex-shrink-0 border-b border-white/10">
        <button
          onClick={onToggle}
          aria-label="Toggle sidebar"
          data-testid="sidebar-toggle"
          className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-white/10 transition-colors text-white flex-shrink-0"
        >
          <Menu size={20} />
        </button>
        {!collapsed && (
          <div className="ml-3 flex items-center gap-2 sidebar-brand-text">
            {/* Brand logo circle — orange/purple gradient matching design */}
            <div className="w-7 h-7 rounded-full flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)' }}
            />
            <span className="nav-label font-semibold text-white text-sm tracking-wide">
              Kids Admin
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group"
              style={{
                background: isActive ? 'var(--sidebar-active)' : 'transparent',
                color:      'var(--sidebar-text)',
              }}
              title={collapsed ? item.label : undefined}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              {/* Icon */}
              <span className="flex-shrink-0">{item.icon}</span>

              {/* Label — hidden when collapsed */}
              {!collapsed && (
                <>
                  <span className="nav-label flex-1 text-sm font-medium">{item.label}</span>
                  {item.hasSubmenu && (
                    <ChevronRight size={14} className="nav-arrow opacity-60" />
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer spacer */}
      <div className="h-4 flex-shrink-0" />
    </aside>
  );
}
