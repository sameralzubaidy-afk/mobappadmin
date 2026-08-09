// File: p2p-kids-admin/src/components/layout/TopNavbar.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Search, MoreHorizontal, ChevronDown } from 'lucide-react';
import { useActionCenterCount } from '@/hooks/useActionCenterCount';

interface TopNavbarProps {
  /** Pixel offset from left to account for sidebar width */
  sidebarWidth: number;
  adminName?:   string;
  adminAvatar?: string;
  /** Opens the global command palette (⌘K). Fired when the header search bar is clicked or focused. */
  onOpenSearch?: () => void;
}

export function TopNavbar({ sidebarWidth, adminName = 'Admin', adminAvatar, onOpenSearch }: TopNavbarProps) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState('');
  // Live pending-action count for the bell badge (polled in the hook).
  const { total: actionCount } = useActionCenterCount();

  return (
    <header
      className="fixed top-0 right-0 z-20 flex items-center px-6 gap-4 transition-all duration-300"
      style={{
        left:        `${sidebarWidth}px`,
        height:      'var(--topbar-height)',
        background:  'var(--topbar-bg)',
        borderBottom: '1px solid var(--topbar-border)',
      }}
    >
      {/* Search — opens the global command palette (⌘K) */}
      <div className="relative flex-shrink-0">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
            onClick={() => onOpenSearch?.()}
          />
          <input
            type="text"
            placeholder="Search…"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onFocus={() => onOpenSearch?.()}
            onClick={() => onOpenSearch?.()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onOpenSearch?.();
              }
            }}
            data-testid="topbar-global-search"
            aria-label="Global search (⌘K)"
            className="pl-9 pr-4 py-2 rounded-full text-sm outline-none transition-shadow focus:shadow-md cursor-pointer"
            style={{
              width:      '220px',
              background: 'var(--neutral-100)', // design-system Search Bar (§6.3)
              border:     'none',
              color:      'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {/* Spacer → push brand to center */}
      <div className="flex-1" />

      {/* Brand logo (center) — flat Primary 500 circle, "Kids" Neutral 900 + "Admin" Primary 500 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div
          className="w-7 h-7 rounded-full"
          style={{ background: 'var(--brand-primary)' }}
        />
        <span className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
          Kids<span style={{ color: 'var(--brand-primary)' }}>Admin</span>
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Notification bell → opens the Action Center (live count badge) */}
        <button
          className="relative w-9 h-9 rounded-full flex items-center justify-center transition-colors"
          style={{ background: 'var(--content-bg)' }}
          aria-label="Notifications"
          data-testid="notification-bell"
          onClick={() => router.push('/action-center')}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--card-border)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--content-bg)';
          }}
        >
          <Bell size={18} style={{ color: 'var(--text-secondary)' }} />
          {/* Live count badge — Accent 500 background, per SP/notification badge style */}
          {actionCount > 0 && (
            <span
              className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-semibold text-white flex items-center justify-center"
              style={{ background: 'var(--brand-accent)' }}
              data-testid="notification-bell-badge"
            >
              {actionCount > 99 ? '99+' : actionCount}
            </span>
          )}
        </button>

        {/* User profile pill */}
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors"
          style={{ background: 'var(--content-bg)' }}
          aria-label="Admin profile"
          data-testid="admin-profile-button"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--card-border)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--content-bg)';
          }}
          // TODO(AUTH): wire to admin logout / profile dropdown
        >
          {adminAvatar ? (
            <img src={adminAvatar} alt={adminName} className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: 'var(--brand-primary-100)', color: 'var(--brand-primary)' }} // Avatar (§7.2)
            >
              {adminName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {adminName}
          </span>
          <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
        </button>

        {/* 3-dot more menu */}
        <button
          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          aria-label="More options"
          data-testid="more-options-button"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--content-bg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <MoreHorizontal size={18} style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>
    </header>
  );
}
