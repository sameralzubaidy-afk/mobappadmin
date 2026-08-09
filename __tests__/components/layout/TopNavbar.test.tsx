// File: p2p-kids-admin/__tests__/components/layout/TopNavbar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopNavbar } from '@/components/layout/TopNavbar';

// The bell navigates via useRouter, and the badge reads a live admin API on a
// 60s poll — mock both so these unit tests are isolated from the router and network.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/hooks/useActionCenterCount', () => ({
  useActionCenterCount: () => ({ total: 5, loading: false, refresh: async () => {} }),
}));

describe('TopNavbar', () => {
  it('should render search input', () => {
    render(<TopNavbar sidebarWidth={256} />);
    
    const searchInput = screen.getByPlaceholderText('Search…');
    expect(searchInput).toBeInTheDocument();
  });

  it('should update search value on input change', () => {
    render(<TopNavbar sidebarWidth={256} />);
    
    const searchInput = screen.getByPlaceholderText('Search…') as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'test search' } });
    
    expect(searchInput.value).toBe('test search');
  });

  it('should render brand logo and name', () => {
    render(<TopNavbar sidebarWidth={256} />);

    const brandMatches = screen.getAllByText((_, element) => element?.textContent === 'KidsAdmin');
    expect(brandMatches.length).toBeGreaterThan(0);
  });

  it('should render notification bell with live count badge', () => {
    render(<TopNavbar sidebarWidth={256} />);
    
    const bell = screen.getByLabelText('Notifications');
    expect(bell).toBeInTheDocument();
    
    // Live count badge (Accent 500) — shows the pending action count.
    const badge = bell.querySelector('[data-testid="notification-bell-badge"]');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe('5');
  });

  it('should render admin profile with name', () => {
    render(<TopNavbar sidebarWidth={256} adminName="John Doe" />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should render admin profile with avatar initial when no avatar provided', () => {
    render(<TopNavbar sidebarWidth={256} adminName="Alice Admin" />);
    
    const profileButton = screen.getByLabelText('Admin profile');
    expect(profileButton.textContent).toContain('A'); // First letter initial
  });

  it('should render admin profile with avatar image when provided', () => {
    render(<TopNavbar sidebarWidth={256} adminName="Bob" adminAvatar="https://example.com/avatar.jpg" />);

    const img = screen.getByAltText('Bob') as HTMLImageElement;
    expect(img.src).toContain('https://example.com/avatar.jpg');
  });

  it('should adjust positioning based on sidebar width', () => {
    const { container } = render(<TopNavbar sidebarWidth={200} />);
    
    const header = container.querySelector('header');
    expect(header?.style.left).toBe('200px');
  });

  it('should render more options button', () => {
    render(<TopNavbar sidebarWidth={256} />);
    
    const moreButton = screen.getByLabelText('More options');
    expect(moreButton).toBeInTheDocument();
  });
});
