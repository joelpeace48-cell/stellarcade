import React, { useState, useCallback } from 'react';
import { TxPhase, TxStatusMeta, TxStatusError } from '../../types/tx-status';
import { EnvironmentBadge } from './EnvironmentBadge';
import { formatAddress, formatDate, formatTxTimestamp, truncateHash, formatCopyableValue } from '../../utils/v1/formatters';
import { useCopyFeedback } from '../../utils/v1/clipboard';
import './TxStatusPanel.css';

/**
 * TxReceiptView Component
 *
 * Renders a clean, minimal transaction receipt suitable for printing.
 * Only displays high-signal data: hash, status, amount, asset, sender, recipient, timestamp, network.
 */
interface TxReceiptViewProps {
  meta: TxStatusMeta;
  phase: TxPhase;
  network?: string;
  asset?: string;
  amount?: string | number | bigint;
  sender?: string;
  recipient?: string;
  testId?: string;
}

const TxReceiptView: React.FC<TxReceiptViewProps> = ({
  meta,
  phase,
  network,
  asset,
  amount,
  sender,
  recipient,
  testId = 'tx-receipt',
}) => {
  return (
    <div className="tx-status-panel__receipt" data-testid={testId}>
      <h2 className="tx-status-panel__receipt-title">Transaction Receipt</h2>

      <div className="tx-status-panel__receipt-row">
        <span className="tx-status-panel__receipt-label">Transaction Hash</span>
        <span className="tx-status-panel__receipt-value tx-status-panel__receipt-value--hash" data-testid={`${testId}-hash`}>
          {truncateHash(meta.hash)}
        </span>
      </div>

      <div className="tx-status-panel__receipt-row">
        <span className="tx-status-panel__receipt-label">Status</span>
        <span className="tx-status-panel__receipt-value" data-testid={`${testId}-status`}>
          {phase}
        </span>
      </div>

      {amount !== undefined && (
        <div className="tx-status-panel__receipt-row">
          <span className="tx-status-panel__receipt-label">Amount</span>
          <span className="tx-status-panel__receipt-value" data-testid={`${testId}-amount`}>
            {typeof amount === 'bigint' || typeof amount === 'number' ? amount.toString() : amount}
            {asset ? ` ${asset}` : ''}
          </span>
        </div>
      )}

      {sender && (
        <div className="tx-status-panel__receipt-row">
          <span className="tx-status-panel__receipt-label">Sender</span>
          <span className="tx-status-panel__receipt-value" data-testid={`${testId}-sender`}>
            {truncateHash(sender)}
          </span>
        </div>
      )}

      {recipient && (
        <div className="tx-status-panel__receipt-row">
          <span className="tx-status-panel__receipt-label">Recipient</span>
          <span className="tx-status-panel__receipt-value" data-testid={`${testId}-recipient`}>
            {truncateHash(recipient)}
          </span>
        </div>
      )}

      <div className="tx-status-panel__receipt-row">
        <span className="tx-status-panel__receipt-label">Timestamp</span>
        <span className="tx-status-panel__receipt-value" data-testid={`${testId}-timestamp`}>
          {formatTxTimestamp(meta.submittedAt)}
        </span>
      </div>

      {network && (
        <div className="tx-status-panel__receipt-row">
          <span className="tx-status-panel__receipt-label">Network</span>
          <span className="tx-status-panel__receipt-value" data-testid={`${testId}-network`}>
            {network}
          </span>
        </div>
      )}
    </div>
  );
};

TxReceiptView.displayName = 'TxReceiptView';

export interface TxStatusPanelProps {
  /** Current lifecycle phase of the transaction */
  phase: TxPhase;
  /** Metadata about the transaction (hash, timing, etc.) */
  meta?: TxStatusMeta | null;
  /** Structured error if the phase is FAILED */
  error?: TxStatusError | null;
  /** Whether to show a simplified compact view (true) or detailed expanded view (false) */
  compact?: boolean;
  /** Optional callback to open the transaction in an explorer */
  onExplorerLink?: (hash: string) => void;
  /** Optional explorer URL generator - receives hash, returns full URL */
  explorerUrl?: (hash: string) => string;
  /** Whether to show the copy button for transaction hash */
  showCopyButton?: boolean;
  /** Optional additional CSS classes */
  className?: string;
  /** Test identifier for component queries */
  testId?: string;
  /** Network name for receipt display */
  network?: string;
  /** Asset symbol for receipt display */
  asset?: string;
  /** Amount for receipt display */
  amount?: string | number | bigint;
  /** Sender address for receipt display */
  sender?: string;
  /** Recipient address for receipt display */
  recipient?: string;
}

