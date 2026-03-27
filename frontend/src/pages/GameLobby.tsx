import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiClient } from '../services/typed-api-sdk';
import { Game } from '../types/api-client';
import StatusCard from '../components/v1/StatusCard';
import NetworkGuardBanner from '../components/v1/NetworkGuardBanner';
import WalletStatusCard from '../components/v1/WalletStatusCard';
import { isSupportedNetwork } from '../utils/v1/useNetworkGuard';
import { useWalletStatus } from '../hooks/v1/useWalletStatus';

const GameLobby: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [networkCheckPending, setNetworkCheckPending] = useState(false);
  const wallet = useWalletStatus();

  const networkSupport = useMemo(
    () => isSupportedNetwork(wallet.network, { supportedNetworks: ['TESTNET', 'PUBLIC'] }),
    [wallet.network],
  );

  const networkMismatch = wallet.capabilities.isConnected && !networkSupport.isSupported;

  useEffect(() => {
    const fetchGames = async () => {
      const client = new ApiClient();
      const result = await client.getGames();
      
      if (result.success) {
        setGames(result.data);
      } else {
        setError(result.error.message);
      }
      setLoading(false);
    };

    fetchGames();
  }, []);

  const retryNetworkCheck = useCallback(async () => {
    if (networkCheckPending) return;
    setNetworkCheckPending(true);
    try {
      await wallet.refresh();
    } finally {
      setNetworkCheckPending(false);
    }
  }, [wallet, networkCheckPending]);

  const recoverNetwork = useCallback(async () => {
    await retryNetworkCheck();
  }, [retryNetworkCheck]);

  if (loading) return <div className="lobby-loading">Loading elite games...</div>;
  if (error) return <div className="lobby-error">Failed to load games: {error}</div>;

  return (
    <div className="game-lobby">
      <NetworkGuardBanner
        network={wallet.network}
        normalizedNetwork={networkSupport.normalizedActual}
        supportedNetworks={networkSupport.supportedNetworks}
        isSupported={!networkMismatch}
        onSwitchNetwork={recoverNetwork}
        onRetryNetworkCheck={retryNetworkCheck}
        actionLabel="Recover Network"
        retryLabel="Retry Check"
        dismissible={false}
        show={networkMismatch}
      />

      <WalletStatusCard
        status={wallet.status}
        address={wallet.address}
        network={wallet.network}
        provider={wallet.provider}
        capabilities={wallet.capabilities}
        error={wallet.error}
        onConnect={() => wallet.connect()}
        onDisconnect={wallet.disconnect}
        onRetry={wallet.refresh}
        networkMismatch={networkMismatch}
        networkRecoveryPending={networkCheckPending}
        onRecoverNetwork={recoverNetwork}
        networkRecoveryLabel="Recover Network"
      />

      <div className="lobby-header">
        <h2>Live Arena</h2>
        <p>Real-time game status across the Stellar ecosystem.</p>
      </div>
      
      {games.length === 0 ? (
        <div className="lobby-empty">
          <div className="empty-icon">📭</div>
          <p>No games active at the moment. Check back later!</p>
        </div>
      ) : (
        <div className="games-grid">
          {games.map((game) => (
            <StatusCard 
              key={game.id}
              id={game.id}
              name={game.name}
              status={game.status}
              wager={game.wager as number | undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default GameLobby;
