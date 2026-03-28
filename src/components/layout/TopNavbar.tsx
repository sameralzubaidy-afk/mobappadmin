// File: p2p-kids-admin/src/components/layout/TopNavbar.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, Search, MoreHorizontal, ChevronDown, X } from 'lucide-react';

interface TopNavbarProps {
  /** Pixel offset from left to account for sidebar width */
  sidebarWidth: number;
  adminName?:   string;
  adminAvatar?: string;
}

export function TopNavbar({ sidebarWidth, adminName = 'Admin', adminAvatar }: TopNavbarProps) {
  const [searchValue, setSearchValue] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearch(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      {/* Search */}
      <div className="relative flex-shrink-0" ref={searchRef}>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
            onClick={() => setShowSearch(!showSearch)}
          />
          <input
            type="text"
            placeholder="Search…"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && searchValue.trim()) {
                console.log('Search:', searchValue);
                // TODO(SEARCH): Connect to global search API
              }
            }}
            onFocus={() => setShowSearch(true)}
            data-testid="topbar-global-search"
            className="pl-9 pr-4 py-2 rounded-full text-sm outline-none transition-shadow focus:shadow-md cursor-pointer"
            style={{
              width:      '220px',
              background: 'var(--content-bg)',
              border:     '1px solid var(--card-border)',
              color:      'var(--text-primary)',
            }}
          />
        </div>

        {/* Search Results Dropdown */}
        {showSearch && (
          <div
            className="absolute top-full left-0 mt-2 w-64 rounded-lg shadow-lg z-50 overflow-hidden"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
            }}
          >
            {searchValue.trim() ? (
              <div className="p-4">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No results found for &quot;{searchValue}&quot;
                </p>
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  Tip: Search by user email, name, node, or subscription status
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                <div
                  className="px-3 py-2 rounded text-sm cursor-pointer"
                  style={{
                    background: 'var(--content-bg)',
                    color: 'var(--text-secondary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--sidebar-active)';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--content-bg)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  <span style={{ color: 'var(--brand-primary)', fontWeight: 'bold' }}>?</span> Users
                </div>
                <div
                  className="px-3 py-2 rounded text-sm cursor-pointer"
                  style={{
                    background: 'var(--content-bg)',
                    color: 'var(--text-secondary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--sidebar-active)';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--content-bg)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  <span style={{ color: 'var(--brand-accent)', fontWeight: 'bold' }}>💳</span> Subscriptions
                </div>
                <div
                  className="px-3 py-2 rounded text-sm cursor-pointer"
                  style={{
                    background: 'var(--content-bg)',
                    color: 'var(--text-secondary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--sidebar-active)';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--content-bg)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  <span style={{ color: 'var(--brand-green)', fontWeight: 'bold' }}>🏅</span> Badges
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Spacer → push brand to center */}
      <div className="flex-1" />

      {/* Brand logo (center) */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div
          className="w-7 h-7 rounded-full"
          style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)' }}
        />
        <span className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
          Kids<span style={{ color: 'var(--brand-primary)' }}>Admin</span>
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Notification bell with orange dot */}
        <div className="relative" ref={notifRef}>
          <button
            className="relative w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'var(--content-bg)' }}
            aria-label="Notifications"
            data-testid="notification-bell"
            onClick={() => setShowNotifications(!showNotifications)}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--card-border)';
            }}
            onMouseLeave={(e) => {
              if (!showNotifications) {
                e.currentTarget.style.background = 'var(--content-bg)';
              }
            }}
          >
            <Bell size={18} style={{ color: 'var(--text-secondary)' }} />
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
              style={{ background: 'var(--brand-accent)' }}
            />
          </button>

          {/* Notifications Dropdown Panel */}
          {showNotifications && (
            <div
              className="absolute top-full right-0 mt-2 w-80 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
              }}
            >
              <div
                className="p-4 border-b font-bold flex items-center justify-between sticky top-0"
                style={{
                  borderColor: 'var(--card-border)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-primary)',
                }}
              >
                <span>Notifications</span>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="p-1 hover:rounded transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Empty state */}
              <div className="p-8 text-center">
                <Bell
                  size={32}
                  style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }}
                />
                <p style={{ color: 'var(--text-muted)' }} className="text-sm">
                  No new notifications
                </p>
                <p style={{ color: 'var(--text-muted)' }} className="text-xs mt-1">
                  Activity updates will appear here
                </p>
              </div>

              {/* TODO: Replace empty state with real notifications from DB */}
              {/* Example notification structure - add when real notifications are available:
                <div className="px-4 py-3 border-b cursor-pointer transition-colors">
                  <p className="font-medium text-sm">User Signup</p>
                  <p className="text-xs mt-1">john@example.com joined Kids Club+</p>
                  <p className="text-xs mt-1">2 minutes ago</p>
                </div>
              */}
            </div>
          )}
        </div>

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
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ background: 'var(--brand-primary)' }}
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
