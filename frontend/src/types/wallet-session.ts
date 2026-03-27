/*
 * Typed contracts for Wallet Session Service
 */

export type Network = "TESTNET" | "PUBLIC" | string;

export interface WalletProviderInfo {
  id: string;
  name: string;
  version?: string;
}

export interface WalletSessionMeta {
  provider: WalletProviderInfo;
  address: string;
  network: Network;
  connectedAt: number;
  lastActiveAt?: number;
}

export enum WalletSessionState {
  DISCONNECTED = "DISCONNECTED",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  RECONNECTING = "RECONNECTING",
}

export enum WalletSessionRefreshPhase {
  IDLE = "IDLE",
  REFRESHING = "REFRESHING",
  BACKING_OFF = "BACKING_OFF",
  FAILED = "FAILED",
}

export type WalletSessionRefreshTrigger = "manual" | "silent";

/**
 * Refresh instrumentation stays separate from the primary session state so
 * simple consumers can keep using `WalletSessionState`, while UI/debugging
 * surfaces can inspect retry progress and deterministic backoff metadata.
 */
export interface WalletSessionRefreshState {
  phase: WalletSessionRefreshPhase;
  trigger: WalletSessionRefreshTrigger;
  attempt: number;
  maxAttempts: number;
  startedAt?: number;
  nextRetryAt?: number;
  backoffMs?: number;
  lastSucceededAt?: number;
  lastFailedAt?: number;
  terminal: boolean;
  errorCode?: string;
}

export interface WalletSessionRefreshPolicy {
  maxAttempts?: number;
  initialBackoffMs?: number;
  backoffMultiplier?: number;
}

export class WalletSessionError extends Error {
  public code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "WalletSessionError";
  }
}

export class ProviderNotFoundError extends WalletSessionError {
  constructor() {
    super("provider_not_found", "Wallet provider not found");
  }
}

export class RejectedSignatureError extends WalletSessionError {
  constructor() {
    super("rejected_signature", "User rejected the signature request");
  }
}

export class StaleSessionError extends WalletSessionError {
  constructor() {
    super("stale_session", "Stored session is stale or invalid");
  }
}

export class ValidationError extends WalletSessionError {
  constructor(message?: string) {
    super("validation_error", message ?? "Invalid parameters");
  }
}

export interface WalletSessionOptions {
  storageKey?: string;
  supportedNetworks?: Network[];
  sessionExpiryMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}
