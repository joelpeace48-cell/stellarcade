import { useMemo } from 'react';
import type { AppError } from '../../types/errors';
import { toAppError } from '../../utils/v1/errorMapper';
import { useAsyncAction } from '../../hooks/v1/useAsyncAction';
import { ErrorNotice } from './ErrorNotice';
import { MultiStepProgressIndicator, type ProgressStep } from './MultiStepProgressIndicator';
import './ContractActionButton.css';

export interface ContractActionButtonProps<T = unknown> {
  label: string;
  loadingLabel?: string;
  action: () => Promise<T>;
  walletConnected: boolean;
  networkSupported: boolean;
  disabled?: boolean;
  /** Optional reason shown near the button when it is disabled by the caller. */
  disabledReason?: string;
  onSuccess?: (result: T) => void | Promise<void>;
  onError?: (error: AppError) => void | Promise<void>;
  className?: string;
  testId?: string;
  /** Optional multi-step progress steps */
  progressSteps?: ProgressStep[];
  /** Current step index for multi-step progress (0-based) */
  currentStepIndex?: number;
  /** Whether to show progress indicator */
  showProgress?: boolean;
}

export interface ContractActionButtonProps<T = unknown> {
  label: string;
  loadingLabel?: string;
  action: () => Promise<T>;
  walletConnected: boolean;
  networkSupported: boolean;
  disabled?: boolean;
  /** Optional reason shown near the button when it is disabled by the caller. */
  disabledReason?: string;
  onSuccess?: (result: T) => void | Promise<void>;
  onError?: (error: AppError) => void | Promise<void>;
  className?: string;
  testId?: string;
}

export function ContractActionButton<T = unknown>({
  label,
  loadingLabel = 'Processing...',
  action,
  walletConnected,
  networkSupported,
  disabled = false,
  disabledReason,
  onSuccess,
  onError,
  className = '',
  testId = 'contract-action-button',
  progressSteps,
  currentStepIndex = 0,
  showProgress = false,
}: ContractActionButtonProps<T>) {
  const sanitizedLabel = useMemo(() => {
    const trimmed = label.trim();
    return trimmed.length > 0 ? trimmed : 'Run action';
  }, [label]);

  const blockedReason = useMemo(() => {
    if (!walletConnected) {
      return 'Connect wallet to continue.';
    }
    if (!networkSupported) {
      return 'Switch to a supported network.';
    }
    return null;
  }, [walletConnected, networkSupported]);

  // Reusable duplicate-submit guard: preventConcurrent=true ensures rapid
  // clicks cannot trigger a second submission while one is in-flight.
  // After failure the state resets to idle so legitimate retries are never blocked.
  const {
    isPendingSubmit,
    error: rawError,
    run,
  } = useAsyncAction<T, Error>(
    action,
    {
      preventConcurrent: true,
      onSuccess: async (result) => {
        await onSuccess?.(result);
      },
      onError: async (err) => {
        const mapped = toAppError(err);
        await onError?.(mapped);
      },
    },
  );

  // Map raw error through toAppError so the ErrorNotice always receives AppError
  const error: AppError | null = rawError ? toAppError(rawError) : null;

  const isDisabled = disabled || isPendingSubmit || blockedReason !== null;
  const preconditionId = blockedReason ? `${testId}-precondition` : undefined;
  const callerReasonId = (!blockedReason && disabled && disabledReason) ? `${testId}-disabled-reason` : undefined;
  const errorId = error ? `${testId}-error-region` : undefined;
  const describedBy = [preconditionId, callerReasonId, errorId].filter(Boolean).join(' ') || undefined;

  const handleClick = async () => {
    if (isDisabled) return;
    try {
      await run();
    } catch {
      // errors are handled via onError callback; toAppError mapping happens below
    }
  };

  return (
    <div className={className} data-testid={`${testId}-container`}>
      {showProgress && progressSteps && progressSteps.length > 1 && (
        <div className="contract-action-button__progress" data-testid={`${testId}-progress`}>
          <MultiStepProgressIndicator
            steps={progressSteps}
            currentStepIndex={currentStepIndex}
            hasError={error !== null}
            size="small"
            showStepNumbers={true}
            testId={`${testId}-progress-indicator`}
          />
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        data-testid={testId}
      aria-busy={isPendingSubmit}
      aria-disabled={isDisabled}
      aria-describedby={describedBy}
      className="contract-action-button__button"
    >
      {isPendingSubmit ? loadingLabel : sanitizedLabel}
      </button>

      {blockedReason && (
        <p
          data-testid={preconditionId}
          id={preconditionId}
          role="status"
          aria-live="polite"
        >
          {blockedReason}
        </p>
      )}

      {!blockedReason && disabled && disabledReason && (
        <p
          data-testid={callerReasonId}
          id={callerReasonId}
          className="contract-action-button__disabled-reason"
          role="status"
          aria-live="polite"
        >
          {disabledReason}
        </p>
      )}

      {error && (
        <div id={errorId}>
          <ErrorNotice error={error} testId={`${testId}-error`} />
        </div>
      )}
    </div>
  );
}

export default ContractActionButton;
