/**
 * Type definitions for the AccountSwitcher component.
 */

export interface RecentAccount {
  /** Full Stellar public key */
  address: string;
  /** Human-readable label (e.g. "Account 1", custom nickname) */
  label?: string;
  /** Wallet provider name */
  providerName?: string;
  /** Network this account was last used on */
  network?: string;
  /** Unix ms timestamp of last use */
  lastUsedAt: number;
}

export interface AccountSwitcherProps {
  /** Currently connected address (null = disconnected) */
  currentAddress?: string | null;
  /** Network the current account is connected to */
  currentNetwork?: string | null;
  /** Wallet provider name for the current session */
  currentProvider?: string | null;
  /**
   * Called when the user picks a recent account from the list.
   * The parent is responsible for actually switching the wallet session.
   */
  onSelectAccount?: (account: RecentAccount) => void;
  /** Called when the user requests a fresh wallet connection */
  onConnectNew?: () => void;
  /** Called when the user disconnects the current session */
  onDisconnect?: () => void;
  /** When true the menu is disabled (e.g. a transaction is in flight) */
  disabled?: boolean;
  /** Extra CSS class on the root element */
  className?: string;
  /** Override test ID */
  testId?: string;
}
