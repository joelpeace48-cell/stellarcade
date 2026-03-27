import type { xdr } from "@stellar/stellar-sdk";

import type { CallOptions, ContractResult } from "../contracts";

export interface ContractReadOptions {
  pollingInterval?: number;
  enabled?: boolean;
}

export interface ContractReadResult<T = any> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  read: (
    method: string,
    params?: any[],
    options?: ContractReadOptions,
  ) => Promise<T | null>;
  refetch: () => Promise<void>;
  clear: () => void;
}

export interface ContractReadRequest<T = unknown> {
  contractId: string;
  method: string;
  args?: xdr.ScVal[];
  options?: CallOptions;
  mapResult?: (data: unknown) => T;
}

export interface ContractReadBatchItemResult<T = unknown> {
  index: number;
  request: ContractReadRequest<T>;
  result: ContractResult<T>;
}

export type ContractReadBatchResultTuple<
  TRequests extends readonly ContractReadRequest<unknown>[],
> = {
  [K in keyof TRequests]: TRequests[K] extends ContractReadRequest<infer T>
    ? ContractReadBatchItemResult<T>
    : never;
};

export interface ContractReadBatchResult<
  TRequests extends readonly ContractReadRequest<unknown>[] = readonly ContractReadRequest<unknown>[],
> {
  ordering: "preserved";
  successCount: number;
  failureCount: number;
  hasFailures: boolean;
  hasPartialFailures: boolean;
  results: ContractReadBatchResultTuple<TRequests>;
}
