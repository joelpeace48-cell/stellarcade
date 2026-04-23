import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ApiClient } from "../services/typed-api-sdk";
import { Game } from "../types/api-client";
import StatusCard from "../components/v1/StatusCard";
import NetworkGuardBanner from "../components/v1/NetworkGuardBanner";
import WalletStatusCard from "../components/v1/WalletStatusCard";
import PrizePoolStateCard from "../components/v1/PrizePoolStateCard";
import { DataTable, type DataTableColumn } from "../components/v1/DataTable";
import { SkeletonPreset } from "../components/v1/LoadingSkeletonSet";
import TransactionDetailDrawer from "../components/v1/TransactionDetailDrawer";
import { isSupportedNetwork } from "../utils/v1/useNetworkGuard";
import { useWalletStatus } from "../hooks/v1/useWalletStatus";
import GlobalStateStore, {
  ONBOARDING_CHECKLIST_DISMISSED_FLAG,
  getTableDensityPreference,
  persistTableDensityPreference,
  type TableDensityPreference,
} from "../services/global-state-store";
import type { PendingTransactionSnapshot } from "../types/global-state";

// ─── Onboarding Checklist ────────────────────────────────────────────────────

const CHECKLIST_ITEMS = [
  { id: "connect-wallet", label: "Connect your Stellar wallet" },
  { id: "browse-games", label: "Browse available games" },
  { id: "place-wager", label: "Place your first wager" },
] as const;

const DASHBOARD_DENSITY_SCOPE = "dashboard-surfaces";

interface LeaderboardRow {
  rank: number;
  id: string;
  name: string;
  status: string;
  wager: number;
}

interface FirstTimeChecklistProps {
  onDismiss: () => void;
}

