import React from 'react';
import type { AsyncStatus } from '../../types/v1/async';

export interface AsyncStateBoundaryProps<T, E = unknown> {
  status: AsyncStatus;
  data?: T | null;
  error?: E | null;
  onRetry?: () => void | Promise<void>;
  renderIdle?: () => React.ReactNode;
  renderLoading?: () => React.ReactNode;
  renderEmpty?: () => React.ReactNode;
  renderError?: (params: { error: E | null | undefined; retry?: () => void | Promise<void> }) => React.ReactNode;
  renderSuccess: (data: T) => React.ReactNode;
  isEmpty?: (data: T) => boolean;
  testId?: string;
  showStale?: boolean;
  staleMessage?: string;
}

const VALID_STATUS: readonly AsyncStatus[] = ['idle', 'loading', 'success', 'error'] as const;

export function AsyncStateBoundary<T, E = unknown>({
  status,
  data = null,
  error = null,
  onRetry,
  renderIdle,
  renderLoading,
  renderEmpty,
  renderError,
  renderSuccess,
  isEmpty,
  testId = 'async-state-boundary',
  showStale = false,
  staleMessage = 'You are viewing stale data due to a refresh error.',
}: AsyncStateBoundaryProps<T, E>) {
  const safeStatus: AsyncStatus = VALID_STATUS.includes(status) ? status : 'idle';

  if (safeStatus === 'idle') {
    return <>{renderIdle?.() ?? null}</>;
  }

  if (safeStatus === 'loading') {
    return <>{renderLoading?.() ?? <div data-testid={`${testId}-loading`}>Loading...</div>}</>;
  }

  if (safeStatus === 'error') {
    if (showStale && data != null) {
      return (
        <div data-testid={`${testId}-stale`}>
          <div 
            className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-4" 
            role="alert"
            data-testid={`${testId}-stale-banner`}
          >
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-amber-700">
                  {staleMessage}
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="ml-2 font-medium underline hover:text-amber-600"
                      data-testid={`${testId}-stale-retry`}
                    >
                      Retry
                    </button>
                  )}
                </p>
              </div>
            </div>
          </div>
          {renderSuccess(data)}
        </div>
      );
    }

    if (renderError) {
      return <>{renderError({ error, retry: onRetry })}</>;
    }

    return (
      <div data-testid={`${testId}-error`}>
        <p>Something went wrong.</p>
        {onRetry && (
          <button type="button" onClick={onRetry} data-testid={`${testId}-retry`}>
            Retry
          </button>
        )}
      </div>
    );
  }

  if (data == null) {
    return <>{renderEmpty?.() ?? <div data-testid={`${testId}-empty`}>No data available.</div>}</>;
  }

  if (isEmpty && isEmpty(data)) {
    return <>{renderEmpty?.() ?? <div data-testid={`${testId}-empty`}>No data available.</div>}</>;
  }

  return <>{renderSuccess(data)}</>;
}

export default AsyncStateBoundary;
