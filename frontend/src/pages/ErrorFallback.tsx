import React from 'react';

export interface ErrorFallbackProps {
  /** The captured error, if available. */
  error?: unknown;
  /** Called when the user clicks "Try Again". */
  onRetry?: () => void;
  /** Called when the user clicks "Go Home". Defaults to `window.location.assign('/')`. */
  onNavigateHome?: () => void;
}

/**
 * ErrorFallback page — rendered by RouteErrorBoundary when a component tree
 * throws during render. Provides retry and navigation affordances so the user
 * is never left with a blank screen.
 */
export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  onRetry,
  onNavigateHome,
}) => {
  const handleNavigateHome = onNavigateHome ?? (() => window.location.assign('/'));

  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : 'An unexpected error occurred.';

  return (
    <main
      className="error-fallback"
      role="alert"
      aria-live="assertive"
      aria-label="Application error"
      data-testid="error-fallback"
    >
      <div className="error-fallback__content">
        <h1 className="error-fallback__title">Something went wrong</h1>

        <p className="error-fallback__message" data-testid="error-fallback-message">
          {errorMessage}
        </p>

        <p className="error-fallback__hint">
          You can try reloading this section or return to the home page.
        </p>

        <div className="error-fallback__actions">
          {onRetry && (
            <button
              type="button"
              className="error-fallback__btn error-fallback__btn--primary"
              onClick={onRetry}
              data-testid="error-fallback-retry"
            >
              Try Again
            </button>
          )}

          <button
            type="button"
            className="error-fallback__btn error-fallback__btn--secondary"
            onClick={handleNavigateHome}
            data-testid="error-fallback-home"
          >
            Go Home
          </button>
        </div>
      </div>
    </main>
  );
};

export default ErrorFallback;
