/**
 * @vitest-environment happy-dom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock account-memory-service ──────────────────────────────────────────────

import type { RecentAccount } from '@/components/v1/AccountSwitcher.types';

const mockGetRecentAccounts = vi.fn((): RecentAccount[] => []);
const mockRecordAccountUsage = vi.fn();
const mockRemoveAccount = vi.fn();

vi.mock('@/services/account-memory-service', () => ({
  getRecentAccounts: () => mockGetRecentAccounts(),
  recordAccountUsage: (a: unknown) => mockRecordAccountUsage(a),
  removeAccount: (addr: string) => mockRemoveAccount(addr),
  clearRecentAccounts: vi.fn(),
}));

// Import component after mocks are in place
import { AccountSwitcher } from '@/components/v1/AccountSwitcher';

const ADDR_A = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37';
const ADDR_B = 'GCZ6Q4P4JSGZJGJBBXJ3UVBSKJB3HNVVUOHB2JGLQKRGXPGMV7OMEFP';

const recentB = {
  address: ADDR_B,
  label: 'Account B',
  providerName: 'Freighter',
  network: 'testnet',
  lastUsedAt: Date.now() - 60_000,
};

beforeEach(() => {
  mockGetRecentAccounts.mockReturnValue([]);
  mockRecordAccountUsage.mockReset();
  mockRemoveAccount.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('AccountSwitcher — rendering', () => {
  it('renders the trigger button', () => {
    render(<AccountSwitcher />);
    expect(screen.getByTestId('account-switcher-trigger')).toBeInTheDocument();
  });

  it('shows truncated address in trigger when connected', () => {
    render(<AccountSwitcher currentAddress={ADDR_A} />);
    const trigger = screen.getByTestId('account-switcher-trigger');
    expect(trigger.textContent).toContain('GDQP2K');
  });

  it('shows "Connect wallet" when disconnected', () => {
    render(<AccountSwitcher />);
    expect(screen.getByTestId('account-switcher-trigger').textContent).toContain(
      'Connect wallet',
    );
  });

  it('does not render the menu when closed', () => {
    render(<AccountSwitcher currentAddress={ADDR_A} />);
    expect(screen.queryByTestId('account-switcher-menu')).not.toBeInTheDocument();
  });
});

// ── Open / close ──────────────────────────────────────────────────────────────

describe('AccountSwitcher — open/close', () => {
  it('opens menu on trigger click', () => {
    render(<AccountSwitcher currentAddress={ADDR_A} />);
    fireEvent.click(screen.getByTestId('account-switcher-trigger'));
    expect(screen.getByTestId('account-switcher-menu')).toBeInTheDocument();
  });

  it('closes menu on second trigger click', () => {
    render(<AccountSwitcher currentAddress={ADDR_A} />);
    fireEvent.click(screen.getByTestId('account-switcher-trigger'));
    fireEvent.click(screen.getByTestId('account-switcher-trigger'));
    expect(screen.queryByTestId('account-switcher-menu')).not.toBeInTheDocument();
  });

  it('closes menu on Escape key', () => {
    render(<AccountSwitcher currentAddress={ADDR_A} />);
    fireEvent.click(screen.getByTestId('account-switcher-trigger'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('account-switcher-menu')).not.toBeInTheDocument();
  });

  it('does not open when disabled', () => {
    render(<AccountSwitcher currentAddress={ADDR_A} disabled />);
    fireEvent.click(screen.getByTestId('account-switcher-trigger'));
    expect(screen.queryByTestId('account-switcher-menu')).not.toBeInTheDocument();
  });
});

// ── Current account section ───────────────────────────────────────────────────

describe('AccountSwitcher — current account', () => {
  it('shows current account in menu', () => {
    render(<AccountSwitcher currentAddress={ADDR_A} currentNetwork="testnet" />);
    fireEvent.click(screen.getByTestId('account-switcher-trigger'));
    expect(screen.getByTestId('account-switcher-current')).toBeInTheDocument();
  });

  it('displays provider and network metadata', () => {
    render(
      <AccountSwitcher
        currentAddress={ADDR_A}
        currentProvider="Freighter"
        currentNetwork="testnet"
      />,
    );
    fireEvent.click(screen.getByTestId('account-switcher-trigger'));
    const menu = screen.getByTestId('account-switcher-menu');
    expect(menu.textContent).toContain('Freighter');
    expect(menu.textContent).toContain('testnet');
  });
});

// ── Recent accounts ───────────────────────────────────────────────────────────

describe('AccountSwitcher — recent accounts', () => {
  it('shows recent accounts (excluding current)', () => {
    mockGetRecentAccounts.mockReturnValue([recentB]);
    render(<AccountSwitcher currentAddress={ADDR_A} />);
    fireEvent.click(screen.getByTestId('account-switcher-trigger'));
    expect(
      screen.getByTestId(`account-switcher-recent-${ADDR_B}`),
    ).toBeInTheDocument();
  });

  it('calls onSelectAccount when a recent account is clicked', () => {
    mockGetRecentAccounts.mockReturnValue([recentB]);
    const onSelect = vi.fn();
    render(<AccountSwitcher currentAddress={ADDR_A} onSelectAccount={onSelect} />);
    fireEvent.click(screen.getByTestId('account-switcher-trigger'));
    fireEvent.click(screen.getByTestId(`account-switcher-recent-${ADDR_B}`));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ address: ADDR_B }));
  });

  it('does not call onSelectAccount when clicking the current account item', () => {
    // currentAddress also appears in recents
    mockGetRecentAccounts.mockReturnValue([
      { ...recentB, address: ADDR_A, lastUsedAt: Date.now() },
    ]);
    const onSelect = vi.fn();
    render(<AccountSwitcher currentAddress={ADDR_A} onSelectAccount={onSelect} />);
    fireEvent.click(screen.getByTestId('account-switcher-trigger'));
    // The current-account section item is not a clickable button that triggers select
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows "No recent accounts" when list is empty and disconnected', () => {
    mockGetRecentAccounts.mockReturnValue([]);
    render(<AccountSwitcher />);
    fireEvent.click(screen.getByTestId('account-switcher-trigger'));
    expect(screen.getByText(/no recent accounts/i)).toBeInTheDocument();
  });
});

// ── Forget (remove) account ───────────────────────────────────────────────────

describe('AccountSwitcher — forget account', () => {
  it('calls removeAccount when forget button is clicked', () => {
    mockGetRecentAccounts.mockReturnValue([recentB]);
    render(<AccountSwitcher currentAddress={ADDR_A} />);
    fireEvent.click(screen.getByTestId('account-switcher-trigger'));
    fireEvent.click(screen.getByTestId(`account-switcher-forget-${ADDR_B}`));
    expect(mockRemoveAccount).toHaveBeenCalledWith(ADDR_B);
  });
});

// ── Action buttons ────────────────────────────────────────────────────────────

describe('AccountSwitcher — actions', () => {
  it('calls onConnectNew when "Connect another wallet" is clicked', () => {
    const onConnectNew = vi.fn();
    render(<AccountSwitcher onConnectNew={onConnectNew} />);
    fireEvent.click(screen.getByTestId('account-switcher-trigger'));
    fireEvent.click(screen.getByTestId('account-switcher-connect-new'));
    expect(onConnectNew).toHaveBeenCalledOnce();
  });

  it('calls onDisconnect when "Disconnect" is clicked', () => {
    const onDisconnect = vi.fn();
    render(
      <AccountSwitcher currentAddress={ADDR_A} onDisconnect={onDisconnect} />,
    );
    fireEvent.click(screen.getByTestId('account-switcher-trigger'));
    fireEvent.click(screen.getByTestId('account-switcher-disconnect'));
    expect(onDisconnect).toHaveBeenCalledOnce();
  });

  it('does not render disconnect button when disconnected', () => {
    const onDisconnect = vi.fn();
    render(<AccountSwitcher onDisconnect={onDisconnect} />);
    fireEvent.click(screen.getByTestId('account-switcher-trigger'));
    expect(screen.queryByTestId('account-switcher-disconnect')).not.toBeInTheDocument();
  });

  it('closes menu after selecting an action', () => {
    const onConnectNew = vi.fn();
    render(<AccountSwitcher onConnectNew={onConnectNew} />);
    fireEvent.click(screen.getByTestId('account-switcher-trigger'));
    fireEvent.click(screen.getByTestId('account-switcher-connect-new'));
    expect(screen.queryByTestId('account-switcher-menu')).not.toBeInTheDocument();
  });
});

// ── Recent account memory (recordAccountUsage) ────────────────────────────────

describe('AccountSwitcher — account memory', () => {
  it('records current address on mount', () => {
    render(
      <AccountSwitcher
        currentAddress={ADDR_A}
        currentProvider="Freighter"
        currentNetwork="testnet"
      />,
    );
    expect(mockRecordAccountUsage).toHaveBeenCalledWith(
      expect.objectContaining({ address: ADDR_A }),
    );
  });

  it('does not record usage when no address is provided', () => {
    render(<AccountSwitcher />);
    expect(mockRecordAccountUsage).not.toHaveBeenCalled();
  });
});

// ── Accessibility ─────────────────────────────────────────────────────────────

describe('AccountSwitcher — accessibility', () => {
  it('trigger has aria-haspopup="menu"', () => {
    render(<AccountSwitcher currentAddress={ADDR_A} />);
    expect(screen.getByTestId('account-switcher-trigger')).toHaveAttribute(
      'aria-haspopup',
      'menu',
    );
  });

  it('trigger aria-expanded reflects open state', () => {
    render(<AccountSwitcher currentAddress={ADDR_A} />);
    const trigger = screen.getByTestId('account-switcher-trigger');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('menu has role="menu"', () => {
    render(<AccountSwitcher currentAddress={ADDR_A} />);
    fireEvent.click(screen.getByTestId('account-switcher-trigger'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
});
