import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import ContractEventFeed from '../components/v1/ContractEventFeed';
import { SkeletonPreset } from '../components/v1/LoadingSkeletonSet';
import { ApiClient } from '../services/typed-api-sdk';
import type { Game } from '../types/api-client';

const FALLBACK_CONTRACT_PREFIX = 'game';

function resolveContractId(game: Game): string {
  const contractCandidate = game.contractId;
  if (typeof contractCandidate === 'string' && contractCandidate.trim().length > 0) {
    return contractCandidate.trim();
  }

  return `${FALLBACK_CONTRACT_PREFIX}-${game.id}`;
}

export const GameDetail: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);

  useEffect(() => {
    const normalizedGameId = gameId?.trim() ?? '';
    if (!normalizedGameId) {
      setLoading(false);
      setError('Game id is required.');
      setGame(null);
      return;
    }

    let active = true;
    const loadGame = async () => {
      setLoading(true);
      setError(null);

      const client = new ApiClient();
      const result = await client.getGameById(normalizedGameId);

      if (!active) return;

      if (result.success) {
        setGame(result.data);
      } else {
        setError(result.error.message);
        setGame(null);
      }

      setLoading(false);
    };

    void loadGame();

    return () => {
      active = false;
    };
  }, [gameId]);

  const statusLabel = useMemo(() => {
    if (!game) return 'unknown';
    return String(game.status ?? 'unknown').toLowerCase();
  }, [game]);

  if (loading) {
    return (
      <div role="status" aria-live="polite" data-testid="game-detail-loading">
        <p>Loading game details...</p>
        <SkeletonPreset type="detail" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="status" aria-live="polite" data-testid="game-detail-error">
        Failed to load game: {error}
      </div>
    );
  }

  if (!game) {
    return (
      <div role="status" aria-live="polite" data-testid="game-detail-empty">
        No game found for id: {gameId}
      </div>
    );
  }

  const contractId = resolveContractId(game);

  return (
    <section className="game-detail" aria-labelledby="game-detail-heading" data-testid="game-detail-page">
      <header className="game-detail__summary">
        <h1 id="game-detail-heading">{game.name}</h1>
        <p data-testid="game-detail-id">Game ID: {game.id}</p>
        <p data-testid="game-detail-status">Status: {statusLabel}</p>
        <p data-testid="game-detail-contract">Contract: {contractId}</p>
      </header>

      <ContractEventFeed
        contractId={contractId}
        autoStart={true}
        maxEvents={50}
        feedScope={`game-detail-${game.id}`}
        testId="game-detail-timeline"
      />
    </section>
  );
};

export default GameDetail;
