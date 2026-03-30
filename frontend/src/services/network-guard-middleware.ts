import {
  assertSupportedNetwork,
  normalizeNetworkIdentity,
  type AssertNetworkResult,
} from "../utils/v1/useNetworkGuard";
import type {
  ContractAddressRegistry,
  NetworkGuardInput,
  NetworkGuardResult,
  NetworkIdentity,
  NetworkProviderLike,
  ProviderNetworkSnapshot,
} from "../types/network-guard-middleware";
import { NetworkGuardError } from "../types/network-guard-middleware";
import { dispatchApiTrace } from "../types/api-trace";

const inFlightOperations = new Set<string>();

interface QueuedAction {
  operation: () => Promise<unknown>;
  input: NetworkGuardInput;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}

let queuedActions: QueuedAction[] = [];

function normalizeSupportedNetworks(input?: readonly string[]): readonly string[] {
  const source = input ?? ["TESTNET", "PUBLIC"];
  const normalized = source
    .filter((v): v is string => typeof v === "string")
    .map((v) => normalizeNetworkIdentity(v))
    .filter((v) => v !== "UNKNOWN");
  return Array.from(new Set(normalized));
}

function validateContractAddresses(registry?: ContractAddressRegistry): void {
  if (!registry) {
    return;
  }

  const invalid = Object.entries(registry).find(
    ([, value]) => typeof value !== "string" || value.trim().length === 0,
  );

  if (invalid) {
    throw new NetworkGuardError(
      "CONTRACT_ADDRESS_MISSING",
      `Missing contract address for ${invalid[0]}.`,
      "Load a valid contract address registry before sending transactions.",
      { terminal: true, retryable: false },
    );
  }
}

async function readProviderNetwork(provider: NetworkProviderLike | null | undefined): Promise<NetworkIdentity> {
  if (!provider) {
    throw new NetworkGuardError(
      "PROVIDER_UNAVAILABLE",
      "Network provider is not available.",
      "Connect a wallet provider before executing protected operations.",
      { terminal: true, retryable: true },
    );
  }

  let snapshot: ProviderNetworkSnapshot | string | null | undefined;

  if (typeof provider.getNetwork === "function") {
    snapshot = await provider.getNetwork();
  } else if (provider.network || provider.networkPassphrase) {
    snapshot = {
      network: provider.network ?? null,
      networkPassphrase: provider.networkPassphrase ?? null,
    };
  } else {
    snapshot = null;
  }

  if (typeof snapshot === "string") {
    const normalized = normalizeNetworkIdentity(snapshot);
    return { raw: snapshot, normalized };
  }

  const raw = snapshot?.network ?? snapshot?.networkPassphrase ?? null;
  const normalized = normalizeNetworkIdentity(raw);
  return { raw, normalized };
}

function throwFromSupportResult(result: AssertNetworkResult): never {
  const code = result.error?.code ?? "NETWORK_UNSUPPORTED";
  if (code === "NETWORK_MISSING") {
    throw new NetworkGuardError(
      "NETWORK_MISSING",
      "Active wallet network is missing.",
      "Reconnect wallet and ensure network details are available.",
      { terminal: false, retryable: true },
    );
  }

  throw new NetworkGuardError(
    "NETWORK_UNSUPPORTED",
    `Unsupported network: ${result.normalizedActual}.`,
    `Switch wallet network to one of: ${result.supportedNetworks.join(", ")}.`,
    { terminal: true, retryable: false },
  );
}

function enforceExpectedNetwork(actual: string, expected?: string | null): void {
  if (!expected) {
    return;
  }

  const normalizedExpected = normalizeNetworkIdentity(expected);
  if (actual !== normalizedExpected) {
    throw new NetworkGuardError(
      "NETWORK_MISMATCH",
      `Expected ${normalizedExpected} but wallet is ${actual}.`,
      `Switch wallet network to ${normalizedExpected} and retry.`,
      { terminal: true, retryable: false },
    );
  }
}

function assertOperationNotDuplicated(input: NetworkGuardInput): string | null {
  const operationKey = input.operationKey ?? null;
  if (!operationKey || input.allowDuplicateOperation) {
    return null;
  }

  if (inFlightOperations.has(operationKey)) {
    throw new NetworkGuardError(
      "DUPLICATE_OPERATION",
      `Operation is already in progress: ${operationKey}`,
      "Wait for the active operation to complete before retrying.",
      { terminal: false, retryable: true },
    );
  }

  inFlightOperations.add(operationKey);
  return operationKey;
}

export async function assertSupportedNetworkBeforeOperation(
  input: NetworkGuardInput,
): Promise<NetworkGuardResult> {
  if (!input || typeof input !== "object") {
    throw new NetworkGuardError(
      "INVALID_ARGUMENT",
      "Network guard input is invalid.",
      "Provide a valid guard input object.",
      { terminal: true, retryable: false },
    );
  }

  if (!input.walletConnected) {
    throw new NetworkGuardError(
      "WALLET_NOT_CONNECTED",
      "Wallet is not connected.",
      "Connect a wallet before trying this operation.",
      { terminal: false, retryable: true },
    );
  }

  validateContractAddresses(input.contractAddresses);

  const network = await readProviderNetwork(input.provider);

  const supportedNetworks = normalizeSupportedNetworks(
    input.supportedNetworks as readonly string[] | undefined,
  );

  const support = assertSupportedNetwork(network.raw, {
    supportedNetworks,
  });
  if (!support.ok) {
    throwFromSupportResult(support);
  }

  enforceExpectedNetwork(network.normalized, input.expectedNetwork ?? null);

  return {
    ok: true,
    network,
    supportedNetworks,
  };
}

