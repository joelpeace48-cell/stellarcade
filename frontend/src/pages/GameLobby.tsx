import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiClient } from '../services/typed-api-sdk';
import { Game } from '../types/api-client';
import StatusCard from '../components/v1/StatusCard';
import NetworkGuardBanner from '../components/v1/NetworkGuardBanner';
import WalletStatusCard from '../components/v1/WalletStatusCard';
import PrizePoolStateCard from '../components/v1/PrizePoolStateCard';
import { isSupportedNetwork } from '../utils/v1/useNetworkGuard';
import { useWalletStatus } from '../hooks/v1/useWalletStatus';
import GlobalStateStore from '../services/global-state-store';
import type { PendingTransactionSnapshot } from '../types/global-state';

function formatCompactAddress(address: string | null): string {
  if (!address) {
    return 'No wallet connected';
  }
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatPendingTxLabel(pendingTransaction: PendingTransactionSnapshot | null): string {
  if (!pendingTransaction) {
    return 'No pending tx';
  }
  return pendingTransaction.phase.replace(/_/g, ' ');
}

export const GameLobby: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [networkCheckPending, setNetworkCheckPending] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<PendingTransactionSnapshot | null>(null);
  const wallet = useWalletStatus();
  const globalStoreRef = useRef<GlobalStateStore | null>(null);

  if (!globalStoreRef.current) {
    globalStoreRef.current = new GlobalStateStore();
  }

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

  useEffect(() => {
    const store = globalStoreRef.current!;
    setPendingTransaction(store.getState().pendingTransaction ?? null);
    return store.subscribe((state) => {
      setPendingTransaction(state.pendingTransaction ?? null);
    });
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

  const activeGames = useMemo(
    () => games.filter((game) => String(game.status).toLowerCase() === 'active'),
    [games],
  );

  const totalPrizeSignal = useMemo(
    () =>
      activeGames.reduce((sum, game) => {
        const wager = typeof game.wager === 'number' ? game.wager : Number(game.wager ?? 0);
        return Number.isFinite(wager) ? sum + wager : sum;
      }, 0),
    [activeGames],
  );

  const prizePoolState = useMemo(
    () =>
      totalPrizeSignal > 0
        ? {
            balance: totalPrizeSignal.toFixed(2),
            totalReserved: String(activeGames.length),
            admin: '',
          }
        : null,
    [activeGames.length, totalPrizeSignal],
  );

  if (loading) return <div className="lobby-loading" role="status" aria-live="polite">Loading elite games...</div>;
  if (error) return <div className="lobby-error" role="status" aria-live="polite">Failed to load games: {error}</div>;

  return (
    <div className="game-lobby">
      <section aria-label="Wallet and network status" className="lobby-dashboard">
        <div className="lobby-dashboard__col">
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
            lastUpdatedAt={wallet.lastUpdatedAt}
            isRefreshing={wallet.isRefreshing}
          />
        </div>

        <div className="lobby-dashboard__col">
          <div className="lobby-header">
            <h2 id="games-heading">Live Arena</h2>
            <p>Real-time game status across the Stellar ecosystem.</p>
          </div>
          <div className="lobby-kpi-strip" data-testid="lobby-kpi-strip">
            <StatusCard
              id="wallet-kpi"
              name="Wallet"
              status={wallet.status}
              tone={wallet.capabilities.isConnected ? 'success' : 'neutral'}
              hideDefaultAction={true}
              bodySlot={
                <div className="status-card__metric-group">
                  <div className="status-card__metric-value">{wallet.capabilities.isConnected ? 'Connected' : 'Offline'}</div>
                  <div className="status-card__metric-note">
                    {formatCompactAddress(wallet.address)}
                  </div>
                  <div className="status-card__metric-caption">
                    {wallet.lastUpdatedAt
                      ? `Updated ${new Date(wallet.lastUpdatedAt).toLocaleTimeString()}`
                      : 'No recent wallet sync'}
                  </div>
                </div>
              }
            />
            <StatusCard
              id="tx-kpi"
              name="Transactions"
              status={pendingTransaction ? pendingTransaction.phase : 'idle'}
              tone={pendingTransaction ? 'warning' : 'neutral'}
              hideDefaultAction={true}
              bodySlot={
                <div className="status-card__metric-group">
                  <div className="status-card__metric-value">{formatPendingTxLabel(pendingTransaction)}</div>
                  <div className="status-card__metric-note">
                    {pendingTransaction?.txHash
                      ? `${pendingTransaction.txHash.slice(0, 10)}...`
                      : 'No recent transaction hash'}
                  </div>
                  <div className="status-card__metric-caption">
                    {pendingTransaction
                      ? `Started ${new Date(pendingTransaction.startedAt).toLocaleTimeString()}`
                      : 'Waiting for the next wallet action'}
                  </div>
                </div>
              }
            />
            <PrizePoolStateCard
              compact={true}
              state={prizePoolState}
              statusLabel={prizePoolState ? 'Prize pool signal live' : 'Awaiting prize-pool data'}
              footerMeta={activeGames.length > 0 ? `${activeGames.length} live game${activeGames.length === 1 ? '' : 's'}` : null}
              emptyMessage="No prize-pool metrics available yet."
              testId="lobby-prize-pool-kpi"
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="games-heading" className="games-section">
        {games.length === 0 ? (
          <div className="lobby-empty" role="status" aria-live="polite">
            <div className="empty-icon">📭</div>
            <p>No games active at the moment. Check back later!</p>
          </div>
        ) : (
          <div className="games-grid" role="region" aria-label="Active games">
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
      </section>
    </div>
  );
};

export default GameLobby;
