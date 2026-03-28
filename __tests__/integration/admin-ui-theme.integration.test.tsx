// File: p2p-kids-admin/__tests__/integration/admin-ui-theme.integration.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminShell } from '@/components/layout/AdminShell';
import { theme } from '@/styles/theme';

// Mock Next.js navigation and Supabase
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/',
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'admin-123',
            email: 'admin@test.com',
          },
        },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  }),
}));

describe('Admin UI Theme Integration', () => {
  beforeEach(() => {
    // Reset any theme-related state
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render admin shell with sidebar and topbar', async () => {
    render(
      <AdminShell>
        <div data-testid="page-content">Dashboard Content</div>
      </AdminShell>
    );

    await waitFor(() => {
      expect(screen.getByTestId('page-content')).toBeInTheDocument();
    });

    // Sidebar should be present
    expect(screen.getByText('Kids Admin')).toBeInTheDocument();
    
    // TopNavbar should be present
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument();
  });

  it('should toggle sidebar collapse state', async () => {
    render(
      <AdminShell>
        <div>Content</div>
      </AdminShell>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Toggle sidebar')).toBeInTheDocument();
    });

    const toggleButton = screen.getByLabelText('Toggle sidebar');
    
    // Sidebar should start expanded
    expect(screen.getByText('Kids Admin')).toBeInTheDocument();
    
    // Click to collapse
    fireEvent.click(toggleButton);
    
    // Brand text should be hidden when collapsed
    await waitFor(() => {
      const brandText = document.querySelector('.sidebar-brand-text');
      expect(brandText).toBeNull();
    });
  });

  it('should apply theme colors correctly', () => {
    const { container } = render(
      <AdminShell>
        <div>Content</div>
      </AdminShell>
    );

    // Check CSS variables are defined
    const root = document.documentElement;
    const sidebarBg = getComputedStyle(root).getPropertyValue('--sidebar-bg');
    const contentBg = getComputedStyle(root).getPropertyValue('--content-bg');
    
    expect(sidebarBg).toBeTruthy();
    expect(contentBg).toBeTruthy();
  });

  it('should navigate between pages via sidebar links', async () => {
    render(
      <AdminShell>
        <div>Dashboard</div>
      </AdminShell>
    );

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // All nav links should be rendered
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Subscriptions')).toBeInTheDocument();
    expect(screen.getByText('SP Wallet')).toBeInTheDocument();
    expect(screen.getByText('Badges')).toBeInTheDocument();
  });

  it('should show admin name in top navbar', async () => {
    render(
      <AdminShell>
        <div>Content</div>
      </AdminShell>
    );

    await waitFor(() => {
      // Should show email prefix as admin name
      expect(screen.getByText('admin')).toBeInTheDocument();
    });
  });

  it('should render notification bell with indicator', async () => {
    render(
      <AdminShell>
        <div>Content</div>
      </AdminShell>
    );

    await waitFor(() => {
      const bell = screen.getByLabelText('Notifications');
      expect(bell).toBeInTheDocument();
      
      // Orange indicator dot should be present
      const indicator = bell.querySelector('[style*="background"]');
      expect(indicator).toBeTruthy();
    });
  });
});
