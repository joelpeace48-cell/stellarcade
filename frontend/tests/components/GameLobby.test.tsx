import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { expect, test, vi, describe, it, beforeEach } from 'vitest';
import GameLobby from '../../src/pages/GameLobby';
import { ApiClient } from '../../src/services/typed-api-sdk';
import { ONBOARDING_CHECKLIST_DISMISSED_FLAG } from '../../src/services/global-state-store';

vi.mock('../../src/services/typed-api-sdk');
vi.mock('../../src/hooks/v1/useWalletStatus', () => ({
  useWalletStatus: () => ({
    status: 'disconnected',
    address: null,
    network: null,
    provider: null,
    capabilities: { isConnected: false },
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    refresh: vi.fn(),
    isRefreshing: false,
    lastUpdatedAt: null,
  }),
}));
vi.mock('../../src/utils/v1/useNetworkGuard', () => ({
  isSupportedNetwork: () => ({
    isSupported: true,
    normalizedActual: 'TESTNET',
    supportedNetworks: ['TESTNET', 'PUBLIC'],
  }),
}));

beforeEach(() => {
  localStorage.clear();
});

test('renders GameLobby and fetches games', async () => {
  const mockGames = [
    { id: '123456789', name: 'Elite Clash', status: 'active', wager: 50 }
  ];
  
  (ApiClient as any).prototype.getGames.mockResolvedValue({
    success: true,
    data: mockGames
  });

  render(<GameLobby />);
  
  expect(screen.getByText(/Loading elite games.../i)).toBeDefined();
  
  await waitFor(() => {
    expect(screen.getAllByText(/Elite Clash/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/50 XLM/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/#12345678/i)).toBeDefined();
  });
});

describe('GameLobby two-column layout', () => {
  it('renders the lobby-dashboard container', async () => {
    (ApiClient as any).prototype.getGames.mockResolvedValue({
      success: true,
      data: [],
    });

    const { container } = render(<GameLobby />);

    await waitFor(() => {
      expect(container.querySelector('.lobby-dashboard')).toBeTruthy();
    });
  });

  it('renders two dashboard columns', async () => {
    (ApiClient as any).prototype.getGames.mockResolvedValue({
      success: true,
      data: [],
    });

    const { container } = render(<GameLobby />);

    await waitFor(() => {
      const cols = container.querySelectorAll('.lobby-dashboard__col');
      expect(cols.length).toBe(2);
    });
  });

  it('renders the games grid when games are present', async () => {
    (ApiClient as any).prototype.getGames.mockResolvedValue({
      success: true,
      data: [{ id: 'abc123', name: 'Test Game', status: 'active', wager: 10 }],
    });

    const { container } = render(<GameLobby />);

    await waitFor(() => {
      expect(container.querySelector('.games-grid')).toBeTruthy();
    });
  });

  it('renders empty state when no games', async () => {
    (ApiClient as any).prototype.getGames.mockResolvedValue({
      success: true,
      data: [],
    });

    render(<GameLobby />);

    await waitFor(() => {
      expect(screen.getByText(/No games active/i)).toBeDefined();
    });
  });

  it('renders KPI cards with full metric data', async () => {
    localStorage.setItem(
      'stc_global_state_v1',
      JSON.stringify({
        auth: { isAuthenticated: false },
        flags: {},
        pendingTransaction: {
          operation: 'wallet.deposit',
          phase: 'SUBMITTING',
          txHash: 'abc1234567890',
          startedAt: 1_700_000_000_000,
          updatedAt: 1_700_000_000_000,
        },
        storedAt: Date.now(),
      }),
    );
    (ApiClient as any).prototype.getGames.mockResolvedValue({
      success: true,
      data: [
        { id: 'g1', name: 'Game One', status: 'active', wager: 25 },
        { id: 'g2', name: 'Game Two', status: 'active', wager: 10 },
      ],
    });

    render(<GameLobby />);

    await waitFor(() => {
      expect(screen.getByTestId('lobby-kpi-strip')).toBeInTheDocument();
      expect(screen.getByText(/No wallet connected/i)).toBeInTheDocument();
      expect(screen.getAllByText(/SUBMITTING/i).length).toBeGreaterThan(0);
      expect(screen.getByTestId('lobby-prize-pool-kpi-balance')).toHaveTextContent('35.00');
    });
  });

  it('keeps partial KPI fallbacks readable when only some metrics exist', async () => {
    (ApiClient as any).prototype.getGames.mockResolvedValue({
      success: true,
      data: [{ id: 'g1', name: 'Game One', status: 'active' }],
    });

    render(<GameLobby />);

    await waitFor(() => {
      expect(screen.getByText(/No pending tx/i)).toBeInTheDocument();
      expect(screen.getByTestId('lobby-prize-pool-kpi-empty')).toHaveTextContent(
        /No prize-pool metrics available yet/i,
      );
    });
  });

  it('renders empty-state KPI fallbacks when no metrics are available', async () => {
    (ApiClient as any).prototype.getGames.mockResolvedValue({
      success: true,
      data: [],
    });

    render(<GameLobby />);

    await waitFor(() => {
      expect(screen.getByText(/No wallet connected/i)).toBeInTheDocument();
      expect(screen.getByText(/Waiting for the next wallet action/i)).toBeInTheDocument();
      expect(screen.getByTestId('lobby-prize-pool-kpi-empty')).toBeInTheDocument();
    });
  });
});

describe('GameLobby - first-time onboarding checklist', () => {
  it('renders the checklist for a first-time user (no dismissed flag)', async () => {
    (ApiClient as any).prototype.getGames.mockResolvedValue({ success: true, data: [] });

    render(<GameLobby />);

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-checklist')).toBeInTheDocument();
    });
  });

  it('does not render the checklist when the dismissed flag is set in localStorage', async () => {
    const state = {
      auth: { isAuthenticated: false },
      flags: { [ONBOARDING_CHECKLIST_DISMISSED_FLAG]: true },
      storedAt: Date.now(),
    };
    localStorage.setItem('stc_global_state_v1', JSON.stringify(state));
    (ApiClient as any).prototype.getGames.mockResolvedValue({ success: true, data: [] });

    render(<GameLobby />);

    await waitFor(() => {
      expect(screen.queryByTestId('onboarding-checklist')).not.toBeInTheDocument();
    });
  });

  it('hides the checklist and persists the dismissal when dismiss button is clicked', async () => {
    (ApiClient as any).prototype.getGames.mockResolvedValue({ success: true, data: [] });

    render(<GameLobby />);

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-checklist')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('onboarding-checklist-dismiss'));

    expect(screen.queryByTestId('onboarding-checklist')).not.toBeInTheDocument();

    // Flag must be written to localStorage so a page reload keeps it dismissed
    const stored = JSON.parse(localStorage.getItem('stc_global_state_v1') ?? '{}');
    expect(stored.flags?.[ONBOARDING_CHECKLIST_DISMISSED_FLAG]).toBe(true);
  });

  it('checklist items can be toggled independently', async () => {
    (ApiClient as any).prototype.getGames.mockResolvedValue({ success: true, data: [] });

    render(<GameLobby />);

    await waitFor(() => {
      expect(screen.getByTestId('checklist-item-connect-wallet')).toBeInTheDocument();
    });

    const checkbox = screen.getByTestId('checklist-item-connect-wallet') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it('checklist has accessible aria-label', async () => {
    (ApiClient as any).prototype.getGames.mockResolvedValue({ success: true, data: [] });

    render(<GameLobby />);

    await waitFor(() => {
      expect(
        screen.getByRole('complementary', { name: /getting started checklist/i }),
      ).toBeInTheDocument();
    });
  });

  it('returning user: checklist absent when dismissal is persisted', async () => {
    const state = {
      auth: { isAuthenticated: false },
      flags: { [ONBOARDING_CHECKLIST_DISMISSED_FLAG]: true },
      storedAt: Date.now(),
    };
    localStorage.setItem('stc_global_state_v1', JSON.stringify(state));
    (ApiClient as any).prototype.getGames.mockResolvedValue({ success: true, data: [] });

    render(<GameLobby />);

    await waitFor(() => {
      expect(screen.queryByTestId('lobby-kpi-strip')).toBeInTheDocument();
      expect(screen.queryByTestId('onboarding-checklist')).not.toBeInTheDocument();
    });
  });
});

describe('GameLobby accessibility landmarks', () => {
  it('renders loading state with role="status" and aria-live', () => {
    (ApiClient as any).prototype.getGames.mockResolvedValue(
      new Promise(() => {}),
    );

    const { container } = render(<GameLobby />);
    const loadingEl = container.querySelector('.lobby-loading');
    expect(loadingEl).toBeTruthy();
    expect(loadingEl?.getAttribute('role')).toBe('status');
    expect(loadingEl?.getAttribute('aria-live')).toBe('polite');
    expect(screen.getByTestId('skeleton-preset-detail')).toBeInTheDocument();
  });

  it('renders error state with role="status" and aria-live', async () => {
    (ApiClient as any).prototype.getGames.mockResolvedValue({
      success: false,
      error: { message: 'Network error' },
    });

    const { container } = render(<GameLobby />);

    await waitFor(() => {
      const errorEl = container.querySelector('.lobby-error');
      expect(errorEl).toBeTruthy();
      expect(errorEl?.getAttribute('role')).toBe('status');
      expect(errorEl?.getAttribute('aria-live')).toBe('polite');
    });
  });

  it('renders dashboard as a section with aria-label', async () => {
    (ApiClient as any).prototype.getGames.mockResolvedValue({
      success: true,
      data: [],
    });

    const { container } = render(<GameLobby />);

    await waitFor(() => {
      const dashboard = container.querySelector('.lobby-dashboard');
      expect(dashboard).toBeTruthy();
      expect(dashboard?.tagName).toBe('SECTION');
      expect(dashboard?.getAttribute('aria-label')).toBe(
        'Wallet and network status',
      );
    });
  });

  it('exposes the lobby page title as the top-level heading', async () => {
    (ApiClient as any).prototype.getGames.mockResolvedValue({
      success: true,
      data: [],
    });

    render(<GameLobby />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Live Arena' })).toBeInTheDocument();
    });
  });

  it('renders games section with aria-labelledby referencing heading', async () => {
    (ApiClient as any).prototype.getGames.mockResolvedValue({
      success: true,
      data: [{ id: 'g1', name: 'Game One', status: 'active', wager: 25 }],
    });

    const { container } = render(<GameLobby />);

    await waitFor(() => {
      const gamesSection = container.querySelector('.games-section');
      expect(gamesSection).toBeTruthy();
      expect(gamesSection?.tagName).toBe('SECTION');
      expect(gamesSection?.getAttribute('aria-labelledby')).toBe(
        'games-heading',
      );

      const heading = container.querySelector('#games-heading');
      expect(heading).toBeTruthy();
      expect(heading?.textContent).toBe('Live Arena');
    });
  });

  it('renders games grid with role="region" and aria-label', async () => {
    (ApiClient as any).prototype.getGames.mockResolvedValue({
      success: true,
      data: [{ id: 'g2', name: 'Game Two', status: 'active', wager: 10 }],
    });

    const { container } = render(<GameLobby />);

    await waitFor(() => {
      const grid = container.querySelector('.games-grid');
      expect(grid).toBeTruthy();
      expect(grid?.getAttribute('role')).toBe('region');
      expect(grid?.getAttribute('aria-label')).toBe('Active games');
    });
  });

  it('renders empty state with role="status" and aria-live', async () => {
    (ApiClient as any).prototype.getGames.mockResolvedValue({
      success: true,
      data: [],
    });

    const { container } = render(<GameLobby />);

    await waitFor(() => {
      const emptyEl = container.querySelector('.lobby-empty');
      expect(emptyEl).toBeTruthy();
      expect(emptyEl?.getAttribute('role')).toBe('status');
      expect(emptyEl?.getAttribute('aria-live')).toBe('polite');
    });
  });

  it('opens a transaction detail slide-over from the summary card', async () => {
    localStorage.setItem(
      'stc_global_state_v1',
      JSON.stringify({
        auth: { isAuthenticated: false },
        flags: {},
        pendingTransaction: {
          operation: 'wallet.deposit',
          phase: 'SUBMITTING',
          txHash: 'abc1234567890',
          startedAt: 1_700_000_000_000,
          updatedAt: 1_700_000_000_500,
        },
        storedAt: Date.now(),
      }),
    );
    (ApiClient as any).prototype.getGames.mockResolvedValue({
      success: true,
      data: [{ id: 'g1', name: 'Game One', status: 'active', wager: 25 }],
    });

    render(<GameLobby />);

    await waitFor(() => {
      expect(screen.getByTestId('transaction-detail-trigger')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('transaction-detail-trigger'));

    expect(screen.getByTestId('transaction-detail-drawer')).toBeInTheDocument();
    expect(screen.getByText(/wallet deposit/i)).toBeInTheDocument();
    expect(screen.getByText(/abc1234567890/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('transaction-detail-drawer-close'));
    expect(screen.getByTestId('transaction-detail-drawer')).not.toHaveClass('drawer--open');
  });

  it('restores compact leaderboard density from persisted preference', async () => {
    localStorage.setItem('stc_table_density_v1_dashboard-surfaces', 'compact');
    (ApiClient as any).prototype.getGames.mockResolvedValue({
      success: true,
      data: [{ id: 'g1', name: 'Game One', status: 'active', wager: 25 }],
    });

    render(<GameLobby />);

    await waitFor(() => {
      expect(screen.getByTestId('leaderboard-table')).toHaveClass('data-table--compact');
    });

    expect(screen.getByTestId('leaderboard-density-compact')).toHaveAttribute('aria-pressed', 'true');
  });
});