/**
 * TxStatusPanel Component
 *
 * Renders a visual timeline and metadata for a transaction's lifecycle.
 * Consume transaction state and metadata provided by application services.
 */
export const TxStatusPanel: React.FC<TxStatusPanelProps> = ({
  phase,
  meta,
  error,
  compact = false,
  onExplorerLink,
  explorerUrl,
  showCopyButton = true,
  className = '',
  testId = 'tx-status-panel',
  network,
  asset,
  amount,
  sender,
  recipient,
}) => {
  const { state: copyState, copy: triggerCopy } = useCopyFeedback();

  const isFailed = phase === TxPhase.FAILED;
  const isPending = phase === TxPhase.PENDING || phase === TxPhase.SUBMITTED;
  const isIdle = phase === TxPhase.IDLE;

  const handleCopy = useCallback(async () => {
    if (!meta?.hash) return;
    await triggerCopy(meta.hash);
  }, [meta?.hash, triggerCopy]);

  const handleExplorerClick = useCallback(() => {
    if (!meta?.hash) return;
    if (explorerUrl) {
      const url = explorerUrl(meta.hash);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    onExplorerLink?.(meta.hash);
  }, [meta?.hash, explorerUrl, onExplorerLink]);

  const canPrint = Boolean(meta?.hash && !isIdle);

  const handlePrint = useCallback(() => {
    if (!canPrint) return;
    if (typeof window !== 'undefined' && window.print) {
      window.print();
    } else {
      console.warn('Print functionality is not available in this environment');
    }
  }, [canPrint]);

    const containerClasses = [
        'tx-status-panel',
        compact ? 'tx-status-panel--compact' : '',
        className
    ].join(' ');

    const renderStep = (label: string, activePhase: TxPhase | TxPhase[], stepIndex: number) => {
        const phases = Array.isArray(activePhase) ? activePhase : [activePhase];
        const isActive = phases.includes(phase);

        // Logic for completion: if we are past this phase in the happy path
        // SUBMITTED (1) -> PENDING (2) -> CONFIRMED (3)
        const currentStepIndex = phase === TxPhase.IDLE ? 0 :
            phase === TxPhase.SUBMITTED ? 1 :
                phase === TxPhase.PENDING ? 2 :
                    phase === TxPhase.CONFIRMED ? 3 :
                        isFailed ? 2 : 0; // If failed during pending, we mark up to submitted

        const isCompleted = stepIndex < currentStepIndex && !isFailed;
        const isError = isFailed && stepIndex === currentStepIndex;

        return (
            <div
                className={`tx-status-step ${isActive ? 'tx-status-step--active' : ''} ${isCompleted ? 'tx-status-step--completed' : ''} ${isError ? 'tx-status-step--error' : ''}`}
                key={label}
            >
                <div className={`tx-status-step__dot ${isActive && isPending ? 'pulse-animation' : ''}`} />
                <span className="tx-status-step__label">{label}</span>
            </div>
        );
    };

    const badgeClass = `tx-status-panel__badge tx-status-panel__badge--${phase.toLowerCase()}`;

    return (
        <div className={containerClasses} data-testid={testId}>
            <div className="tx-status-panel__header">
                <span className="tx-status-panel__title" data-testid={`${testId}-title`}>
                    {isIdle ? 'Ready to Submit' : 'Transaction Status'}
                </span>
                <div className="tx-status-panel__header-badges">
                  <span className={badgeClass} data-testid={`${testId}-badge`}>{phase}</span>
                  {network && (
                    <EnvironmentBadge environment={network} size="small" testId={`${testId}-env-badge`} />
                  )}
                </div>
            </div>

            {!isIdle && (
                <div className="tx-status-panel__timeline" data-testid={`${testId}-timeline`}>
                    {renderStep('Submitted', TxPhase.SUBMITTED, 1)}
                    {renderStep('Pending', TxPhase.PENDING, 2)}
                    {renderStep('Confirmed', TxPhase.CONFIRMED, 3)}
                </div>
            )}

            {isFailed && error && (
                <div className="tx-status-panel__error" data-testid={`${testId}-error`}>
                    <span className="tx-status-panel__error-title">Error: {error.code}</span>
                    <p>{error.message}</p>
                </div>
            )}

  {!compact && meta && (
    <div className="tx-status-panel__meta" data-testid={`${testId}-meta`}>
      <div className="tx-status-panel__meta-row">
        <span className="tx-status-panel__meta-label">Transaction Hash</span>
        <div className="tx-status-panel__hash-row">
          <span className="tx-status-panel__hash" title={meta.hash}>
            {formatAddress(meta.hash, { startChars: 8, endChars: 8 })}
          </span>
          {showCopyButton && (
            <button
              type="button"
              className={`tx-status-panel__copy-btn${copyState === 'success' ? ' tx-status-panel__copy-btn--copied' : ''}${copyState === 'error' ? ' tx-status-panel__copy-btn--error' : ''}`}
              onClick={handleCopy}
              aria-label={copyState === 'success' ? 'Copied!' : copyState === 'error' ? 'Copy failed' : 'Copy transaction hash'}
              aria-live="polite"
              data-testid={`${testId}-copy-btn`}
            >
              {copyState === 'success' ? '✓' : copyState === 'error' ? '✗' : '📋'}
            </button>
          )}
        </div>
      </div>

      <div className="tx-status-panel__meta-row">
        <span className="tx-status-panel__meta-label">Submitted</span>
        <span>{formatDate(meta.submittedAt, { timeStyle: 'short' })}</span>
      </div>

      {meta.settledAt && (
        <div className="tx-status-panel__meta-row">
          <span className="tx-status-panel__meta-label">Settled</span>
          <span>{formatDate(meta.settledAt, { timeStyle: 'short' })}</span>
        </div>
      )}

      {meta.confirmations > 0 && !isFailed && (
        <div className="tx-status-panel__meta-row">
          <span className="tx-status-panel__meta-label">Confirmations</span>
          <span data-testid={`${testId}-confirmations`}>{meta.confirmations}</span>
        </div>
      )}

      {meta.retryCount != null && meta.retryCount > 0 && (
        <div className="tx-status-panel__meta-row" data-testid={`${testId}-retry-count`}>
          <span className="tx-status-panel__meta-label">Retries</span>
          <span>{meta.retryCount}</span>
        </div>
      )}

      {meta.lastAttemptAt != null && (
        <div className="tx-status-panel__meta-row" data-testid={`${testId}-last-attempt`}>
          <span className="tx-status-panel__meta-label">Last Attempt</span>
          <span>{formatDate(meta.lastAttemptAt, { timeStyle: 'short' })}</span>
        </div>
      )}

      {(onExplorerLink || explorerUrl) && (
        <button
          type="button"
          className="tx-status-panel__explorer-link"
          onClick={handleExplorerClick}
      data-testid={`${testId}-explorer-btn`}
        >
          View in Explorer &rarr;
        </button>
      )}

      {canPrint && !compact && (
        <button
          type="button"
          className="tx-status-panel__print-btn"
          onClick={handlePrint}
          aria-label="Print transaction receipt"
          data-testid={`${testId}-print-btn`}
        >
          Print Receipt
        </button>
      )}
    </div>
  )}

  {isIdle && !compact && (
    <div className="tx-status-panel__empty-state">
      Submit a transaction to track its progress in real-time.
    </div>
  )}

  {meta && !isIdle && (
    <TxReceiptView
      meta={meta}
      phase={phase}
      network={network}
      asset={asset}
      amount={amount}
      sender={sender}
      recipient={recipient}
      testId={`${testId}-receipt`}
    />
  )}
</div>
);
};

TxStatusPanel.displayName = 'TxStatusPanel';

export default TxStatusPanel;
