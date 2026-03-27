import { describe, expect, it, vi } from "vitest";

import {
  clearNetworkGuardOperationLocks,
  getQueuedNetworkActionsCount,
  resumeQueuedNetworkActions,
  withNetworkGuard,
} from "../../src/services/network-guard-middleware";

describe("network guard middleware integration", () => {
  it("prevents side effects on unsupported chains", async () => {
    const sideEffect = vi.fn(async () => "should-not-run");

    await expect(
      withNetworkGuard(
        {
          walletConnected: true,
          provider: {
            async getNetwork() {
              return { network: "PUBLIC" };
            },
          },
          supportedNetworks: ["TESTNET"],
        },
        sideEffect,
      ),
    ).rejects.toMatchObject({ code: "NETWORK_UNSUPPORTED" });

    expect(sideEffect).not.toHaveBeenCalled();
  });

  it("runs side effects on supported chain", async () => {
    const sideEffect = vi.fn(async () => "ok");

    await expect(
      withNetworkGuard(
        {
          walletConnected: true,
          provider: {
            async getNetwork() {
              return { networkPassphrase: "Test SDF Network ; September 2015" };
            },
          },
          supportedNetworks: ["TESTNET"],
          operationKey: "mint-1",
        },
        sideEffect,
      ),
    ).resolves.toBe("ok");

    expect(sideEffect).toHaveBeenCalledTimes(1);
    clearNetworkGuardOperationLocks();
  });

  it("queues and resumes idempotent actions after network recovery", async () => {
    let network = "PUBLIC";
    const sideEffect = vi.fn(async () => "resumed-ok");

    const input = {
      walletConnected: true,
      provider: {
        async getNetwork() {
          return { network };
        },
      },
      supportedNetworks: ["TESTNET"],
      isIdempotent: true,
      resumeOnNetworkRecovery: true,
    };

    const resumePromise = withNetworkGuard(input, sideEffect);

    // Allow promise ticks to reach the queueing logic
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(getQueuedNetworkActionsCount()).toBe(1);
    expect(sideEffect).not.toHaveBeenCalled();

    network = "TESTNET";
    await resumeQueuedNetworkActions();

    await expect(resumePromise).resolves.toBe("resumed-ok");
    expect(sideEffect).toHaveBeenCalledTimes(1);
  });
});
