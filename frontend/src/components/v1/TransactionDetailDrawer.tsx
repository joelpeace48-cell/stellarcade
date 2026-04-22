import React, { useMemo } from 'react';
import { Drawer } from './Drawer';
import { TxStatusPanel } from './TxStatusPanel';
import type { PendingTransactionSnapshot } from '@/types/global-state';
import { TxPhase, TxStatusError, type TxStatusMeta } from '@/types/tx-status';

export interface TransactionDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  pendingTransaction: PendingTransactionSnapshot | null;
  network?: string | null;
  testId?: string;
}

function resolveTxPhase(phase?: string | null): TxPhase {
  const normalized = String(phase ?? '').trim().toUpperCase();

  if (normalized.includes('FAIL') || normalized.includes('ERROR') || normalized.includes('REJECT')) {
    return TxPhase.FAILED;
  }

  if (normalized.includes('CONFIRM') || normalized.includes('SUCCESS') || normalized.includes('SETTLED')) {
    return TxPhase.CONFIRMED;
  }

  if (normalized.includes('PEND')) {
    return TxPhase.PENDING;
  }

  if (normalized.includes('SUBMIT') || normalized.includes('SIGN')) {
    return TxPhase.SUBMITTED;
  }

  return TxPhase.IDLE;
}

function buildTxMeta(pendingTransaction: PendingTransactionSnapshot | null): TxStatusMeta | null {
  if (!pendingTransaction?.txHash) {
    return null;
  }

  return {
    hash: pendingTransaction.txHash,
    phase: resolveTxPhase(pendingTransaction.phase),
    confirmations: resolveTxPhase(pendingTransaction.phase) === TxPhase.CONFIRMED ? 1 : 0,
    submittedAt: pendingTransaction.startedAt,
    settledAt:
      resolveTxPhase(pendingTransaction.phase) === TxPhase.CONFIRMED ||
      resolveTxPhase(pendingTransaction.phase) === TxPhase.FAILED
        ? pendingTransaction.updatedAt
        : undefined,
    lastAttemptAt:
      pendingTransaction.updatedAt > pendingTransaction.startedAt
        ? pendingTransaction.updatedAt
        : undefined,
  };
}

function buildTxError(pendingTransaction: PendingTransactionSnapshot | null): TxStatusError | null {
  if (!pendingTransaction) {
    return null;
  }

  const phase = resolveTxPhase(pendingTransaction.phase);
  if (phase !== TxPhase.FAILED) {
    return null;
  }

  return new TxStatusError(
    'tx_failed',
    `${pendingTransaction.operation.replace(/[._]/g, ' ')} failed during ${pendingTransaction.phase.toLowerCase()}.`,
  );
}

export const TransactionDetailDrawer: React.FC<TransactionDetailDrawerProps> = ({
  open,
  onClose,
  pendingTransaction,
  network,
  testId = 'transaction-detail-drawer',
}) => {
  const phase = useMemo(() => resolveTxPhase(pendingTransaction?.phase), [pendingTransaction?.phase]);
  const meta = useMemo(() => buildTxMeta(pendingTransaction), [pendingTransaction]);
  const error = useMemo(() => buildTxError(pendingTransaction), [pendingTransaction]);

  return (
    <Drawer open={open} onClose={onClose} title="Transaction details" testId={testId}>
      {pendingTransaction ? (
        <div className="transaction-detail-drawer" data-testid={`${testId}-content`}>
          <div className="transaction-detail-drawer__summary">
            <p className="transaction-detail-drawer__eyebrow">Lifecycle view</p>
            <h3 className="transaction-detail-drawer__title">
              {pendingTransaction.operation.replace(/[._]/g, ' ')}
            </h3>
            <dl className="transaction-detail-drawer__meta">
              <div>
                <dt>Phase</dt>
                <dd>{pendingTransaction.phase}</dd>
              </div>
              <div>
                <dt>Hash</dt>
                <dd>{pendingTransaction.txHash ?? 'Awaiting transaction hash'}</dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd>{new Date(pendingTransaction.startedAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Last update</dt>
                <dd>{new Date(pendingTransaction.updatedAt).toLocaleString()}</dd>
              </div>
              {network && (
                <div>
                  <dt>Network</dt>
                  <dd>{network}</dd>
                </div>
              )}
            </dl>
          </div>

          <TxStatusPanel
            phase={phase}
            meta={meta}
            error={error}
            network={network ?? undefined}
            testId={`${testId}-status`}
          />
        </div>
      ) : (
        <div className="transaction-detail-drawer__empty" data-testid={`${testId}-empty`}>
          No transaction has been started yet.
        </div>
      )}
    </Drawer>
  );
};

TransactionDetailDrawer.displayName = 'TransactionDetailDrawer';

export default TransactionDetailDrawer;
