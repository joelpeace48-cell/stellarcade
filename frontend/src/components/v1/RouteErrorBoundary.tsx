import React from 'react';
import { ErrorFallback } from '../../pages/ErrorFallback';

export interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  /** Override the fallback UI. Receives the captured error and a retry callback. */
  fallback?: (error: unknown, retry: () => void) => React.ReactNode;
  /**
   * Called whenever an error is captured. Use this to route errors to an
   * existing telemetry / analytics pipeline.
   */
  onError?: (error: unknown, info: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: unknown;
}

/**
 * RouteErrorBoundary — v1
 *
 * A class-based React error boundary intended to wrap route-level subtrees.
 * When any descendant component throws during render, commit, or layout, the
 * boundary catches the error, logs it via `onError` (for telemetry), and
 * renders the `ErrorFallback` page instead of a blank screen.
 *
 * Usage:
 * ```tsx
 * <RouteErrorBoundary onError={myTelemetryFn}>
 *   <SomePage />
 * </RouteErrorBoundary>
 * ```
 */
export class RouteErrorBoundary extends React.Component<RouteErrorBoundaryProps, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback(this.state.error, this.handleRetry);
    }

    return (
      <ErrorFallback
        error={this.state.error}
        onRetry={this.handleRetry}
      />
    );
  }
}

export default RouteErrorBoundary;
