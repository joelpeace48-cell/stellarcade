export type QueryNamespace = "balances" | "games" | "rewards" | "profile";

export type QueryKey = readonly [QueryNamespace, string, ...Array<string | number | boolean | null>];

export interface QueryPolicy {
  staleTimeMs: number;
  /** If true, invalidation triggers a background refetch when a fetcher is registered. */
  refetchOnInvalidate: boolean;
}

export type CacheEntryState = "fresh" | "stale" | "refreshing" | "invalid";

export interface CacheStaleWhileRevalidateMeta {
  state: CacheEntryState;
  isStale: boolean;
  isRefreshing: boolean;
  lastInvalidatedAt?: number;
  refreshStartedAt?: number;
  refreshCompletedAt?: number;
}

export interface CacheEntryMeta {
  createdAt: number;
  updatedAt: number;
  staleAt: number;
  invalidatedAt?: number;
  swr: CacheStaleWhileRevalidateMeta;
}

export interface CacheEntry<T> {
  key: QueryKey;
  data: T;
  meta: CacheEntryMeta;
  policy: QueryPolicy;
}

export type CacheInvalidationReason =
  | "manual"
  | "tx_success"
  | "tx_failed_retryable"
  | "tx_failed_terminal"
  | "mutation_success"
  | "mutation_failed_retryable"
  | "mutation_failed_terminal"
  | "consistency_check";

export interface CacheInvalidationEventBase {
  at: number;
  reason: CacheInvalidationReason;
}

export interface ContractTxContext {
  contract: string;
  method: string;
  txHash?: string;
  /** Wallet addresses that might have been affected by this operation. */
  addresses?: string[];
  gameId?: string | number | bigint;
}

export interface CacheInvalidationEvent extends CacheInvalidationEventBase {
  contractTx?: ContractTxContext;
  mutation?: {
    name: string;
    addresses?: string[];
  };
}

export interface QueryCacheSnapshot {
  keys: QueryKey[];
  size: number;
  entries: Array<{
    key: QueryKey;
    state: CacheEntryState;
    staleAt: number;
    invalidatedAt?: number;
    refreshStartedAt?: number;
    refreshCompletedAt?: number;
  }>;
}
