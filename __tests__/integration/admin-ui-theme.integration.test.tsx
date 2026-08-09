// File: p2p-kids-admin/__tests__/integration/admin-ui-theme.integration.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminShell } from '@/components/layout/AdminShell';

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

// The bell badge + sidebar badge read a live admin API on a 60s poll — mock it
// so the shell integration tests stay isolated from the network.
vi.mock('@/hooks/useActionCenterCount', () => ({
  useActionCenterCount: () => ({ total: 5, loading: false, refresh: async () => {} }),
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

  it('should apply theme colors correctly', async () => {
    const { container } = render(
      <AdminShell>
        <div>Content</div>
      </AdminShell>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Toggle sidebar')).toBeInTheDocument();
    });

    const sidebar = container.querySelector('aside');
    const main = container.querySelector('main');

    expect(sidebar?.getAttribute('style')).toContain('var(--sidebar-bg)');
    expect(main?.getAttribute('style')).toContain('var(--content-bg)');
  });

  it('should navigate between pages via sidebar links', async () => {
    render(
      <AdminShell>
        <div>Dashboard</div>
      </AdminShell>
    );

    await waitFor(() => {
      expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();
    });

    // All nav links should be rendered
    expect(screen.getByTestId('nav-users')).toBeInTheDocument();
    expect(screen.getByTestId('nav-subscriptions')).toBeInTheDocument();
    expect(screen.getByTestId('nav-sp-economy')).toBeInTheDocument();
    expect(screen.getByTestId('nav-badges')).toBeInTheDocument();
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

  it('should render notification bell with live count badge', async () => {
    render(
      <AdminShell>
        <div>Content</div>
      </AdminShell>
    );

    await waitFor(() => {
      const bell = screen.getByLabelText('Notifications');
      expect(bell).toBeInTheDocument();

      // Live count badge (Accent 500) shows the pending action count.
      const badge = bell.querySelector('[data-testid="notification-bell-badge"]');
      expect(badge).toBeTruthy();
      expect(badge?.textContent).toBe('5');
    });
  });
});
