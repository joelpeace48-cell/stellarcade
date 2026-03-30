import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  assertSupportedNetworkBeforeOperation,
  clearNetworkGuardOperationLocks,
  withNetworkGuard,
  isOffline,
  onConnectivityChange,
  enqueueRefreshOnReconnect,
  getPendingRefreshCount,
  resetPendingRefreshCount,
} from "../../src/services/network-guard-middleware";
import { NetworkGuardError } from "../../src/types/network-guard-middleware";

function provider(network: string) {
  return {
    async getNetwork() {
      return { network };
    },
  };
}

describe("network-guard-middleware", () => {
  it("passes for supported network", async () => {
    const result = await assertSupportedNetworkBeforeOperation({
      walletConnected: true,
      provider: provider("TESTNET"),
      supportedNetworks: ["TESTNET"],
    });

    expect(result.ok).toBe(true);
    expect(result.network.normalized).toBe("TESTNET");
  });

  it("throws typed mismatch error for unsupported network", async () => {
    await expect(
      assertSupportedNetworkBeforeOperation({
        walletConnected: true,
        provider: provider("FUTURENET"),
        supportedNetworks: ["TESTNET"],
      }),
    ).rejects.toMatchObject({
      name: "NetworkGuardError",
      code: "NETWORK_UNSUPPORTED",
    });
  });

  it("blocks missing wallet state", async () => {
    await expect(
      assertSupportedNetworkBeforeOperation({
        walletConnected: false,
        provider: provider("TESTNET"),
      }),
    ).rejects.toMatchObject({
      code: "WALLET_NOT_CONNECTED",
    });
  });

  it("blocks missing contract addresses before side effects", async () => {
    await expect(
      assertSupportedNetworkBeforeOperation({
        walletConnected: true,
        provider: provider("TESTNET"),
        contractAddresses: {
          treasury: "",
        },
      }),
    ).rejects.toMatchObject({
      code: "CONTRACT_ADDRESS_MISSING",
    });
  });

  it("blocks duplicate operation keys", async () => {
    clearNetworkGuardOperationLocks();

    const input = {
      walletConnected: true,
      provider: provider("TESTNET"),
      operationKey: "play-round-1",
    };

    const first = withNetworkGuard(input, async () =>
      new Promise<string>((resolve) => setTimeout(() => resolve("ok"), 25)),
    );

    await expect(withNetworkGuard(input, async () => "second")).rejects.toMatchObject({
      code: "DUPLICATE_OPERATION",
    });

    await expect(first).resolves.toBe("ok");
    clearNetworkGuardOperationLocks();
  });

  it("supports guarded operation execution", async () => {
    const value = await withNetworkGuard(
      {
        walletConnected: true,
        provider: provider("TESTNET"),
        supportedNetworks: ["TESTNET"],
        expectedNetwork: "TESTNET",
      },
      async () => 42,
    );

    expect(value).toBe(42);
  });

  it("maps expected mismatch with remediation hint", async () => {
    await expect(
      assertSupportedNetworkBeforeOperation({
        walletConnected: true,
        provider: provider("TESTNET"),
        expectedNetwork: "PUBLIC",
      }),
    ).rejects.toSatisfy((err) => {
      const e = err as NetworkGuardError;
      return e.code === "NETWORK_MISMATCH" && e.remediationHint.includes("PUBLIC");
    });
  });
});

describe("network-guard-middleware - offline detection (#480)", () => {
  beforeEach(async () => {
    // Flush any lingering listeners from previous tests
    window.dispatchEvent(new Event("online"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    resetPendingRefreshCount();
  });

  afterEach(async () => {
    window.dispatchEvent(new Event("online"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    resetPendingRefreshCount();
  });

  it("isOffline returns false when navigator.onLine is true", () => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    expect(isOffline()).toBe(false);
  });

  it("isOffline returns true when navigator.onLine is false", () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    expect(isOffline()).toBe(true);
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });

  it("onConnectivityChange notifies listener on online event", () => {
    const listener = vi.fn();
    const unsubscribe = onConnectivityChange(listener);

    window.dispatchEvent(new Event("online"));
    expect(listener).toHaveBeenCalledWith(true);

    unsubscribe();
  });

  it("onConnectivityChange notifies listener on offline event", () => {
    const listener = vi.fn();
    const unsubscribe = onConnectivityChange(listener);

    window.dispatchEvent(new Event("offline"));
    expect(listener).toHaveBeenCalledWith(false);

    unsubscribe();
  });

  it("unsubscribe stops further notifications", () => {
    const listener = vi.fn();
    const unsubscribe = onConnectivityChange(listener);

    unsubscribe();
    window.dispatchEvent(new Event("online"));
    expect(listener).not.toHaveBeenCalled();
  });

  it("enqueueRefreshOnReconnect increments pending count", () => {
    expect(getPendingRefreshCount()).toBe(0);
    enqueueRefreshOnReconnect(async () => {});
    expect(getPendingRefreshCount()).toBe(1);
    enqueueRefreshOnReconnect(async () => {});
    expect(getPendingRefreshCount()).toBe(2);
  });

  it("queued refresh executes on reconnect and decrements count", async () => {
    const refreshFn = vi.fn().mockResolvedValue(undefined);
    enqueueRefreshOnReconnect(refreshFn);

    // Simulate coming back online
    window.dispatchEvent(new Event("online"));

    // Allow async handlers to process
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(refreshFn).toHaveBeenCalledTimes(1);
  });

  it("resetPendingRefreshCount resets to zero", () => {
    enqueueRefreshOnReconnect(async () => {});
    expect(getPendingRefreshCount()).toBe(1);
    resetPendingRefreshCount();
    expect(getPendingRefreshCount()).toBe(0);
  });
});
