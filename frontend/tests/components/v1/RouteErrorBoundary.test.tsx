import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RouteErrorBoundary } from '../../../src/components/v1/RouteErrorBoundary';

// Suppress the expected console.error calls from React's error boundary machinery.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// A component that throws on demand.
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }): React.ReactElement {
  if (shouldThrow) {
    throw new Error('Render error from ThrowingComponent');
  }
  return <div data-testid="healthy">Healthy content</div>;
}

describe('RouteErrorBoundary', () => {
  it('renders children normally when no error is thrown', () => {
    render(
      <RouteErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </RouteErrorBoundary>,
    );
    expect(screen.getByTestId('healthy')).toBeInTheDocument();
  });

  it('renders the ErrorFallback page when a child throws', () => {
    render(
      <RouteErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </RouteErrorBoundary>,
    );
    expect(screen.getByTestId('error-fallback')).toBeInTheDocument();
    expect(screen.getByTestId('error-fallback-message')).toHaveTextContent(
      'Render error from ThrowingComponent',
    );
  });

  it('renders the custom fallback when the fallback prop is provided', () => {
    const customFallback = vi.fn((_error: unknown, retry: () => void) => (
      <div data-testid="custom-fallback">
        <button onClick={retry}>Custom Retry</button>
      </div>
    ));

    render(
      <RouteErrorBoundary fallback={customFallback}>
        <ThrowingComponent shouldThrow={true} />
      </RouteErrorBoundary>,
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(customFallback).toHaveBeenCalledOnce();
  });

  it('calls onError with the error and errorInfo when a child throws', () => {
    const onError = vi.fn();

    render(
      <RouteErrorBoundary onError={onError}>
        <ThrowingComponent shouldThrow={true} />
      </RouteErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledOnce();
    const [capturedError] = onError.mock.calls[0];
    expect(capturedError).toBeInstanceOf(Error);
    expect((capturedError as Error).message).toBe('Render error from ThrowingComponent');
  });

  it('recovers and renders children again after the retry button is clicked', () => {
    // We cannot change ThrowingComponent's prop through the boundary, so we
    // use the custom fallback to call retry and verify the boundary re-renders.
    let retryFn: (() => void) | null = null;

    const fallback = (_error: unknown, retry: () => void) => {
      retryFn = retry;
      return <div data-testid="fallback-ui">Error UI</div>;
    };

    const { rerender } = render(
      <RouteErrorBoundary fallback={fallback}>
        <ThrowingComponent shouldThrow={true} />
      </RouteErrorBoundary>,
    );

    expect(screen.getByTestId('fallback-ui')).toBeInTheDocument();

    // Simulate retry: boundary resets its state.
    // After reset the children render again; this time we pass shouldThrow=false.
    retryFn!();

    rerender(
      <RouteErrorBoundary fallback={fallback}>
        <ThrowingComponent shouldThrow={false} />
      </RouteErrorBoundary>,
    );

    expect(screen.getByTestId('healthy')).toBeInTheDocument();
  });

  it('shows the Go Home button on the default fallback', () => {
    render(
      <RouteErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </RouteErrorBoundary>,
    );
    expect(screen.getByTestId('error-fallback-home')).toBeInTheDocument();
  });

  it('shows the Try Again button on the default fallback', () => {
    render(
      <RouteErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </RouteErrorBoundary>,
    );
    expect(screen.getByTestId('error-fallback-retry')).toBeInTheDocument();
  });

  it('recovers via the default Try Again button', () => {
    // We re-render with shouldThrow=false after clicking retry.
    const { rerender } = render(
      <RouteErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </RouteErrorBoundary>,
    );

    expect(screen.getByTestId('error-fallback')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('error-fallback-retry'));

    rerender(
      <RouteErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </RouteErrorBoundary>,
    );

    expect(screen.getByTestId('healthy')).toBeInTheDocument();
  });
});
