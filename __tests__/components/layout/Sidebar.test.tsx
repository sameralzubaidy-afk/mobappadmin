// File: p2p-kids-admin/__tests__/components/layout/Sidebar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '@/components/layout/Sidebar';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
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
