import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GameDetail from '../../src/pages/GameDetail';
import { ApiClient } from '../../src/services/typed-api-sdk';

vi.mock('../../src/services/typed-api-sdk');
vi.mock('../../src/components/v1/ContractEventFeed', () => ({
  default: ({ contractId }: { contractId: string }) => (
    <div data-testid="timeline-feed">Timeline contract: {contractId}</div>
  ),
}));

function renderWithRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/games/:gameId" element={<GameDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GameDetail', () => {
  it('renders game summary and timeline on successful fetch', async () => {
    (ApiClient as any).prototype.getGameById.mockResolvedValue({
      success: true,
      data: {
        id: 'game-42',
        name: 'Nebula Showdown',
        status: 'active',
        contractId: 'contract-nebula-42',
      },
    });

    renderWithRoute('/games/game-42');

    expect(screen.getByText(/Loading game details.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Nebula Showdown')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Nebula Showdown' })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Nebula Showdown' })).toBeInTheDocument();
      expect(screen.getByTestId('game-detail-status')).toHaveTextContent('Status: active');
      expect(screen.getByTestId('timeline-feed')).toHaveTextContent(
        'Timeline contract: contract-nebula-42',
      );
    });
  });

  it('renders deterministic error state when fetch fails', async () => {
    (ApiClient as any).prototype.getGameById.mockResolvedValue({
      success: false,
      error: { message: 'Backend unavailable' },
    });

    renderWithRoute('/games/game-99');

    await waitFor(() => {
      expect(screen.getByTestId('game-detail-error')).toHaveTextContent(
        'Failed to load game: Backend unavailable',
      );
    });
  });

  it('renders deterministic empty state when API returns null', async () => {
    (ApiClient as any).prototype.getGameById.mockResolvedValue({
      success: true,
      data: null,
    });

    renderWithRoute('/games/missing-game');

    await waitFor(() => {
      expect(screen.getByTestId('game-detail-empty')).toHaveTextContent(
        'No game found for id: missing-game',
      );
    });
  });
});
