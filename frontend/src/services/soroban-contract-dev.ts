/**
 * Development-only contract call simulation registry.
 *
 * When `import.meta.env.PROD` is true, all exports are no-ops and return
 * immediately so production behavior is unchanged and bundlers can elide
 * dead paths where used behind `import.meta.env.DEV` checks.
 */

import { SorobanClientError, SorobanErrorCode } from "../types/errors";
import type { ContractResult } from "../types/contracts";

function simKey(contractId: string, method: string): string {
  return `${contractId.trim()}|${method.trim()}`;
}

const registry = new Map<string, ContractResult<unknown>>();

/**
 * Register a mock result for matching `simulate` / `invoke` calls (same contract + method).
 * Overwrites any previous entry for that key.
 */
export function devRegisterContractSimResult(
  contractId: string,
  method: string,
  result: ContractResult<unknown>,
): void {
  if (import.meta.env.PROD) return;
  registry.set(simKey(contractId, method), result);
}

export function devClearContractSimResults(): void {
  if (import.meta.env.PROD) return;
  registry.clear();
}

/**
 * @internal Used by SorobanContractClient in development only.
 */
export function devPeekContractSimResult<T>(
  contractId: string,
  method: string,
): ContractResult<T> | null {
  if (import.meta.env.PROD) return null;
  const hit = registry.get(simKey(contractId, method));
  return hit !== undefined ? (hit as ContractResult<T>) : null;
}

export function devListContractSimKeys(): string[] {
  if (import.meta.env.PROD) return [];
  return [...registry.keys()];
}

/**
 * Parse a JSON textarea into a success `ContractResult` or build a failure from message + code.
 */
export function devParseMockResultPayload(
  mode: "success" | "failure",
  jsonOrMessage: string,
  failureCode: SorobanErrorCode = SorobanErrorCode.RpcError,
): ContractResult<unknown> {
  if (import.meta.env.PROD) {
    return {
      success: false,
      error: new SorobanClientError({
        code: SorobanErrorCode.RpcError,
        message: "Contract dev simulator is disabled in production.",
        retryable: false,
      }),
    };
  }
  if (mode === "failure") {
    const msg = jsonOrMessage.trim() || "Simulated contract failure";
    return {
      success: false,
      error: new SorobanClientError({
        code: failureCode,
        message: msg,
        retryable: false,
      }),
    };
  }
  try {
    const data =
      jsonOrMessage.trim() === "" ? null : JSON.parse(jsonOrMessage) as unknown;
    return { success: true, data: data as unknown };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: new SorobanClientError({
        code: SorobanErrorCode.InvalidParameter,
        message: `Invalid JSON for mock data: ${message}`,
        retryable: false,
      }),
    };
  }
}
