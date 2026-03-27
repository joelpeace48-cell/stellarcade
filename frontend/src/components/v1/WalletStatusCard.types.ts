/**
 * Type definitions for WalletStatusCard component.
 *
 * Provides a typed public contract for consumers of WalletStatusCard,
 * including all props, status badges, and action callbacks.
 *
 * @module components/v1/WalletStatusCard.types
 */

import type { WalletStatus, WalletCapabilities, WalletStatusError } from '../../hooks/v1/useWalletStatus';
import type { WalletProviderInfo } from '../../types/wallet-session';

// Re-export hook types so consumers only need one import
export type { WalletStatus, WalletCapabilities, WalletStatusError };

/**
 * Visual badge variant derived from WalletStatus.
 *
 * - `connected`    : Wallet is fully connected and ready.
 * - `disconnected` : No active session.
 * - `connecting`   : Connection in progress.
 * - `reconnecting` : Restoring a previous session.
 * - `error`        : Any error state (provider missing, denied, stale, unknown).
 */
export type WalletBadgeVariant =
  | 'connected'
  | 'disconnected'
  | 'connecting'
  | 'reconnecting'
  | 'error';

/**
 * Maps a WalletStatus string to a WalletBadgeVariant for rendering.
 */
export const BADGE_VARIANT_MAP: Record<WalletStatus, WalletBadgeVariant> = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  RECONNECTING: 'reconnecting',
  PROVIDER_MISSING: 'error',
  PERMISSION_DENIED: 'error',
  STALE_SESSION: 'error',
  ERROR: 'error',
};

/**
 * Human-readable label for each WalletStatus value.
 */
export const STATUS_LABEL_MAP: Record<WalletStatus, string> = {
  CONNECTED: 'Connected',
  DISCONNECTED: 'Disconnected',
  CONNECTING: 'Connecting…',
  RECONNECTING: 'Reconnecting…',
  PROVIDER_MISSING: 'No Wallet Found',
  PERMISSION_DENIED: 'Permission Denied',
  STALE_SESSION: 'Session Expired',
  ERROR: 'Error',
};

/**
 * Action callbacks exposed by WalletStatusCard.
 * All callbacks are optional; the card guards against invalid state transitions.
 */
export interface WalletStatusCardCallbacks {
  /**
   * Called when the user clicks the connect button.
   * Guard: only callable when `capabilities.canConnect` is true.
   */
  onConnect?: () => void | Promise<void>;

  /**
   * Called when the user clicks the disconnect button.
   * Guard: only callable when `capabilities.isConnected` is true.
   */
  onDisconnect?: () => void | Promise<void>;

  /**
   * Called when the user clicks the retry button on error states.
   * Guard: only callable when error is present and `error.recoverable` is true.
   */
  onRetry?: () => void | Promise<void>;

  /**
   * Called when the user triggers network recovery from mismatch UI.
   */
  onRecoverNetwork?: () => void | Promise<void>;
}

/**
 * Props for the WalletStatusCard component.
 *
 * @example
 * ```tsx
 * // Controlled — pass hook output directly
 * function MyPage() {
 *   const wallet = useWalletStatus();
 *   return (
 *     <WalletStatusCard
 *       status={wallet.status}
 *       address={wallet.address}
 *       network={wallet.network}
 *       provider={wallet.provider}
 *       capabilities={wallet.capabilities}
 *       error={wallet.error}
 *       onConnect={() => wallet.connect()}
 *       onDisconnect={wallet.disconnect}
 *       onRetry={wallet.refresh}
 *     />
 *   );
 * }
 *
 * // Loading / skeleton state
 * <WalletStatusCard isLoading />
 *
 * // Standalone with default hook (uncontrolled)
 * <WalletStatusCard />
 * ```
 */
export interface WalletStatusCardProps extends WalletStatusCardCallbacks {
  /**
   * Normalized wallet connection status.
   * When omitted and `isLoading` is false, falls back to "DISCONNECTED".
   */
  status?: WalletStatus;

  /**
   * Connected wallet address (e.g. Stellar public key).
   * Displayed truncated with full value in title attribute.
   */
  address?: string | null;

  /**
   * Active network name (e.g. "testnet", "mainnet").
   */
  network?: string | null;

  /**
   * Wallet provider metadata (name, icon URL).
   */
  provider?: WalletProviderInfo | null;

  /**
   * Capability flags derived from status.
   * When omitted they are derived internally from `status`.
   */
  capabilities?: WalletCapabilities;

  /**
   * Typed error surface from the wallet hook.
   */
  error?: WalletStatusError | null;

  /**
   * When true, renders the skeleton loading state instead of content.
   * @default false
   */
  isLoading?: boolean;

  /**
   * Optional CSS class name for custom styling.
   */
  className?: string;

  /**
   * Optional test ID for targeting in tests.
   * @default 'wallet-status-card'
   */
  testId?: string;

  /**
   * Indicates the wallet is connected to an unsupported network.
   */
  networkMismatch?: boolean;

  /**
   * Disables recovery CTA while network checks are pending.
   */
  networkRecoveryPending?: boolean;

  /**
   * Custom recovery label for mismatch CTA.
   */
  networkRecoveryLabel?: string;
}
