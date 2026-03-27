/**
 * NetworkGuardBanner - Unsupported network warning component
 *
 * Displays a dismissible or persistent banner warning when the connected
 * wallet network is not in the supported networks list. Provides optional
 * action callbacks for network switching flows.
 *
 */

import React, { useState, useCallback, useMemo, useEffect } from "react";
import type { ReactNode } from "react";
import {
  isBannerDismissed,
  persistBannerDismissal,
} from "../../services/global-state-store";
import {
  resumeQueuedNetworkActions,
  getQueuedNetworkActionsCount,
} from "../../services/network-guard-middleware";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface NetworkGuardBannerProps {
  /** Current connected network identifier */
  network: string | null;

  /** Normalized network name for display */
  normalizedNetwork: string;

  /** List of supported networks */
  supportedNetworks: readonly string[];

  /** Whether the current network is supported */
  isSupported: boolean;

  /** Optional callback when user clicks action button */
  onSwitchNetwork?: () => void | Promise<void>;

  /** Optional callback to retry current network detection */
  onRetryNetworkCheck?: () => void | Promise<void>;

  /** Whether banner can be dismissed by user (default: true) */
  dismissible?: boolean;

  /** Custom error message to display */
  errorMessage?: string;

  /** Custom action button label (default: "Switch Network") */
  actionLabel?: string;

  /** Optional retry button label (default: "Retry Check") */
  retryLabel?: string;

  /** Whether to show the banner at all (default: true) */
  show?: boolean;

  /** Optional custom content renderer */
  children?: ReactNode;
  /** Persist dismissals across reloads for this banner (default: false). */
  persistDismissal?: boolean;
  /** Stable key used to store dismissal state (required when persistDismissal=true). */
  dismissalKey?: string;
  /** Versioned identity of the current banner message to prevent carryover. */
  dismissalIdentity?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export const NetworkGuardBanner = React.memo(
  ({
    network,
    normalizedNetwork,
    supportedNetworks,
    isSupported,
    onSwitchNetwork,
    onRetryNetworkCheck,
    dismissible = true,
    errorMessage,
    actionLabel = "Switch Network",
    retryLabel = "Retry Check",
    show = true,
    children,
    persistDismissal = false,
    dismissalKey = "network-guard-banner",
    dismissalIdentity,
  }: NetworkGuardBannerProps) => {
    const [isDismissed, setIsDismissed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const resolvedIdentity = useMemo(
      () =>
        dismissalIdentity ??
        `${network ?? "unknown"}:${normalizedNetwork}:${supportedNetworks.join("|")}`,
      [dismissalIdentity, network, normalizedNetwork, supportedNetworks],
    );

    useEffect(() => {
      if (!persistDismissal || !dismissible) {
        setIsDismissed(false);
        return;
      }
      setIsDismissed(isBannerDismissed(dismissalKey, resolvedIdentity));
    }, [persistDismissal, dismissible, dismissalKey, resolvedIdentity]);

    useEffect(() => {
      if (isSupported) {
        resumeQueuedNetworkActions().catch((err) => {
          console.error("[NetworkGuardBanner] Error resuming queued actions:", err);
        });
      }
    }, [isSupported]);

    // Determine if banner should be visible
    const shouldShow = useMemo(() => {
      return show && !isSupported && !isDismissed;
    }, [show, isSupported, isDismissed]);

    // Validate that network data is available when unsupported
    const hasValidData = useMemo(() => {
      if (isSupported) return true;
      return (
        network !== null && network !== undefined && normalizedNetwork !== ""
      );
    }, [isSupported, network, normalizedNetwork]);

    // Default error message if none provided
    const displayMessage = useMemo(() => {
      if (errorMessage) return errorMessage;
      if (!hasValidData) {
        return "Network configuration error. Please refresh your browser.";
      }
      const supportedList =
        supportedNetworks.length > 0
          ? supportedNetworks.join(", ")
          : "supported networks";
      return `This app only works on ${supportedList}. Current network: ${normalizedNetwork}`;
    }, [errorMessage, hasValidData, supportedNetworks, normalizedNetwork]);

    // Handle dismiss action
    const handleDismiss = useCallback(() => {
      if (dismissible) {
        setIsDismissed(true);
        if (persistDismissal) {
          persistBannerDismissal(dismissalKey, resolvedIdentity, true);
        }
      }
    }, [dismissible, persistDismissal, dismissalKey, resolvedIdentity]);

    // Handle network switch action
    const handleSwitchNetwork = useCallback(async () => {
      if (!onSwitchNetwork || isLoading) return;

      setIsLoading(true);
      try {
        await Promise.resolve(onSwitchNetwork());
      } catch (error) {
        console.error("[NetworkGuardBanner] Error switching network:", error);
      } finally {
        setIsLoading(false);
      }
    }, [onSwitchNetwork, isLoading]);

    const handleRetryNetworkCheck = useCallback(async () => {
      if (!onRetryNetworkCheck || isLoading) return;

      setIsLoading(true);
      try {
        await Promise.resolve(onRetryNetworkCheck());
      } catch (error) {
        console.error("[NetworkGuardBanner] Error retrying network check:", error);
      } finally {
        setIsLoading(false);
      }
    }, [onRetryNetworkCheck, isLoading]);

    // Render nothing if banner shouldn't show
    if (!shouldShow) {
      return null;
    }

    // Render nothing if network guard is not applicable (valid network)
    if (isSupported) {
      return null;
    }

    // Render custom children if provided
    if (children) {
      return <>{children}</>;
    }

    // Render default warning banner
    return (
      <div
        role="alert"
        className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4"
        data-testid="network-guard-banner"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            {/* Warning Icon */}
            <div className="flex-shrink-0 pt-0.5">
              <svg
                className="w-5 h-5 text-yellow-600"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            {/* Message Content */}
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-800">
                Unsupported Network
              </h3>
              <p className="text-sm text-yellow-700 mt-1">{displayMessage}</p>
              {getQueuedNetworkActionsCount() > 0 && (
                <p className="text-xs text-yellow-600 mt-2 font-medium">
                  {getQueuedNetworkActionsCount()} action(s) will resume
                  automatically after network recovery.
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {onSwitchNetwork && (
              <button
                onClick={handleSwitchNetwork}
                disabled={isLoading}
                className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid="network-switch-button"
                aria-busy={isLoading}
              >
                {isLoading ? (
                  <>
                    <svg
                      className="w-4 h-4 mr-2 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Switching...
                  </>
                ) : (
                  actionLabel
                )}
              </button>
            )}

            {onRetryNetworkCheck && (
              <button
                onClick={handleRetryNetworkCheck}
                disabled={isLoading}
                className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium bg-white text-yellow-800 border border-yellow-300 hover:bg-yellow-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid="network-retry-button"
                aria-busy={isLoading}
              >
                {retryLabel}
              </button>
            )}

            {dismissible && (
              <button
                onClick={handleDismiss}
                className="inline-flex items-center p-2 rounded-md text-yellow-600 hover:bg-yellow-100 transition-colors"
                data-testid="network-dismiss-button"
                aria-label="Dismiss network warning"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  },
);

NetworkGuardBanner.displayName = "NetworkGuardBanner";

export default NetworkGuardBanner;
