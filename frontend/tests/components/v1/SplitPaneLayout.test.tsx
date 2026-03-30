import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SplitPaneLayout } from '../../../src/components/v1/SplitPaneLayout';

describe('SplitPaneLayout', () => {
  it('renders both panes', () => {
    render(
      <SplitPaneLayout
        leftPane={<div>Left Content</div>}
        rightPane={<div>Right Content</div>}
      />
    );

    expect(screen.getByText('Left Content')).toBeInTheDocument();
    expect(screen.getByText('Right Content')).toBeInTheDocument();
  });

  it('renders with horizontal direction by default', () => {
    render(
      <SplitPaneLayout
        leftPane={<div>Left</div>}
        rightPane={<div>Right</div>}
      />
    );

    const layout = screen.getByTestId('split-pane-layout');
    expect(layout).toHaveAttribute('data-direction', 'horizontal');
    expect(layout).toHaveClass('split-pane-layout--horizontal');
  });

  it('renders with vertical direction when specified', () => {
    render(
      <SplitPaneLayout
        leftPane={<div>Top</div>}
        rightPane={<div>Bottom</div>}
        direction="vertical"
      />
    );

    const layout = screen.getByTestId('split-pane-layout');
    expect(layout).toHaveAttribute('data-direction', 'vertical');
    expect(layout).toHaveClass('split-pane-layout--vertical');
  });

  it('renders divider when resizable is true', () => {
    render(
      <SplitPaneLayout
        leftPane={<div>Left</div>}
        rightPane={<div>Right</div>}
        resizable={true}
      />
    );

    expect(screen.getByTestId('split-pane-layout-divider')).toBeInTheDocument();
  });

  it('does not render divider when resizable is false', () => {
    render(
      <SplitPaneLayout
        leftPane={<div>Left</div>}
        rightPane={<div>Right</div>}
        resizable={false}
      />
    );

    expect(screen.queryByTestId('split-pane-layout-divider')).not.toBeInTheDocument();
  });

  it('applies initial ratio to panes', () => {
    render(
      <SplitPaneLayout
        leftPane={<div>Left</div>}
        rightPane={<div>Right</div>}
        direction="horizontal"
        initialRatio={0.3}
      />
    );

    const layout = screen.getByTestId('split-pane-layout');
    expect(layout).toHaveAttribute('data-ratio', '0.30');
  });

  it('calls onRatioChange when ratio changes', () => {
    const onRatioChange = vi.fn();
    const { container } = render(
      <SplitPaneLayout
        leftPane={<div>Left</div>}
        rightPane={<div>Right</div>}
        resizable={true}
        onRatioChange={onRatioChange}
      />
    );

    const divider = screen.getByTestId('split-pane-layout-divider');
    const layout = container.querySelector('[data-testid="split-pane-layout"]') as HTMLElement;

    // Simulate mouse drag
    fireEvent.mouseDown(divider);
    fireEvent.mouseMove(document, { clientX: layout.getBoundingClientRect().left + 300 });
    fireEvent.mouseUp(document);

    expect(onRatioChange).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(
      <SplitPaneLayout
        leftPane={<div>Left</div>}
        rightPane={<div>Right</div>}
        className="custom-class"
      />
    );

    const layout = screen.getByTestId('split-pane-layout');
    expect(layout).toHaveClass('custom-class');
  });

  it('uses custom testId', () => {
    render(
      <SplitPaneLayout
        leftPane={<div>Left</div>}
        rightPane={<div>Right</div>}
        testId="custom-layout"
      />
    );

    expect(screen.getByTestId('custom-layout')).toBeInTheDocument();
    expect(screen.getByTestId('custom-layout-left')).toBeInTheDocument();
    expect(screen.getByTestId('custom-layout-right')).toBeInTheDocument();
  });

  it('has proper accessibility attributes on divider', () => {
    render(
      <SplitPaneLayout
        leftPane={<div>Left</div>}
        rightPane={<div>Right</div>}
        resizable={true}
        direction="horizontal"
      />
    );

    const divider = screen.getByTestId('split-pane-layout-divider');
    expect(divider).toHaveAttribute('role', 'separator');
    expect(divider).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('has proper accessibility attributes on divider for vertical layout', () => {
    render(
      <SplitPaneLayout
        leftPane={<div>Top</div>}
        rightPane={<div>Bottom</div>}
        resizable={true}
        direction="vertical"
      />
    );

    const divider = screen.getByTestId('split-pane-layout-divider');
    expect(divider).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('respects minPaneSize constraint', () => {
    const { container } = render(
      <SplitPaneLayout
        leftPane={<div>Left</div>}
        rightPane={<div>Right</div>}
        resizable={true}
        minPaneSize={300}
        direction="horizontal"
      />
    );

    const divider = screen.getByTestId('split-pane-layout-divider');
    const layout = container.querySelector('[data-testid="split-pane-layout"]') as HTMLElement;

    // Try to drag to very small ratio (should be constrained)
    fireEvent.mouseDown(divider);
    fireEvent.mouseMove(document, { clientX: layout.getBoundingClientRect().left + 50 });
    fireEvent.mouseUp(document);

    const ratio = parseFloat(layout.getAttribute('data-ratio') || '0');
    expect(ratio).toBeGreaterThan(0.1); // Should be constrained by minPaneSize
  });

  it('persists ratio to localStorage when persistRatio is true', () => {
    const persistKey = 'test-split-ratio';
    render(
      <SplitPaneLayout
        leftPane={<div>Left</div>}
        rightPane={<div>Right</div>}
        initialRatio={0.4}
        persistRatio={true}
        persistKey={persistKey}
      />
    );

    const stored = localStorage.getItem(persistKey);
    expect(stored).toBe('0.4');
  });

  it('restores ratio from localStorage on mount', () => {
    const persistKey = 'test-split-ratio-restore';
    localStorage.setItem(persistKey, '0.6');

    render(
      <SplitPaneLayout
        leftPane={<div>Left</div>}
        rightPane={<div>Right</div>}
        initialRatio={0.5}
        persistRatio={true}
        persistKey={persistKey}
      />
    );

    const layout = screen.getByTestId('split-pane-layout');
    expect(layout).toHaveAttribute('data-ratio', '0.60');

    localStorage.removeItem(persistKey);
  });

  it('adds dragging class during resize', () => {
    render(
      <SplitPaneLayout
        leftPane={<div>Left</div>}
        rightPane={<div>Right</div>}
        resizable={true}
      />
    );

    const divider = screen.getByTestId('split-pane-layout-divider');
    const layout = screen.getByTestId('split-pane-layout');

    fireEvent.mouseDown(divider);
    expect(layout).toHaveClass('split-pane-layout--dragging');

    fireEvent.mouseUp(document);
    expect(layout).not.toHaveClass('split-pane-layout--dragging');
  });

  it('handles vertical direction resize', () => {
    const onRatioChange = vi.fn();
    const { container } = render(
      <SplitPaneLayout
        leftPane={<div>Top</div>}
        rightPane={<div>Bottom</div>}
        direction="vertical"
        resizable={true}
        onRatioChange={onRatioChange}
      />
    );

    const divider = screen.getByTestId('split-pane-layout-divider');
    const layout = container.querySelector('[data-testid="split-pane-layout"]') as HTMLElement;

    fireEvent.mouseDown(divider);
    fireEvent.mouseMove(document, { clientY: layout.getBoundingClientRect().top + 200 });
    fireEvent.mouseUp(document);

    expect(onRatioChange).toHaveBeenCalled();
  });
});
