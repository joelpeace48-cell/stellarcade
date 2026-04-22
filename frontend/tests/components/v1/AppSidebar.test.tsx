import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppSidebar } from '@/components/v1/AppSidebar';

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('AppSidebar', () => {
  afterEach(() => {
    mockMatchMedia(false);
  });

  it('renders as a single named primary navigation landmark', () => {
    const onNavigate = vi.fn();

    render(<AppSidebar currentRoute="lobby" onNavigate={onNavigate} />);

    expect(screen.getByRole('navigation', { name: /primary dashboard/i })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /sidebar navigation/i })).not.toBeInTheDocument();
  });

  it('renders grouped navigation and highlights the active route', () => {
    const onNavigate = vi.fn();

    render(<AppSidebar currentRoute="profile" onNavigate={onNavigate} />);

    expect(screen.getByText('Play')).toBeInTheDocument();
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByTestId('app-sidebar-link-profile')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('app-sidebar-link-lobby')).not.toHaveAttribute('aria-current');
  });

  it('supports mobile open/close toggle behavior', () => {
    const onNavigate = vi.fn();

    render(<AppSidebar currentRoute="lobby" onNavigate={onNavigate} />);

    const sidebar = screen.getByTestId('app-sidebar');
    expect(sidebar).not.toHaveClass('is-mobile-open');

    fireEvent.click(screen.getByTestId('app-sidebar-mobile-toggle'));
    expect(sidebar).toHaveClass('is-mobile-open');

    fireEvent.click(screen.getByTestId('app-sidebar-mobile-close'));
    expect(sidebar).not.toHaveClass('is-mobile-open');
  });

  it('supports desktop collapse and calls onNavigate when selecting a route', () => {
    const onNavigate = vi.fn();

    render(<AppSidebar currentRoute="lobby" onNavigate={onNavigate} />);

    const sidebar = screen.getByTestId('app-sidebar');
    expect(sidebar).not.toHaveClass('is-collapsed');

    fireEvent.click(screen.getByTestId('app-sidebar-collapse-toggle'));
    expect(sidebar).toHaveClass('is-collapsed');

    fireEvent.click(screen.getByTestId('app-sidebar-link-games'));
    expect(onNavigate).toHaveBeenCalledWith('games');
  });

  it('keeps closed mobile navigation out of the focus order until opened', () => {
    mockMatchMedia(true);
    const onNavigate = vi.fn();

    render(<AppSidebar currentRoute="lobby" onNavigate={onNavigate} />);

    const toggle = screen.getByTestId('app-sidebar-mobile-toggle');
    const sidebar = screen.getByTestId('app-sidebar');

    expect(toggle).toHaveAttribute('aria-controls', 'primary-dashboard-navigation');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(sidebar).toHaveAttribute('aria-hidden', 'true');
    expect(sidebar).toHaveAttribute('inert');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(sidebar).not.toHaveAttribute('aria-hidden');
    expect(sidebar).not.toHaveAttribute('inert');
  });
});
