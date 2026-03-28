// File: p2p-kids-admin/src/components/layout/AdminShell.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar }    from './Sidebar';
import { TopNavbar }  from './TopNavbar';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH  = 256;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminName, setAdminName] = useState('Admin');
  const [adminAvatar, setAdminAvatar] = useState<string | undefined>(undefined);

  const sidebarWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  useEffect(() => {
    // Don't protect auth pages
    if (pathname.startsWith('/auth/')) {
      setIsLoading(false);
      return;
    }

    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.log('No user found, redirecting to login');
          router.push('/auth/login');
          return;
        }

        console.log('User authenticated:', user.email);
        setAdminName(user.email?.split('@')[0] || 'Admin');
        setIsAuthenticated(true);
        setIsLoading(false);
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/auth/login');
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

    return () => subscription?.unsubscribe();
  }, [router, pathname]);

  // Auth pages render without shell
  if (pathname.startsWith('/auth/')) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--content-bg)' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
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
      />
      <TopNavbar
        sidebarWidth={sidebarWidth}
        adminName={adminName}
        adminAvatar={adminAvatar}
      />
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
