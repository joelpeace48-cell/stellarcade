import { render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi, describe, it, beforeEach } from 'vitest';
import GameLobby from '../../src/pages/GameLobby';
import { ApiClient } from '../../src/services/typed-api-sdk';

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
    expect(screen.getByText(/Elite Clash/i)).toBeDefined();
    expect(screen.getByText(/50 XLM/i)).toBeDefined();
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
      expect(screen.getByText(/SUBMITTING/i)).toBeInTheDocument();
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
});
