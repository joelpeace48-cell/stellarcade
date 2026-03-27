import type { Network } from "./wallet-session";

export type NetworkGuardErrorCode =
  | "INVALID_ARGUMENT"
  | "PROVIDER_UNAVAILABLE"
  | "WALLET_NOT_CONNECTED"
  | "NETWORK_MISSING"
  | "NETWORK_UNSUPPORTED"
  | "NETWORK_MISMATCH"
  | "CONTRACT_ADDRESS_MISSING"
  | "DUPLICATE_OPERATION";

export class NetworkGuardError extends Error {
  public readonly code: NetworkGuardErrorCode;
  public readonly remediationHint: string;
  public readonly terminal: boolean;
  public readonly retryable: boolean;

  constructor(
    code: NetworkGuardErrorCode,
    message: string,
    remediationHint: string,
    options?: { terminal?: boolean; retryable?: boolean },
  ) {
    super(message);
    this.name = "NetworkGuardError";
    this.code = code;
    this.remediationHint = remediationHint;
    this.terminal = options?.terminal ?? true;
    this.retryable = options?.retryable ?? false;
  }
}

export interface ProviderNetworkSnapshot {
  network?: string | null;
  networkPassphrase?: string | null;
}

export interface NetworkProviderLike {
  getNetwork?: () => Promise<ProviderNetworkSnapshot | string | null | undefined>;
  network?: string | null;
  networkPassphrase?: string | null;
}

export interface ContractAddressRegistry {
  [contractName: string]: string | null | undefined;
}

export interface NetworkGuardInput {
  walletConnected: boolean;
  provider?: NetworkProviderLike | null;
  supportedNetworks?: readonly Network[];
  expectedNetwork?: Network | null;
  contractAddresses?: ContractAddressRegistry;
  operationKey?: string;
  allowDuplicateOperation?: boolean;
  isIdempotent?: boolean;
  resumeOnNetworkRecovery?: boolean;
}

export interface NetworkIdentity {
  raw: string | null;
  normalized: string;
}

export interface NetworkGuardSuccess {
  ok: true;
  network: NetworkIdentity;
  supportedNetworks: readonly string[];
}

export type NetworkGuardResult = NetworkGuardSuccess;