export async function withNetworkGuard<T>(
  input: NetworkGuardInput,
  operation: () => Promise<T>,
): Promise<T> {
  const lock = assertOperationNotDuplicated(input);
  const traceId = `guard-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const startTime = Date.now();

  dispatchApiTrace({
    traceId,
    source: "NetworkGuard",
    method: "GuardOperation",
    url: lock ? `operation:${lock}` : "operation:anonymous",
    startTime,
    endTime: null,
    durationMs: null,
    status: "pending",
  });

  try {
    await assertSupportedNetworkBeforeOperation(input);
    const result = await operation();
    
    dispatchApiTrace({
      traceId,
      source: "NetworkGuard",
      method: "GuardOperation",
      url: lock ? `operation:${lock}` : "operation:anonymous",
      startTime,
      endTime: Date.now(),
      durationMs: Date.now() - startTime,
      status: "success",
    });

    return result;
  } catch (err) {
    const isQueueableError =
      err instanceof NetworkGuardError &&
      (err.code === "NETWORK_UNSUPPORTED" ||
        err.code === "NETWORK_MISMATCH" ||
        err.code === "NETWORK_MISSING");

    if (isQueueableError && input.isIdempotent && input.resumeOnNetworkRecovery) {
      dispatchApiTrace({
        traceId,
        source: "NetworkGuard",
        method: "GuardOperation",
        url: lock ? `operation:${lock}` : "operation:anonymous",
        startTime,
        endTime: Date.now(),
        durationMs: Date.now() - startTime,
        status: "cancelled", // Considered cancelled/queued
        errorData: new Error("Queued waiting for network changes"),
      });

      return new Promise<T>((resolve, reject) => {
        queuedActions.push({
          operation,
          input,
          resolve: resolve as (v: unknown) => void,
          reject,
        });
      });
    }

    dispatchApiTrace({
      traceId,
      source: "NetworkGuard",
      method: "GuardOperation",
      url: lock ? `operation:${lock}` : "operation:anonymous",
      startTime,
      endTime: Date.now(),
      durationMs: Date.now() - startTime,
      status: "error",
      errorData: err,
    });

    throw err;
  } finally {
    if (lock) {
      inFlightOperations.delete(lock);
    }
  }
}

export function getQueuedNetworkActionsCount(): number {
  return queuedActions.length;
}

export async function resumeQueuedNetworkActions(): Promise<void> {
  const actions = [...queuedActions];
  queuedActions = [];

  for (const action of actions) {
    try {
      const result = await withNetworkGuard(action.input, action.operation);
      action.resolve(result);
    } catch (err) {
      action.reject(err);
    }
  }
}

export function clearNetworkGuardOperationLocks(): void {
  inFlightOperations.clear();
}

// ── Offline detection and queued refresh (#480) ────────────────────────────────

type ConnectivityListener = (online: boolean) => void;

const connectivityListeners = new Set<ConnectivityListener>();
let pendingRefreshCount = 0;
let refreshStormGuard = false;

/**
 * Returns true when the browser reports offline status.
 * Falls back to true (online) when navigator.onLine is unavailable.
 */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
    ? !navigator.onLine
    : false;
}

/**
 * Subscribe to connectivity changes. Returns an unsubscribe function.
 * Listener receives `true` when online, `false` when offline.
 */
export function onConnectivityChange(listener: ConnectivityListener): () => void {
  connectivityListeners.add(listener);

  const handleOnline = () => {
    for (const fn of connectivityListeners) fn(true);
  };
  const handleOffline = () => {
    for (const fn of connectivityListeners) fn(false);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  return () => {
    connectivityListeners.delete(listener);
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  };
}

/**
 * Enqueue a refresh to execute once connectivity returns.
 * Returns the current count of pending refreshes.
 * Prevents duplicate refresh storms via debounce.
 */
export function enqueueRefreshOnReconnect(refreshFn: () => Promise<void>): number {
  pendingRefreshCount++;
  const currentCount = pendingRefreshCount;

  const unsubscribe = onConnectivityChange(async (online) => {
    if (!online) return;
    unsubscribe();

    // Storm guard: batch-execute with a small delay to prevent duplicates
    if (refreshStormGuard) return;
    refreshStormGuard = true;

    try {
      await refreshFn();
    } catch (err) {
      console.error('[NetworkGuard] Queued refresh failed:', err);
    } finally {
      pendingRefreshCount = Math.max(0, pendingRefreshCount - 1);
      // Release storm guard after a short cooldown
      setTimeout(() => {
        refreshStormGuard = false;
      }, 500);
    }
  });

  return currentCount;
}

/**
 * Returns the number of queued refresh operations waiting for reconnection.
 */
export function getPendingRefreshCount(): number {
  return pendingRefreshCount;
}

/**
 * Reset pending refresh count (for testing or cleanup).
 */
export function resetPendingRefreshCount(): void {
  pendingRefreshCount = 0;
  refreshStormGuard = false;
}
