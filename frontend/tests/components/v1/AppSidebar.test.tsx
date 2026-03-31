import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppSidebar } from '@/components/v1/AppSidebar';

describe('AppSidebar', () => {
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
});
