/**
 * WalletStatusCard Component
 *
 * Displays normalized wallet connection state, address, network, and provider.
 * Renders deterministic status badges and exposes connect/disconnect/retry callbacks.
 * Supports skeleton loading and fallback states.
 *
 * @module components/v1/WalletStatusCard
 */

import React, { useCallback } from 'react';
import { SkeletonBase } from './LoadingSkeletonSet';
import {
  BADGE_VARIANT_MAP,
  STATUS_LABEL_MAP,
  type WalletStatusCardProps,
  type WalletBadgeVariant,
  type WalletCapabilities,
  type WalletStatus,
} from './WalletStatusCard.types';
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
  className,
  testId = 'wallet-status-card',
}) => {
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
      {/* ── Header: badge + provider ── */}
      <div className="wallet-status-card__header">
        <StatusBadge variant={badgeVariant} label={statusLabel} />

        {sanitizedProviderName !== null && (
          <div className="wallet-status-card__provider">
            <span>{sanitizedProviderName}</span>
          </div>
        )}
      </div>

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

      {networkMismatch && (
        <NetworkRecoveryBanner
          onRecoverNetwork={onRecoverNetwork}
          pending={networkRecoveryPending}
          label={networkRecoveryLabel}
        />
      )}
    </div>
  );
};

WalletStatusCard.displayName = 'WalletStatusCard';

export default WalletStatusCard;
