// File: p2p-kids-admin/__tests__/components/layout/Sidebar.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Sidebar } from '@/components/layout/Sidebar';

// Controllable pathname so tests can exercise active-section auto-expand.
const mockPathname = vi.fn(() => '/');
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

// The Action Center count hook fetches a live admin API on a 60s poll — mock it
// so the Sidebar unit tests stay isolated from the network (count badge = 0).
vi.mock('@/hooks/useActionCenterCount', () => ({
  useActionCenterCount: () => ({ total: 0, loading: false, refresh: async () => {} }),
}));

describe('Sidebar', () => {
  it('should render brand name when not collapsed', () => {
    const onToggle = vi.fn();
    render(<Sidebar collapsed={false} onToggle={onToggle} />);
    
    expect(screen.getByText('Kids Admin')).toBeInTheDocument();
  });

  it('should hide brand name when collapsed', () => {
    const onToggle = vi.fn();
    const { container } = render(<Sidebar collapsed={true} onToggle={onToggle} />);
    
    const brandText = container.querySelector('.sidebar-brand-text');
    expect(brandText).toBeNull();
  });

  it('should call onToggle when hamburger clicked', () => {
    const onToggle = vi.fn();
    render(<Sidebar collapsed={false} onToggle={onToggle} />);
    
    const toggleButton = screen.getByLabelText('Toggle sidebar');
    fireEvent.click(toggleButton);
    
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('should render all navigation items', () => {
    const onToggle = vi.fn();
    render(<Sidebar collapsed={false} onToggle={onToggle} />);
    
    // Test key nav items
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Subscriptions')).toBeInTheDocument();
    expect(screen.getByText('SP Economy')).toBeInTheDocument();
    expect(screen.getByText('Badges')).toBeInTheDocument();
    expect(screen.getByText('Config')).toBeInTheDocument();
  });

  it('should highlight active route', () => {
    const onToggle = vi.fn();
    const { container } = render(<Sidebar collapsed={false} onToggle={onToggle} />);
    
    // Dashboard should be active when pathname is '/'
    const dashboardLink = container.querySelector('[href="/"]');
    const computedStyle = window.getComputedStyle(dashboardLink!);
    
    // Active state should have sidebar-active background
    expect(dashboardLink?.getAttribute('style')).toContain('sidebar-active');
  });

  it('should apply correct width when collapsed', () => {
    const onToggle = vi.fn();
    const { container } = render(<Sidebar collapsed={true} onToggle={onToggle} />);
    
    const sidebar = container.querySelector('aside');
    expect(sidebar?.style.width).toBe('64px');
  });

  it('should apply correct width when expanded', () => {
    const onToggle = vi.fn();
    const { container } = render(<Sidebar collapsed={false} onToggle={onToggle} />);
    
    const sidebar = container.querySelector('aside');
    expect(sidebar?.style.width).toBe('var(--sidebar-width)');
  });
});

describe('Sidebar grouped navigation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockPathname.mockReturnValue('/');
  });

  it('renders the 7 grouped section labels (uppercase)', () => {
    const onToggle = vi.fn();
    render(<Sidebar collapsed={false} onToggle={onToggle} />);

    ['OVERVIEW', 'TRADE OPERATIONS', 'USERS & TRUST', 'MONETIZATION', 'CATALOG', 'PLATFORM CONFIG', 'ANALYTICS'].forEach(
      (label) => expect(screen.getByRole('button', { name: new RegExp(`^${label}$`, 'i') })).toBeInTheDocument(),
    );
  });

  it('collapses and re-expands a section via its header', () => {
    const onToggle = vi.fn();
    render(<Sidebar collapsed={false} onToggle={onToggle} />);

    // Items visible by default (first visit = all sections expanded)
    expect(screen.getByText('Subscriptions')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('nav-section-monetization'));
    expect(screen.queryByText('Subscriptions')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('nav-section-monetization'));
    expect(screen.getByText('Subscriptions')).toBeInTheDocument();
  });

  it('persists section state to localStorage scoped per admin', async () => {
    const onToggle = vi.fn();
    render(<Sidebar collapsed={false} onToggle={onToggle} adminKey="admin@test" />);

    fireEvent.click(screen.getByTestId('nav-section-monetization'));

    await waitFor(() => {
      const raw = window.localStorage.getItem('kids-admin:sidebar-sections:admin@test');
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw!).monetization).toBe(false);
    });
  });

  it('auto-expands the parent section of the active route on load', async () => {
    const onToggle = vi.fn();
    // Seed a state where PLATFORM CONFIG is collapsed.
    window.localStorage.setItem(
      'kids-admin:sidebar-sections:default',
      JSON.stringify({
        overview: true,
        'trade-operations': false,
        'users-trust': false,
        monetization: false,
        catalog: false,
        'platform-config': false,
        analytics: false,
      }),
    );
    mockPathname.mockReturnValue('/tax/rules');

    render(<Sidebar collapsed={false} onToggle={onToggle} />);

    // Tax Rules lives under PLATFORM CONFIG — it must be visible even though
    // the section was collapsed, because the active route auto-expands it.
    expect(await screen.findByText('Tax Rules')).toBeInTheDocument();
  });

  it('renders every destination as an icon in the collapsed rail', () => {
    const onToggle = vi.fn();
    const { container } = render(<Sidebar collapsed={true} onToggle={onToggle} />);

    // Labels are hidden in the rail, but every link still exists.
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(container.querySelector('[href="/users"]')).not.toBeNull();
    expect(container.querySelector('[href="/tax/rules"]')).not.toBeNull();
  });
});
