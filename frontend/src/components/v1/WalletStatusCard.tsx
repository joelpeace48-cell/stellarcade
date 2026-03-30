/**
 * WalletStatusCard Component
 *
 * Displays normalized wallet connection state, address, network, and provider.
 * Renders deterministic status badges and exposes connect/disconnect/retry callbacks.
 * Supports skeleton loading and fallback states.
 *
 * @module components/v1/WalletStatusCard
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SkeletonBase } from './LoadingSkeletonSet';
import { EnvironmentBadge } from './EnvironmentBadge';
import {
  BADGE_VARIANT_MAP,
  STATUS_LABEL_MAP,
  type WalletStatusCardProps,
  type WalletBadgeVariant,
  type WalletCapabilities,
  type WalletStatus,
} from './WalletStatusCard.types';
import WalletSessionService from '../../services/wallet-session-service';
import type { WalletSessionHistoryEntry } from '../../types/wallet-session';
import './WalletStatusCard.css';

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Truncates a long wallet address for display.
 * e.g. "GABCD...WXYZ"
 */
function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}\u2026${address.slice(-4)}`;
}

/**
 * Formats a timestamp into a human-readable "Updated X ago" string.
 */
function formatLastUpdated(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Updated just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Updated ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `Updated ${diffHr}h ago`;
}

function formatSessionTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getSessionEventLabel(type: WalletSessionHistoryEntry['type']): string {
  switch (type) {
    case 'connected':
      return 'Connected';
    case 'reconnected':
      return 'Reconnected';
    case 'disconnected':
      return 'Disconnected';
    case 'expired':
      return 'Expired';
    default:
      return 'Session update';
  }
}

/**
 * Sanitizes a string by stripping HTML tags.
 * Guards against prop-injected markup.
 */

function sanitize(value: string): string {
  return value
    .replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, '');
}
/**
 * Derives WalletCapabilities from a WalletStatus when the caller
 * does not supply them explicitly.
 */
function deriveCapabilities(status: WalletStatus): WalletCapabilities {
  return {
    isConnected: status === 'CONNECTED',
    isConnecting: status === 'CONNECTING',
    isReconnecting: status === 'RECONNECTING',
    canConnect:
      status === 'DISCONNECTED' ||
      status === 'PROVIDER_MISSING' ||
      status === 'PERMISSION_DENIED' ||
      status === 'STALE_SESSION' ||
      status === 'ERROR',
  };
}

/**
 * Safely invokes an async or sync callback, logging errors without crashing.
 */
function safeCall(
  fn: (() => void | Promise<void>) | undefined,
  label: string,
): void {
  if (typeof fn !== 'function') return;
  try {
    const result = fn();
    if (result instanceof Promise) {
      result.catch((err: unknown) => {
        console.error(`[WalletStatusCard] ${label} callback failed:`, err);
      });
    }
  } catch (err) {
    console.error(`[WalletStatusCard] ${label} callback threw:`, err);
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  variant: WalletBadgeVariant;
  label: string;
}

interface NetworkRecoveryBannerProps {
  onRecoverNetwork?: () => void | Promise<void>;
  pending?: boolean;
  label?: string;
}

function NetworkRecoveryBanner({
  onRecoverNetwork,
  pending = false,
  label = 'Recover Network',
}: NetworkRecoveryBannerProps): React.JSX.Element {
  const onRecover = useCallback(() => safeCall(onRecoverNetwork, 'onRecoverNetwork'), [onRecoverNetwork]);

  return (
    <div className="wallet-status-card__network-mismatch" role="status" data-testid="wallet-network-mismatch">
      <span className="wallet-status-card__network-mismatch-text">
        Network mismatch detected. Switch back to a supported network to continue.
      </span>
      <button
        className="wallet-status-card__btn wallet-status-card__btn--retry"
        type="button"
        onClick={onRecover}
        disabled={pending || typeof onRecoverNetwork !== 'function'}
        data-testid="wallet-network-recover-btn"
      >
        {pending ? 'Checking network...' : label}
      </button>
    </div>
  );
}

// ── Dropped-session reconnect banner ───────────────────────────────────────────

interface DroppedSessionBannerProps {
  onReconnect?: () => void | Promise<void>;
  pending?: boolean;
  label?: string;
}

/**
 * Renders a distinct reconnect-state banner when a wallet session has dropped
 * unexpectedly. Intentionally styled differently from NetworkRecoveryBanner to
 * keep the two states visually and semantically separate.
 */
function DroppedSessionBanner({
  onReconnect,
  pending = false,
  label = 'Reconnect',
}: DroppedSessionBannerProps): React.JSX.Element {
  const handleReconnect = useCallback(
    () => safeCall(onReconnect, 'onReconnect'),
    [onReconnect],
  );

  return (
    <div
      className="wallet-status-card__dropped-session"
      role="alert"
      aria-live="assertive"
      data-testid="wallet-dropped-session-banner"
    >
      <span className="wallet-status-card__dropped-session-text">
        Your wallet session ended unexpectedly. Reconnect to continue.
      </span>
      <button
        className="wallet-status-card__btn wallet-status-card__btn--reconnect"
        type="button"
        onClick={handleReconnect}
        disabled={pending || typeof onReconnect !== 'function'}
        aria-busy={pending}
        data-testid="wallet-reconnect-btn"
      >
        {pending ? 'Reconnecting...' : label}
      </button>
    </div>
  );
}

function StatusBadge({ variant, label }: StatusBadgeProps): React.JSX.Element {
  return (
    <span
      className={`wallet-status-card__badge wallet-status-card__badge--${variant}`}
      data-testid="wallet-status-badge"
      aria-label={`Wallet status: ${label}`}
    >
      <span className="wallet-status-card__badge-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

// ── Skeleton state ─────────────────────────────────────────────────────────────

interface WalletStatusCardSkeletonProps {
  className?: string;
  testId: string;
}

function WalletStatusCardSkeleton({
  className,
  testId,
}: WalletStatusCardSkeletonProps): React.JSX.Element {
  const containerClass = [
    'wallet-status-card',
    'wallet-status-card--skeleton',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={containerClass}
      data-testid={testId}
      aria-busy="true"
      aria-label="Loading wallet status"
    >
      {/* Header row */}
      <div className="wallet-status-card__header">
        <SkeletonBase
          className="wallet-status-card__skeleton-badge"
          height="22px"
          width="90px"
          borderRadius="9999px"
        />
        <SkeletonBase
          className="wallet-status-card__skeleton-line"
          height="14px"
          width="80px"
        />
      </div>

      {/* Body rows */}
      <div className="wallet-status-card__body">
        <SkeletonBase
          className="wallet-status-card__skeleton-line"
          height="14px"
          width="60%"
        />
        <SkeletonBase
          className="wallet-status-card__skeleton-line"
          height="14px"
          width="40%"
        />
      </div>

      {/* Action button */}
      <div className="wallet-status-card__actions">
        <SkeletonBase height="36px" width="100px" />
      </div>
    </div>
  );
}

function ActionButton({
  status,
  capabilities,
  error,
  onConnect,
  onDisconnect,
  onRetry,
}: WalletStatusCardProps): React.JSX.Element | null {
  const effectiveCapabilities = capabilities ?? deriveCapabilities(status ?? 'DISCONNECTED');

  const handleConnect = useCallback(() => safeCall(onConnect, 'onConnect'), [onConnect]);
  const handleDisconnect = useCallback(() => safeCall(onDisconnect, 'onDisconnect'), [onDisconnect]);
  const handleRetry = useCallback(() => safeCall(onRetry, 'onRetry'), [onRetry]);

  if (effectiveCapabilities.isConnected) {
    return (
      <button
        className="wallet-status-card__btn wallet-status-card__btn--disconnect"
        onClick={handleDisconnect}
        data-testid="wallet-action-btn"
        type="button"
      >
        Disconnect
      </button>
    );
  }

  if (error && error.recoverable) {
    return (
      <button
        className="wallet-status-card__btn wallet-status-card__btn--retry"
        onClick={handleRetry}
        data-testid="wallet-action-btn"
        type="button"
      >
        Retry
      </button>
    );
  }

  if (effectiveCapabilities.canConnect) {
    return (
      <button
        className="wallet-status-card__btn wallet-status-card__btn--connect"
        onClick={handleConnect}
        disabled={effectiveCapabilities.isConnecting || effectiveCapabilities.isReconnecting}
        data-testid="wallet-action-btn"
        type="button"
      >
        {effectiveCapabilities.isConnecting || effectiveCapabilities.isReconnecting ? 'Connecting...' : 'Connect'}
      </button>
    );
  }

  return null;
}

// ── Main component ─────────────────────────────────────────────────────────────

const DEFAULT_STATUS: WalletStatus = 'DISCONNECTED';

/**
 * WalletStatusCard — wallet state summary component.
 *
 * Renders a card showing the current wallet connection status with badge,
 * address, network, provider info, error messaging, and action buttons.
 *
 * @example
 * ```tsx
 * // Controlled usage (recommended)
 * const wallet = useWalletStatus();
 * <WalletStatusCard
 *   status={wallet.status}
 *   address={wallet.address}
 *   network={wallet.network}
 *   provider={wallet.provider}
 *   capabilities={wallet.capabilities}
 *   error={wallet.error}
 *   onConnect={() => wallet.connect()}
 *   onDisconnect={wallet.disconnect}
 *   onRetry={wallet.refresh}
 * />
 *
 * // Skeleton / loading state
 * <WalletStatusCard isLoading />
 * ```
 */
export const WalletStatusCard: React.FC<WalletStatusCardProps> = ({
  status = DEFAULT_STATUS,
  address = null,
  network = null,
  provider = null,
  capabilities: capabilitiesProp,
  error = null,
  isLoading = false,
  onConnect,
  onDisconnect,
  onRetry,
  onRecoverNetwork,
  networkMismatch = false,
  networkRecoveryPending = false,
  networkRecoveryLabel,
  droppedSession = false,
  onReconnect,
  reconnectPending = false,
  reconnectLabel,
  lastUpdatedAt = null,
  isRefreshing = false,
  className,
  testId = 'wallet-status-card',
}) => {
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<WalletSessionHistoryEntry[]>(
    () => WalletSessionService.getRecentSessionHistory(),
  );

  useEffect(() => {
    setSessionHistory(WalletSessionService.getRecentSessionHistory());
  }, [status, address, network, provider?.name, lastUpdatedAt, droppedSession]);
  // ── Loading state ────────────────────────────────────────────────────────────
  if (isLoading) {
    return <WalletStatusCardSkeleton className={className} testId={testId} />;
  }

  // ── Derived values ───────────────────────────────────────────────────────────
  const capabilities: WalletCapabilities =
    capabilitiesProp ?? deriveCapabilities(status);

  const badgeVariant: WalletBadgeVariant = BADGE_VARIANT_MAP[status];
  const statusLabel: string = STATUS_LABEL_MAP[status];

  const sanitizedAddress = address ? sanitize(address) : null;
  const sanitizedNetwork = network ? sanitize(network) : null;
  const sanitizedProviderName =
    provider?.name ? sanitize(provider.name) : null;
  const recentSessionLabel = useMemo(
    () =>
      sessionHistory.length === 1
        ? '1 recent session'
        : `${sessionHistory.length} recent sessions`,
    [sessionHistory.length],
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  const containerClass = ['wallet-status-card', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={containerClass}
      data-testid={testId}
      role="region"
      aria-label="Wallet status"
    >
      {/* ── Header: badge + provider + environment ── */}
      <div className="wallet-status-card__header">
        <StatusBadge variant={badgeVariant} label={statusLabel} />

        {sanitizedProviderName !== null && (
          <div className="wallet-status-card__provider">
            <span>{sanitizedProviderName}</span>
          </div>
        )}

        {sanitizedNetwork !== null && (
          <div className="wallet-status-card__environment">
            <EnvironmentBadge environment={sanitizedNetwork} size="small" />
          </div>
        )}
      </div>

      {/* ── Freshness row: last-updated + refresh indicator ── */}
      {(lastUpdatedAt !== null || isRefreshing) && (
        <div className="wallet-status-card__freshness" data-testid="wallet-freshness">
          {isRefreshing ? (
            <span
              className="wallet-status-card__refresh-spinner"
              aria-label="Refreshing balance"
              data-testid="wallet-refresh-spinner"
              role="status"
            />
          ) : (
            lastUpdatedAt !== null && (
              <span
                className="wallet-status-card__last-updated"
                data-testid="wallet-last-updated"
                title={new Date(lastUpdatedAt).toLocaleString()}
              >
                {formatLastUpdated(lastUpdatedAt)}
              </span>
            )
          )}
        </div>
      )}

      {/* ── Body: address + network ── */}
      <div className="wallet-status-card__body">
        <div className="wallet-status-card__row">
          <span className="wallet-status-card__label">Address</span>
          {sanitizedAddress !== null ? (
            <span
              className="wallet-status-card__value wallet-status-card__value--mono"
              title={sanitizedAddress}
              data-testid="wallet-address"
            >
              {truncateAddress(sanitizedAddress)}
            </span>
          ) : (
            <span
              className="wallet-status-card__value wallet-status-card__value--muted"
              data-testid="wallet-address"
            >
              &mdash;
            </span>
          )}
        </div>

        <div className="wallet-status-card__row">
          <span className="wallet-status-card__label">Network</span>
          {sanitizedNetwork !== null ? (
            <span
              className="wallet-status-card__value"
              data-testid="wallet-network"
            >
              {sanitizedNetwork}
            </span>
          ) : (
            <span
              className="wallet-status-card__value wallet-status-card__value--muted"
              data-testid="wallet-network"
            >
              &mdash;
            </span>
          )}
        </div>
      </div>

      {/* ── Error message ── */}
      {error !== null && (
        <div
          className="wallet-status-card__error"
          role="alert"
          data-testid="wallet-error"
        >
          <span className="wallet-status-card__error-icon" aria-hidden="true">
            &#9888;
          </span>
          <span>{sanitize(error.message)}</span>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="wallet-status-card__actions">
        <ActionButton
          status={status}
          capabilities={capabilities}
          error={error}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onRetry={onRetry}
        />
      </div>

      {/* ── Dropped-session banner (distinct from network mismatch) ── */}
      {droppedSession && status !== 'CONNECTED' && (
        <DroppedSessionBanner
          onReconnect={onReconnect}
          pending={reconnectPending}
          label={reconnectLabel}
        />
      )}

      {/* ── Network mismatch banner (only shown when NOT in a dropped-session state) ── */}
      {networkMismatch && !droppedSession && (
        <NetworkRecoveryBanner
          onRecoverNetwork={onRecoverNetwork}
          pending={networkRecoveryPending}
          label={networkRecoveryLabel}
        />
      )}

      {sessionHistory.length > 0 && (
        <div className="wallet-status-card__history" data-testid="wallet-session-history">
          <button
            className="wallet-status-card__history-toggle"
            type="button"
            aria-expanded={historyExpanded}
            onClick={() => setHistoryExpanded((current) => !current)}
          >
            <span>{recentSessionLabel}</span>
            <span className="wallet-status-card__history-toggle-icon" aria-hidden="true">
              {historyExpanded ? 'Hide' : 'Show'}
            </span>
          </button>

          {historyExpanded && (
            <ul className="wallet-status-card__history-list">
              {sessionHistory.map((entry) => (
                <li key={entry.id} className="wallet-status-card__history-item">
                  <div className="wallet-status-card__history-main">
                    <span className="wallet-status-card__history-event">
                      {getSessionEventLabel(entry.type)}
                    </span>
                    <span className="wallet-status-card__history-address">
                      {entry.addressPreview}
                    </span>
                  </div>
                  <div className="wallet-status-card__history-meta">
                    <span>{entry.providerName}</span>
                    <span>{entry.network}</span>
                    <span>{formatSessionTime(entry.occurredAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

WalletStatusCard.displayName = 'WalletStatusCard';

export default WalletStatusCard;
