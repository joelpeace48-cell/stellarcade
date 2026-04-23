import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WidgetTransitionGuard } from '@/components/v1/WidgetTransitionGuard';

describe('WidgetTransitionGuard', () => {
  it('renders children', () => {
    render(
      <WidgetTransitionGuard populated={false}>
        <span>child content</span>
      </WidgetTransitionGuard>
    );
    expect(screen.getByText('child content')).toBeTruthy();
  });

  it('does NOT add animation class on initial render when populated=true', () => {
    render(
      <WidgetTransitionGuard populated={true}>
        <span>content</span>
      </WidgetTransitionGuard>
    );
    const guard = screen.getByTestId('widget-transition-guard');
    expect(guard.className).not.toContain('widget-transition--populate');
    expect(guard.getAttribute('data-animating')).toBe('false');
  });

  it('adds animation class when transitioning from populated=false to populated=true', () => {
    const { rerender } = render(
      <WidgetTransitionGuard populated={false}>
        <span>content</span>
      </WidgetTransitionGuard>
    );
    const guard = screen.getByTestId('widget-transition-guard');
    expect(guard.className).not.toContain('widget-transition--populate');

    rerender(
      <WidgetTransitionGuard populated={true}>
        <span>content</span>
      </WidgetTransitionGuard>
    );
    expect(guard.className).toContain('widget-transition--populate');
    expect(guard.getAttribute('data-animating')).toBe('true');
  });

  it('clears animation class after animationEnd event fires', () => {
    const { rerender } = render(
      <WidgetTransitionGuard populated={false}>
        <span>content</span>
      </WidgetTransitionGuard>
    );
    rerender(
      <WidgetTransitionGuard populated={true}>
        <span>content</span>
      </WidgetTransitionGuard>
    );
    const guard = screen.getByTestId('widget-transition-guard');
    expect(guard.className).toContain('widget-transition--populate');

    fireEvent.animationEnd(guard);
    expect(guard.className).not.toContain('widget-transition--populate');
    expect(guard.getAttribute('data-animating')).toBe('false');
  });

  it('does NOT animate when going from populated=true to populated=false', () => {
    const { rerender } = render(
      <WidgetTransitionGuard populated={true}>
        <span>content</span>
      </WidgetTransitionGuard>
    );
    const guard = screen.getByTestId('widget-transition-guard');
    expect(guard.className).not.toContain('widget-transition--populate');

    rerender(
      <WidgetTransitionGuard populated={false}>
        <span>content</span>
      </WidgetTransitionGuard>
    );
    expect(guard.className).not.toContain('widget-transition--populate');
    expect(guard.getAttribute('data-animating')).toBe('false');
  });
});
