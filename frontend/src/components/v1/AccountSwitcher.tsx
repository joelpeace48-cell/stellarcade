import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import {
  getRecentAccounts,
  recordAccountUsage,
  removeAccount,
} from '../../services/account-memory-service';
import type { AccountSwitcherProps, RecentAccount } from './AccountSwitcher.types';
import './AccountSwitcher.css';

function truncateAddress(address: string, head = 6, tail = 4): string {
  if (address.length <= head + tail + 3) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

function avatarInitials(account: RecentAccount): string {
  if (account.label) return account.label.slice(0, 2).toUpperCase();
  return account.address.slice(0, 2).toUpperCase();
}

/**
 * AccountSwitcher — dropdown menu showing the active account and a list of
 * recently-used accounts persisted in localStorage.
 *
 * The component owns only UI state (open/closed, recent list). Wallet
 * session switching is delegated to the parent via `onSelectAccount`.
 */
export const AccountSwitcher: React.FC<AccountSwitcherProps> = ({
  currentAddress,
  currentNetwork,
  currentProvider,
  onSelectAccount,
  onConnectNew,
  onDisconnect,
  disabled = false,
  className = '',
  testId = 'account-switcher',
}) => {
  const menuId = useId();
  const triggerId = useId();
  const [open, setOpen] = useState(false);
  const [recentAccounts, setRecentAccounts] = useState<RecentAccount[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Sync recent accounts with localStorage whenever the menu opens or the
  // current address changes so the list reflects the latest usage.
  useEffect(() => {
    setRecentAccounts(getRecentAccounts());
  }, [open, currentAddress]);

  // Record the current address on mount / address change
  useEffect(() => {
    if (!currentAddress) return;
    recordAccountUsage({
      address: currentAddress,
      providerName: currentProvider ?? undefined,
      network: currentNetwork ?? undefined,
    });
  }, [currentAddress, currentNetwork, currentProvider]);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Focus first item when menu opens
  useEffect(() => {
    if (open) {
      const firstItem = menuRef.current?.querySelector<HTMLElement>(
        '[role="menuitem"]',
      );
      firstItem?.focus();
    }
  }, [open]);

  const toggle = useCallback(() => {
    if (!disabled) setOpen((v) => !v);
  }, [disabled]);

  const handleSelect = useCallback(
    (account: RecentAccount) => {
      if (account.address === currentAddress) {
        setOpen(false);
        return;
      }
      recordAccountUsage(account);
      setRecentAccounts(getRecentAccounts());
      setOpen(false);
      onSelectAccount?.(account);
    },
    [currentAddress, onSelectAccount],
  );

  const handleForget = useCallback(
    (e: React.MouseEvent, address: string) => {
      e.stopPropagation();
      removeAccount(address);
      setRecentAccounts(getRecentAccounts());
    },
    [],
  );

  const handleConnectNew = useCallback(() => {
    setOpen(false);
    onConnectNew?.();
  }, [onConnectNew]);

  const handleDisconnect = useCallback(() => {
    setOpen(false);
    onDisconnect?.();
  }, [onDisconnect]);

  // Arrow-key navigation within the menu
  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    }
  }, []);

  const isConnected = Boolean(currentAddress);
  const triggerLabel = currentAddress
    ? truncateAddress(currentAddress)
    : 'Connect wallet';

  // Accounts to show in "Recent" section (exclude the currently active one)
  const recentOthers = recentAccounts.filter(
    (a) => a.address !== currentAddress,
  );

  return (
    <div
      className={['account-switcher', className].filter(Boolean).join(' ')}
      data-testid={testId}
    >
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className={[
          'account-switcher__trigger',
          !isConnected && 'account-switcher__trigger--disconnected',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={
          isConnected
            ? `Account switcher — current: ${currentAddress}`
            : 'Account switcher — no wallet connected'
        }
        disabled={disabled}
        onClick={toggle}
        data-testid={`${testId}-trigger`}
      >
        <span className="account-switcher__address">{triggerLabel}</span>
        <svg
          className={[
            'account-switcher__chevron',
            open && 'account-switcher__chevron--open',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path
            d="M2 4l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          className="account-switcher__menu"
          onKeyDown={handleMenuKeyDown}
          data-testid={`${testId}-menu`}
        >
          {/* Current account */}
          {isConnected && currentAddress && (
            <>
              <p className="account-switcher__section-label" aria-hidden="true">
                Current account
              </p>
              <div
                className="account-switcher__item account-switcher__item--active"
                role="menuitem"
                aria-current="true"
                tabIndex={0}
                data-testid={`${testId}-current`}
              >
                <div className="account-switcher__item-avatar account-switcher__item-avatar--active">
                  {currentAddress.slice(0, 2).toUpperCase()}
                </div>
                <div className="account-switcher__item-body">
                  <span className="account-switcher__item-label">
                    {truncateAddress(currentAddress)}
                  </span>
                  {(currentNetwork || currentProvider) && (
                    <span className="account-switcher__item-meta">
                      {[currentProvider, currentNetwork]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </div>
                <svg
                  className="account-switcher__item-check"
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                >
                  <path
                    d="M2.5 7l3.5 3.5 5.5-6"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </>
          )}

          {/* Recent accounts */}
          {recentOthers.length > 0 && (
            <>
              <hr className="account-switcher__divider" aria-hidden="true" />
              <p className="account-switcher__section-label" aria-hidden="true">
                Recent accounts
              </p>
              {recentOthers.map((account) => (
                <button
                  key={account.address}
                  type="button"
                  role="menuitem"
                  className="account-switcher__item"
                  tabIndex={-1}
                  onClick={() => handleSelect(account)}
                  data-testid={`${testId}-recent-${account.address}`}
                  aria-label={`Switch to ${account.label ?? account.address}`}
                >
                  <div className="account-switcher__item-avatar">
                    {avatarInitials(account)}
                  </div>
                  <div className="account-switcher__item-body">
                    <span className="account-switcher__item-label">
                      {account.label ?? truncateAddress(account.address)}
                    </span>
                    {(account.providerName || account.network) && (
                      <span className="account-switcher__item-meta">
                        {[account.providerName, account.network]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="account-switcher__action"
                    style={{ padding: '0 0.25rem', fontSize: '0.7rem', color: '#a0aec0' }}
                    aria-label={`Forget ${account.label ?? account.address}`}
                    tabIndex={-1}
                    onClick={(e) => handleForget(e, account.address)}
                    data-testid={`${testId}-forget-${account.address}`}
                  >
                    ✕
                  </button>
                </button>
              ))}
            </>
          )}

          {/* Empty recent state */}
          {!isConnected && recentOthers.length === 0 && (
            <p className="account-switcher__empty">No recent accounts</p>
          )}

          {/* Actions */}
          <hr className="account-switcher__divider" aria-hidden="true" />

          {onConnectNew && (
            <button
              type="button"
              role="menuitem"
              className="account-switcher__action"
              tabIndex={-1}
              onClick={handleConnectNew}
              data-testid={`${testId}-connect-new`}
            >
              <span className="account-switcher__action-icon" aria-hidden="true">＋</span>
              Connect another wallet
            </button>
          )}

          {isConnected && onDisconnect && (
            <button
              type="button"
              role="menuitem"
              className="account-switcher__action account-switcher__action--danger"
              tabIndex={-1}
              onClick={handleDisconnect}
              data-testid={`${testId}-disconnect`}
            >
              <span className="account-switcher__action-icon" aria-hidden="true">↪</span>
              Disconnect
            </button>
          )}
        </div>
      )}
    </div>
  );
};

AccountSwitcher.displayName = 'AccountSwitcher';

export default AccountSwitcher;
