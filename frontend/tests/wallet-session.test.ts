import { describe, it, expect, beforeEach, vi } from "vitest";
import WalletSessionService from "../src/services/wallet-session-service";
import {
  ProviderNotFoundError,
  RejectedSignatureError,
  StaleSessionError,
  WalletSessionRefreshPhase,
} from "../src/types/wallet-session";

class MockAdapter {
  available = true;
  address = "GTESTADDRESS123";
  provider = { id: "mock", name: "MockWallet" };
  willRejectSign = false;
  signFailuresBeforeSuccess = 0;
  signCalls = 0;

  isAvailable() {
    return this.available;
  }

  async connect() {
    return {
      address: this.address,
      provider: this.provider,
      network: "TESTNET",
    };
  }

  async disconnect() {
    return;
  }

  async signMessage(_message: string) {
    this.signCalls += 1;
    if (this.willRejectSign) throw new Error("User rejected");
    if (this.signCalls <= this.signFailuresBeforeSuccess) {
      throw new Error("temporary refresh issue");
    }
    return "signed";
  }
}

beforeEach(() => {
  localStorage.clear();
});

describe("WalletSessionService", () => {
  it("connects successfully", async () => {
    const service = new WalletSessionService({
      supportedNetworks: ["TESTNET"],
      now: () => 100,
    });
    const adapter = new MockAdapter();
    service.setProviderAdapter(adapter as any);

    const meta = await service.connect({ network: "TESTNET" });
    expect(meta.address).toBe(adapter.address);
    expect(service.getState()).toBe("CONNECTED");
    const raw = JSON.parse(localStorage.getItem("stc_wallet_session_v1") as string);
    expect(raw.meta.address).toBe(adapter.address);
  });

  it("throws ProviderNotFoundError when adapter is missing", async () => {
    const service = new WalletSessionService();
    await expect(service.connect()).rejects.toBeInstanceOf(ProviderNotFoundError);
  });

  it("reconnects using stored session and verifies signature", async () => {
    const service = new WalletSessionService({
      supportedNetworks: ["TESTNET"],
      now: () => 100,
    });
    const adapter = new MockAdapter();
    service.setProviderAdapter(adapter as any);

    const meta = await service.connect({ network: "TESTNET" });
    const serviceReloaded = new WalletSessionService({
      supportedNetworks: ["TESTNET"],
      now: () => 200,
    });
    serviceReloaded.setProviderAdapter(adapter as any);

    const reconnected = await serviceReloaded.reconnect();
    expect(reconnected.address).toBe(meta.address);
    expect(serviceReloaded.getRefreshState().phase).toBe(
      WalletSessionRefreshPhase.IDLE,
    );
  });

  it("exposes refresh start and success metadata for silent refresh", async () => {
    let now = 1_000;
    const transitions: string[] = [];
    const service = new WalletSessionService({
      supportedNetworks: ["TESTNET"],
      now: () => now,
      sleep: async (ms) => {
        now += ms;
      },
    });
    const adapter = new MockAdapter();
    service.setProviderAdapter(adapter as any);
    await service.connect({ network: "TESTNET" });

    service.subscribe((_state, _meta, _error, refreshState) => {
      if (refreshState) {
        transitions.push(refreshState.phase);
      }
    });

    await service.silentRefresh();

    expect(transitions).toContain(WalletSessionRefreshPhase.REFRESHING);
    expect(service.getRefreshState()).toEqual(
      expect.objectContaining({
        phase: WalletSessionRefreshPhase.IDLE,
        trigger: "silent",
        lastSucceededAt: expect.any(Number),
        terminal: false,
      }),
    );
  });

  it("exposes retry backoff transitions deterministically", async () => {
    let now = 1_000;
    const refreshPhases: WalletSessionRefreshPhase[] = [];
    const service = new WalletSessionService({
      supportedNetworks: ["TESTNET"],
      now: () => now,
      sleep: async (ms) => {
        now += ms;
      },
    });
    const adapter = new MockAdapter();
    adapter.signFailuresBeforeSuccess = 1;
    service.setProviderAdapter(adapter as any);
    await service.connect({ network: "TESTNET" });

    service.subscribe((_state, _meta, _error, refreshState) => {
      if (refreshState) {
        refreshPhases.push(refreshState.phase);
      }
    });

    await service.silentRefresh({
      maxAttempts: 2,
      initialBackoffMs: 250,
      backoffMultiplier: 1,
    });

    expect(refreshPhases).toContain(WalletSessionRefreshPhase.REFRESHING);
    expect(refreshPhases).toContain(WalletSessionRefreshPhase.BACKING_OFF);
    expect(service.getRefreshState()).toEqual(
      expect.objectContaining({
        phase: WalletSessionRefreshPhase.IDLE,
        attempt: 2,
        maxAttempts: 2,
      }),
    );
  });

  it("exposes terminal failure state when silent refresh cannot recover", async () => {
    let now = 5_000;
    const service = new WalletSessionService({
      supportedNetworks: ["TESTNET"],
      now: () => now,
      sleep: async (ms) => {
        now += ms;
      },
    });
    const adapter = new MockAdapter();
    adapter.willRejectSign = true;
    service.setProviderAdapter(adapter as any);
    await service.connect({ network: "TESTNET" });

    await expect(service.silentRefresh({ maxAttempts: 3 })).rejects.toBeInstanceOf(
      RejectedSignatureError,
    );
    expect(service.getRefreshState()).toEqual(
      expect.objectContaining({
        phase: WalletSessionRefreshPhase.FAILED,
        terminal: true,
        errorCode: "rejected_signature",
      }),
    );
  });

  it("reconnect fails when sign rejected", async () => {
    const service = new WalletSessionService({
      supportedNetworks: ["TESTNET"],
      now: () => 100,
    });
    const adapter = new MockAdapter();
    service.setProviderAdapter(adapter as any);

    await service.connect({ network: "TESTNET" });

    const rejectingAdapter = new MockAdapter();
    rejectingAdapter.willRejectSign = true;
    const reloaded = new WalletSessionService({
      supportedNetworks: ["TESTNET"],
      now: () => 200,
    });
    reloaded.setProviderAdapter(rejectingAdapter as any);

    await expect(reloaded.reconnect()).rejects.toBeInstanceOf(
      RejectedSignatureError,
    );
  });

  it("stale session is removed", async () => {
    vi.useFakeTimers();
    const service = new WalletSessionService({
      supportedNetworks: ["TESTNET"],
      sessionExpiryMs: 1,
    });
    const adapter = new MockAdapter();
    service.setProviderAdapter(adapter as any);
    await service.connect({ network: "TESTNET" });

    await vi.advanceTimersByTimeAsync(5);

    const reloaded = new WalletSessionService({
      supportedNetworks: ["TESTNET"],
      sessionExpiryMs: 1,
    });
    reloaded.setProviderAdapter(adapter as any);
    await expect(reloaded.reconnect()).rejects.toBeInstanceOf(StaleSessionError);
    vi.useRealTimers();
  });
});