const FirstTimeChecklist: React.FC<FirstTimeChecklistProps> = ({
  onDismiss,
}) => {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = useCallback((id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  return (
    <aside
      className="onboarding-checklist"
      aria-label="Getting started checklist"
      data-testid="onboarding-checklist"
    >
      <div className="onboarding-checklist__header">
        <h3 className="onboarding-checklist__title">Get Started</h3>
        <button
          type="button"
          className="onboarding-checklist__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss checklist"
          data-testid="onboarding-checklist-dismiss"
        >
          ×
        </button>
      </div>
      <ul className="onboarding-checklist__list">
        {CHECKLIST_ITEMS.map((item) => (
          <li key={item.id} className="onboarding-checklist__item">
            <label className="onboarding-checklist__label">
              <input
                type="checkbox"
                className="onboarding-checklist__checkbox"
                checked={!!checked[item.id]}
                onChange={() => toggle(item.id)}
                data-testid={`checklist-item-${item.id}`}
              />
              <span
                className={
                  checked[item.id] ? "onboarding-checklist__text--done" : ""
                }
              >
                {item.label}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </aside>
  );
};

function formatCompactAddress(address: string | null): string {
  if (!address) {
    return "No wallet connected";
  }
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatPendingTxLabel(
  pendingTransaction: PendingTransactionSnapshot | null,
): string {
  if (!pendingTransaction) {
    return "No pending tx";
  }
  return pendingTransaction.phase.replace(/_/g, " ");
}

export const GameLobby: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [networkCheckPending, setNetworkCheckPending] = useState(false);
  const [pendingTransaction, setPendingTransaction] =
    useState<PendingTransactionSnapshot | null>(null);
  const [isTransactionDrawerOpen, setIsTransactionDrawerOpen] = useState(false);
  const [tableDensity, setTableDensity] = useState<TableDensityPreference>(() =>
    getTableDensityPreference(DASHBOARD_DENSITY_SCOPE),
  );
  const wallet = useWalletStatus();
  const globalStoreRef = useRef<GlobalStateStore | null>(null);

  if (!globalStoreRef.current) {
    globalStoreRef.current = new GlobalStateStore();
  }

  const [checklistDismissed, setChecklistDismissed] = useState<boolean>(
    () =>
      !!globalStoreRef.current?.selectFlag(ONBOARDING_CHECKLIST_DISMISSED_FLAG),
  );

  const handleDismissChecklist = useCallback(() => {
    globalStoreRef.current?.dispatch({
      type: "FLAGS_SET",
      payload: { key: ONBOARDING_CHECKLIST_DISMISSED_FLAG, value: true },
    });
    setChecklistDismissed(true);
  }, []);

  const networkSupport = useMemo(
    () =>
      isSupportedNetwork(wallet.network, {
        supportedNetworks: ["TESTNET", "PUBLIC"],
      }),
    [wallet.network],
  );

  const networkMismatch =
    wallet.capabilities.isConnected && !networkSupport.isSupported;
  const walletDiagnostics = useMemo(
    () => [
      {
        label: "Provider",
        value: wallet.provider?.name ?? "Unavailable",
        tone: wallet.provider ? ("success" as const) : ("warning" as const),
      },
      {
        label: "Network supported",
        value: networkSupport.isSupported,
        tone: networkSupport.isSupported
          ? ("success" as const)
          : ("error" as const),
      },
      {
        label: "Normalized network",
        value: networkSupport.normalizedActual ?? "Unknown",
      },
      {
        label: "Recovery pending",
        value: networkCheckPending,
        tone: networkCheckPending ? ("warning" as const) : ("neutral" as const),
      },
      {
        label: "Last wallet sync",
        value: wallet.lastUpdatedAt
          ? new Date(wallet.lastUpdatedAt).toLocaleTimeString()
          : "Not synced",
      },
    ],
    [
      networkCheckPending,
      networkSupport.isSupported,
      networkSupport.normalizedActual,
      wallet.lastUpdatedAt,
      wallet.provider,
    ],
  );

  const fetchGames = useCallback(async () => {
    const client = new ApiClient();
    const result = await client.getGames();

    if (result.success) {
      setGames(result.data);
      setError(null);
      return true;
    }

    setError(result.error.message);
    return false;
  }, []);

  useEffect(() => {
    const run = async () => {
      await fetchGames();
      setLoading(false);
    };
    run();
  }, [fetchGames]);

  const handleRetryLoadGames = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await fetchGames();
    } finally {
      setRetrying(false);
    }
  }, [fetchGames, retrying]);

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
    () =>
      games.filter((game) => String(game.status).toLowerCase() === "active"),
    [games],
  );

  const leaderboardRows = useMemo<LeaderboardRow[]>(
    () =>
      [...activeGames]
        .sort((left, right) => {
          const leftWager =
            typeof left.wager === "number"
              ? left.wager
              : Number(left.wager ?? 0);
          const rightWager =
            typeof right.wager === "number"
              ? right.wager
              : Number(right.wager ?? 0);
          return rightWager - leftWager;
        })
        .map((game, index) => ({
          rank: index + 1,
          id: game.id,
          name: game.name,
          status: String(game.status ?? "unknown"),
          wager:
            typeof game.wager === "number"
              ? game.wager
              : Number(game.wager ?? 0),
        })),
    [activeGames],
  );

  const leaderboardColumns = useMemo<DataTableColumn<LeaderboardRow>[]>(
    () => [
      { key: "rank", header: "Rank", sortable: true, width: "5rem" },
      { key: "name", header: "Game", sortable: true },
      { key: "status", header: "Status", sortable: true, width: "8rem" },
      {
        key: "wager",
        header: "Wager",
        sortable: true,
        width: "8rem",
        render: (row) => `${row.wager.toFixed(0)} XLM`,
        sortAccessor: (row) => row.wager,
      },
    ],
    [],
  );

  const totalPrizeSignal = useMemo(
    () =>
      activeGames.reduce((sum, game) => {
        const wager =
          typeof game.wager === "number" ? game.wager : Number(game.wager ?? 0);
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
            admin: "",
          }
        : null,
    [activeGames.length, totalPrizeSignal],
  );

  const handleDensityChange = useCallback((density: TableDensityPreference) => {
    setTableDensity(density);
    persistTableDensityPreference(DASHBOARD_DENSITY_SCOPE, density);
  }, []);

  if (loading) {
    return (
      <div className="lobby-loading" role="status" aria-live="polite">
        <p>Loading elite games...</p>
        <SkeletonPreset type="detail" />
      </div>
    );
  }
  if (error)
    return (
      <div className="lobby-error" role="status" aria-live="polite">
        <p>Failed to load games: {error}</p>
        <div style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleRetryLoadGames}
            disabled={retrying}
            data-testid="lobby-error-retry"
          >
            {retrying ? "Retrying..." : "Retry"}
          </button>
        </div>
      </div>
    );

  return (
    <div className="game-lobby">
      <section
        aria-label="Wallet and network status"
        className="lobby-dashboard"
      >
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
            diagnostics={walletDiagnostics}
          />
        </div>

        <div className="lobby-dashboard__col">
          <div className="lobby-header">
            <h1 id="games-heading">Live Arena</h1>
            <p>Real-time game status across the Stellar ecosystem.</p>
          </div>
          <div className="lobby-kpi-strip" data-testid="lobby-kpi-strip">
            <StatusCard
              id="wallet-kpi"
              name="Wallet"
              status={wallet.status}
              tone={wallet.capabilities.isConnected ? "success" : "neutral"}
              hideDefaultAction={true}
              bodySlot={
                <div className="status-card__metric-group">
                  <div className="status-card__metric-value">
                    {wallet.capabilities.isConnected ? "Connected" : "Offline"}
                  </div>
                  <div className="status-card__metric-note">
                    {formatCompactAddress(wallet.address)}
                  </div>
                  <div className="status-card__metric-caption">
                    {wallet.lastUpdatedAt
                      ? `Updated ${new Date(wallet.lastUpdatedAt).toLocaleTimeString()}`
                      : "No recent wallet sync"}
                  </div>
                </div>
              }
            />
            <StatusCard
              id="tx-kpi"
              name="Transactions"
              status={pendingTransaction ? pendingTransaction.phase : "idle"}
              tone={pendingTransaction ? "warning" : "neutral"}
              hideDefaultAction={true}
              footerSlot={
                <button
                  type="button"
                  className="btn-play"
                  onClick={() => setIsTransactionDrawerOpen(true)}
                  disabled={!pendingTransaction}
                  aria-label={
                    pendingTransaction
                      ? "Open transaction details"
                      : "Transaction details unavailable"
                  }
                  data-testid="transaction-detail-trigger"
                >
                  {pendingTransaction ? "Inspect tx" : "Awaiting tx"}
                </button>
              }
              bodySlot={
                <div className="status-card__metric-group">
                  <div className="status-card__metric-value">
                    {formatPendingTxLabel(pendingTransaction)}
                  </div>
                  <div className="status-card__metric-note">
                    {pendingTransaction?.txHash
                      ? `${pendingTransaction.txHash.slice(0, 10)}...`
                      : "No recent transaction hash"}
                  </div>
                  <div className="status-card__metric-caption">
                    {pendingTransaction
                      ? `Started ${new Date(pendingTransaction.startedAt).toLocaleTimeString()}`
                      : "Waiting for the next wallet action"}
                  </div>
                </div>
              }
            />
            <PrizePoolStateCard
              compact={true}
              state={prizePoolState}
              statusLabel={
                prizePoolState
                  ? "Prize pool signal live"
                  : "Awaiting prize-pool data"
              }
              footerMeta={
                activeGames.length > 0
                  ? `${activeGames.length} live game${activeGames.length === 1 ? "" : "s"}`
                  : null
              }
              emptyMessage="No prize-pool metrics available yet."
              testId="lobby-prize-pool-kpi"
            />
          </div>
        </div>
      </section>

      {!checklistDismissed && (
        <FirstTimeChecklist onDismiss={handleDismissChecklist} />
      )}

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

      <section
        aria-labelledby="leaderboard-heading"
        className="leaderboard-section"
      >
        <div className="dashboard-section-heading">
          <div>
            <h2 id="leaderboard-heading">Active Games Leaderboard</h2>
            <p>
              Switch between standard and compact density to scan live tables
              faster.
            </p>
          </div>
          <div
            className="density-toggle"
            role="group"
            aria-label="Table density"
          >
            <button
              type="button"
              className={`density-toggle__button ${tableDensity === "standard" ? "is-active" : ""}`.trim()}
              onClick={() => handleDensityChange("standard")}
              aria-pressed={tableDensity === "standard"}
              data-testid="leaderboard-density-standard"
            >
              Standard
            </button>
            <button
              type="button"
              className={`density-toggle__button ${tableDensity === "compact" ? "is-active" : ""}`.trim()}
              onClick={() => handleDensityChange("compact")}
              aria-pressed={tableDensity === "compact"}
              data-testid="leaderboard-density-compact"
            >
              Compact
            </button>
          </div>
        </div>

        <DataTable
          columns={leaderboardColumns}
          data={leaderboardRows}
          pageSize={5}
          density={tableDensity}
          emptyMessage="No leaderboard data available yet."
          testId="leaderboard-table"
        />
      </section>

      <TransactionDetailDrawer
        open={isTransactionDrawerOpen}
        onClose={() => setIsTransactionDrawerOpen(false)}
        pendingTransaction={pendingTransaction}
        network={wallet.network}
      />
    </div>
  );
};

export default GameLobby;
