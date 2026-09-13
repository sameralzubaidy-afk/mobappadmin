// File: p2p-kids-admin/src/components/layout/AdminShell.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar }         from './Sidebar';
import { TopNavbar }       from './TopNavbar';
import { CommandPalette }  from '../command-palette/CommandPalette';
// FIX-Task-23 item 2: ONE shared browser Supabase client. Every client component used
// to build its own, which put multiple GoTrue instances in the same browser context
// and made the `lock:sb-<ref>-auth-token` Web Lock contended.
import { supabaseBrowser as supabase } from '@/lib/supabase/client';
import { formatAgo } from '@/lib/formatAgo';

const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH  = 256;

/**
 * FIX-Task-23 item 2: bound the auth check.
 *
 * A wedged Web Lock (a suspended page holding `lock:sb-<ref>-auth-token` with pending
 * waiters) makes `supabase.auth.getUser()` never settle. The gate then rendered
 * "Loading..." forever — no timeout, no fallback redirect, no retry. This bound
 * guarantees an admin is redirected to sign-in instead of being stranded.
 */
const AUTH_TIMEOUT_MS = 5000;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminName, setAdminName] = useState('Admin');
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [adminAvatar, setAdminAvatar] = useState<string | undefined>(undefined);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // FIX-Task-23 item 7: freshness + retry for the auth gate itself, so a stuck admin
  // session shows a live state and a way out instead of a dead "Loading...".
  const [authCheckStartedAt, setAuthCheckStartedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [authAttempt, setAuthAttempt] = useState(0);

  const sidebarWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  useEffect(() => {
    // Don't protect auth pages
    if (pathname.startsWith('/auth/')) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const checkAuth = async () => {
      setIsLoading(true);
      setAuthCheckStartedAt(Date.now());
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('AUTH_TIMEOUT')), AUTH_TIMEOUT_MS);
        });
        const { data: { user } } = await Promise.race([supabase.auth.getUser(), timeout]);

        if (cancelled) return;

        if (!user) {
          console.log('No user found, redirecting to login');
          router.push('/auth/login');
          return;
        }

        console.log('User authenticated:', user.email);
        setAdminName(user.email?.split('@')[0] || 'Admin');
        setAdminEmail(user.email ?? '');
        setIsAuthenticated(true);
      } catch (error) {
        if (cancelled) return;
        // A timeout means the auth lock never released; an expired/401 session lands
        // here too. Either way the admin must not be left on a loading screen.
        console.error('Auth check failed or timed out:', error);
        router.push('/auth/login');
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (!cancelled) setIsLoading(false);
      }
    };

    checkAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        if (!session && !pathname.startsWith('/auth/')) {
          router.push('/auth/login');
        }
      }
    );

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [router, pathname, authAttempt]);

  // FIX-Task-23 item 7: 5s ticker so the gate's freshness label stays truthful.
  useEffect(() => {
    const ticker = setInterval(() => setNowTick(Date.now()), 5000);
    return () => clearInterval(ticker);
  }, []);

  const retryAuthCheck = useCallback(() => {
    setAuthAttempt((n) => n + 1);
  }, []);

  // Auth pages render without shell
  if (pathname.startsWith('/auth/')) {
    return <>{children}</>;
  }

  // FIX-Task-23 items 2 + 7: the gate reports how long it has been waiting and always
  // offers a way forward, so a wedged auth lock can never strand the portal again.
  if (isLoading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3"
        style={{ background: 'var(--content-bg)' }}
      >
        <p style={{ color: 'var(--text-secondary)' }}>Checking your admin session…</p>
        {authCheckStartedAt !== null && (
          <p className="text-xs text-gray-400" data-testid="auth-gate-freshness">
            Session check started {formatAgo(nowTick - authCheckStartedAt)}
          </p>
        )}
        <button
          type="button"
          onClick={retryAuthCheck}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          data-testid="auth-gate-retry"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={() => router.push('/auth/login')}
          className="text-xs text-gray-500 underline hover:text-gray-700"
          data-testid="auth-gate-signin"
        >
          Go to sign in
        </button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--content-bg)' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Redirecting to login...</p>
      </div>
    );
  }

  return (
    <>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        adminKey={adminEmail}
      />
      <TopNavbar
        sidebarWidth={sidebarWidth}
        adminName={adminName}
        adminAvatar={adminAvatar}
        onOpenSearch={() => setPaletteOpen(true)}
      />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <main
        className="min-h-screen transition-all duration-300"
        style={{
          paddingLeft: `${sidebarWidth}px`,
          paddingTop:  'var(--topbar-height)',
          background:  'var(--content-bg)',
        }}
      >
        <div className="p-6">
          {children}
        </div>
      </main>
    </>
  );
}
