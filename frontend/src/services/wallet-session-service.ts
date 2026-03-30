import {
  WalletSessionHistoryEntry,
  WalletSessionHistoryEventType,
  WalletProviderInfo,
  WalletSessionMeta,
  WalletSessionOptions,
  WalletSessionState,
  ProviderNotFoundError,
  RejectedSignatureError,
  StaleSessionError,
  ValidationError,
  WalletSessionError,
  WalletSessionRefreshPhase,
  WalletSessionRefreshPolicy,
  WalletSessionRefreshState,
  WalletSessionRefreshTrigger,
} from "../types/wallet-session";

type Subscriber = (
  state: WalletSessionState,
  meta?: WalletSessionMeta | null,
  error?: Error | null,
  refreshState?: WalletSessionRefreshState,
  sessionDropped?: boolean,
) => void;

const DEFAULT_KEY = "stc_wallet_session_v1";
const DEFAULT_HISTORY_KEY = "stc_wallet_session_history_v1";
const DEFAULT_EXPIRY = 1000 * 60 * 60 * 24 * 7;
const MAX_HISTORY_ENTRIES = 8;
const DEFAULT_REFRESH_POLICY = {
  maxAttempts: 3,
  initialBackoffMs: 500,
  backoffMultiplier: 2,
} satisfies Required<WalletSessionRefreshPolicy>;

export const WALLET_SESSION_WARN_BEFORE_EXPIRY_MS_DEFAULT = 5 * 60 * 1000;
export const WALLET_SESSION_EXPIRY_POLL_MS_DEFAULT = 15_000;

export interface WalletProviderAdapter {
  isAvailable(): boolean;
  connect(): Promise<{
    address: string;
    provider: WalletProviderInfo;
    network: string;
  }>;
  disconnect?(): Promise<void>;
  signMessage?(message: string): Promise<string>;
}

export class WalletSessionService {
  private storageKey: string;
  private sessionExpiryMs: number;
  private supportedNetworks: string[] | undefined;
  private providerAdapter: WalletProviderAdapter | null = null;
  private state: WalletSessionState = WalletSessionState.DISCONNECTED;
  private meta: WalletSessionMeta | null = null;
  private subscribers: Set<Subscriber> = new Set();
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private refreshState: WalletSessionRefreshState = {
    phase: WalletSessionRefreshPhase.IDLE,
    trigger: "silent",
    attempt: 0,
    maxAttempts: 1,
    terminal: false,
  };
  /** True when a previously-established session was lost unexpectedly. */
  private sessionDropped = false;

  constructor(opts?: WalletSessionOptions) {
    this.storageKey = opts?.storageKey ?? DEFAULT_KEY;
    this.sessionExpiryMs = opts?.sessionExpiryMs ?? DEFAULT_EXPIRY;
    this.supportedNetworks = opts?.supportedNetworks as string[] | undefined;
    this.now = opts?.now ?? (() => Date.now());
    this.sleep =
      opts?.sleep ??
      ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

    try {
      const restored = this.restore();
      if (restored) {
        this.meta = restored;
      }
    } catch {
      // restore sanitizes storage on failure
    }
  }

  public setProviderAdapter(adapter: WalletProviderAdapter) {
    this.providerAdapter = adapter;
  }

  public subscribe(fn: Subscriber) {
    this.subscribers.add(fn);
    fn(this.state, this.meta, null, this.getRefreshState());
    return () => {
      this.subscribers.delete(fn);
    };
  }

  private notify(error: Error | null = null) {
    const refreshSnapshot = this.getRefreshState();
    for (const subscriber of this.subscribers) {
      try {
        subscriber(this.state, this.meta, error, refreshSnapshot, this.sessionDropped);
      } catch (e) {
        console.error("Subscriber error", e);
      }
    }
  }

  /** Returns true when a previously-established session was lost unexpectedly. */
  public getSessionDropped(): boolean {
    return this.sessionDropped;
  }

  public static getRecentSessionHistory(
    storageKey = DEFAULT_HISTORY_KEY,
  ): WalletSessionHistoryEntry[] {
    return readHistory(storageKey);
  }

  private persist(meta: WalletSessionMeta | null) {
    if (!meta) {
      localStorage.removeItem(this.storageKey);
      return;
    }

    localStorage.setItem(
      this.storageKey,
      JSON.stringify({
        meta,
        storedAt: this.now(),
      }),
    );
  }

  private restore(): WalletSessionMeta | null {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as {
        meta: WalletSessionMeta;
        storedAt: number;
      };
      if (typeof parsed?.storedAt !== "number" || !parsed?.meta) {
        throw new Error("invalid");
      }
      if (this.now() - parsed.storedAt > this.sessionExpiryMs) {
        this.recordHistory("expired", parsed.meta);
        this.persist(null);
        throw new StaleSessionError();
      }
      if (
        this.supportedNetworks &&
        !this.supportedNetworks.includes(parsed.meta.network)
      ) {
        this.recordHistory("expired", parsed.meta);
        this.persist(null);
        throw new StaleSessionError();
      }
      return parsed.meta;
    } catch {
      localStorage.removeItem(this.storageKey);
      return null;
    }
  }

  public async connect(options?: { network?: string }): Promise<WalletSessionMeta> {
    if (!this.providerAdapter || !this.providerAdapter.isAvailable()) {
      throw new ProviderNotFoundError();
    }

    this.state = WalletSessionState.CONNECTING;
    this.refreshState = this.createIdleRefreshState();
    this.notify();

    if (
      options?.network &&
      this.supportedNetworks &&
      !this.supportedNetworks.includes(options.network)
    ) {
      this.state = WalletSessionState.DISCONNECTED;
      const err = new ValidationError("Network not supported");
      this.notify(err);
      throw err;
    }

    try {
      const result = await this.providerAdapter.connect();
      if (!result || !result.address) throw new Error("connect_no_address");

      const meta: WalletSessionMeta = {
        provider: result.provider,
        address: result.address,
        network: options?.network ?? result.network ?? "UNKNOWN",
        connectedAt: this.now(),
        lastActiveAt: this.now(),
      };

      this.meta = meta;
      this.state = WalletSessionState.CONNECTED;
      this.sessionDropped = false;
      this.persist(meta);
      this.recordHistory("connected", meta);
      this.notify();
      return meta;
    } catch (error) {
      this.state = WalletSessionState.DISCONNECTED;
      const mapped = this.mapError(error as Error);
      this.notify(mapped);
      throw mapped;
    }
  }

  public async disconnect(): Promise<void> {
    const activeMeta = this.meta;
    this.state = WalletSessionState.DISCONNECTED;
    // User-initiated disconnect — clear any dropped-session signal
    this.sessionDropped = false;
    try {
      if (this.providerAdapter?.disconnect) {
        await this.providerAdapter.disconnect();
      }
    } catch (error) {
      const mapped = this.mapError(error as Error);
      this.persist(null);
      this.meta = null;
      this.notify(mapped);
      return;
    }

    this.persist(null);
    this.meta = null;
    if (activeMeta) {
      this.recordHistory("disconnected", activeMeta);
    }
    this.notify();
  }

  public async reconnect(): Promise<WalletSessionMeta> {
    return this.runRefresh("manual", { maxAttempts: 1 });
  }

  public async silentRefresh(
    policy?: WalletSessionRefreshPolicy,
  ): Promise<WalletSessionMeta> {
    return this.runRefresh("silent", policy);
  }

  public getState() {
    return this.state;
  }

  public getMeta(): WalletSessionMeta | null {
    return this.meta;
  }

  public getRefreshState(): WalletSessionRefreshState {
    return { ...this.refreshState };
  }

  public getRemainingPersistenceMs(): number | null {
    const expiresAt = this.getSessionExpiryTimestampMs();
    if (expiresAt === null) return null;
    return Math.max(0, expiresAt - this.now());
  }

  public getSessionExpiryTimestampMs(): number | null {
    if (this.state !== WalletSessionState.CONNECTED || !this.meta) {
      return null;
    }

    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { storedAt?: number };
      if (typeof parsed.storedAt !== "number") return null;
      return parsed.storedAt + this.sessionExpiryMs;
    } catch {
      return null;
    }
  }

  public extendPersistedSession(): void {
    if (!this.meta) return;
    this.persist(this.meta);
    this.notify();
  }

  private createIdleRefreshState(
    patch: Partial<WalletSessionRefreshState> = {},
  ): WalletSessionRefreshState {
    return {
      phase: WalletSessionRefreshPhase.IDLE,
      trigger: patch.trigger ?? this.refreshState.trigger ?? "silent",
      attempt: patch.attempt ?? 0,
      maxAttempts: patch.maxAttempts ?? this.refreshState.maxAttempts ?? 1,
      terminal: patch.terminal ?? false,
      startedAt: patch.startedAt ?? this.refreshState.startedAt,
      nextRetryAt: patch.nextRetryAt,
      backoffMs: patch.backoffMs,
      lastSucceededAt: patch.lastSucceededAt ?? this.refreshState.lastSucceededAt,
      lastFailedAt: patch.lastFailedAt ?? this.refreshState.lastFailedAt,
      errorCode: patch.errorCode,
    };
  }

  private computeBackoffMs(policy: Required<WalletSessionRefreshPolicy>, attempt: number) {
    const exponent = Math.max(0, attempt - 1);
    return Math.round(
      policy.initialBackoffMs * Math.pow(policy.backoffMultiplier, exponent),
    );
  }

  private isRetryableRefreshError(error: Error): boolean {
    if (error instanceof ProviderNotFoundError) return false;
    if (error instanceof RejectedSignatureError) return false;
    if (error instanceof StaleSessionError) return false;
    if (error instanceof ValidationError) return false;
    return true;
  }

  private async runRefresh(
    trigger: WalletSessionRefreshTrigger,
    policy?: WalletSessionRefreshPolicy,
  ): Promise<WalletSessionMeta> {
    if (!this.providerAdapter) throw new ProviderNotFoundError();

    const stored = this.restore();
    if (!stored) {
      const error = new StaleSessionError();
      this.refreshState = {
        phase: WalletSessionRefreshPhase.FAILED,
        trigger,
        attempt: 0,
        maxAttempts: 1,
        terminal: true,
        lastFailedAt: this.now(),
        errorCode: error.code,
      };
      throw error;
    }

    const mergedPolicy: Required<WalletSessionRefreshPolicy> = {
      ...DEFAULT_REFRESH_POLICY,
      ...policy,
    };
    const startedAt = this.now();
    let attempt = 0;

    this.state = WalletSessionState.RECONNECTING;

    while (attempt < mergedPolicy.maxAttempts) {
      attempt += 1;
      this.refreshState = {
        phase: WalletSessionRefreshPhase.REFRESHING,
        trigger,
        attempt,
        maxAttempts: mergedPolicy.maxAttempts,
        startedAt,
        terminal: false,
        lastSucceededAt: this.refreshState.lastSucceededAt,
      };
      this.notify();

      try {
        if (this.providerAdapter.signMessage) {
          const challenge = `stc_reconnect:${stored.address}:${Math.random()
            .toString(36)
            .slice(2)}`;
          await this.providerAdapter.signMessage(challenge);
        }

        const meta = { ...stored, lastActiveAt: this.now() };
        this.meta = meta;
        this.state = WalletSessionState.CONNECTED;
        this.sessionDropped = false;
        this.persist(meta);
        this.recordHistory("reconnected", meta);
        this.refreshState = this.createIdleRefreshState({
          trigger,
          attempt,
          maxAttempts: mergedPolicy.maxAttempts,
          startedAt,
          lastSucceededAt: this.now(),
        });
        this.notify();
        return meta;
      } catch (error) {
        const mapped = this.mapError(error as Error);
        const retryable =
          this.isRetryableRefreshError(mapped) && attempt < mergedPolicy.maxAttempts;

        if (retryable) {
          const backoffMs = this.computeBackoffMs(mergedPolicy, attempt);
          this.refreshState = {
            phase: WalletSessionRefreshPhase.BACKING_OFF,
            trigger,
            attempt,
            maxAttempts: mergedPolicy.maxAttempts,
            startedAt,
            nextRetryAt: this.now() + backoffMs,
            backoffMs,
            terminal: false,
            errorCode: mapped instanceof WalletSessionError ? mapped.code : undefined,
          };
          this.notify(mapped);
          await this.sleep(backoffMs);
          continue;
        }

        this.state = WalletSessionState.DISCONNECTED;
        this.sessionDropped = true;
        this.refreshState = {
          phase: WalletSessionRefreshPhase.FAILED,
          trigger,
          attempt,
          maxAttempts: mergedPolicy.maxAttempts,
          startedAt,
          lastFailedAt: this.now(),
          terminal: true,
          errorCode: mapped instanceof WalletSessionError ? mapped.code : undefined,
        };
        this.notify(mapped);
        throw mapped;
      }
    }

    const exhausted = new WalletSessionError(
      "refresh_retries_exhausted",
      "Wallet session refresh retries exhausted",
    );
    this.state = WalletSessionState.DISCONNECTED;
    this.sessionDropped = true;
    this.refreshState = {
      phase: WalletSessionRefreshPhase.FAILED,
      trigger,
      attempt: mergedPolicy.maxAttempts,
      maxAttempts: mergedPolicy.maxAttempts,
      startedAt,
      lastFailedAt: this.now(),
      terminal: true,
      errorCode: exhausted.code,
    };
    this.notify(exhausted);
    throw exhausted;
  }

  private mapError(error: Error): Error {
    if (!error) return new WalletSessionError("unknown_error", "Unknown error");
    const message = (error as any).message ?? "";
    if (message.includes("User rejected") || message.includes("rejected")) {
      return new RejectedSignatureError();
    }
    if (message.includes("provider") || message.includes("not found")) {
      return new ProviderNotFoundError();
    }
    if (error instanceof WalletSessionError) return error;
    return new WalletSessionError("unknown_error", message);
  }

  private recordHistory(
    type: WalletSessionHistoryEventType,
    meta: WalletSessionMeta,
  ): void {
    appendHistoryEntry(
      {
        id: `${this.now()}-${type}-${meta.provider.id}-${meta.address.slice(-4)}`,
        type,
        occurredAt: this.now(),
        network: meta.network,
        providerName: meta.provider.name,
        addressPreview: formatAddressPreview(meta.address),
      },
      DEFAULT_HISTORY_KEY,
    );
  }
}

function formatAddressPreview(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function readHistory(storageKey: string): WalletSessionHistoryEntry[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WalletSessionHistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry) =>
        typeof entry?.id === "string" &&
        typeof entry?.type === "string" &&
        typeof entry?.occurredAt === "number" &&
        typeof entry?.providerName === "string" &&
        typeof entry?.addressPreview === "string" &&
        typeof entry?.network === "string",
    );
  } catch {
    localStorage.removeItem(storageKey);
    return [];
  }
}

function appendHistoryEntry(
  entry: WalletSessionHistoryEntry,
  storageKey: string,
): void {
  const nextHistory = [entry, ...readHistory(storageKey)].slice(
    0,
    MAX_HISTORY_ENTRIES,
  );
  localStorage.setItem(storageKey, JSON.stringify(nextHistory));
}

export default WalletSessionService;
