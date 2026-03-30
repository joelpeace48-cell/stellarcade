import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import WalletStatusCard from "../src/components/v1/WalletStatusCard";
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

afterEach(() => {
  cleanup();
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

  it("sessionDropped is false by default", () => {
    const service = new WalletSessionService();
    expect(service.getSessionDropped()).toBe(false);
  });

  it("marks session as dropped after terminal refresh failure", async () => {
    const service = new WalletSessionService({
      supportedNetworks: ["TESTNET"],
      now: () => 100,
    });
    const adapter = new MockAdapter();
    adapter.willRejectSign = true;
    service.setProviderAdapter(adapter as any);

    await service.connect({ network: "TESTNET" });
    expect(service.getSessionDropped()).toBe(false);

    await expect(service.silentRefresh({ maxAttempts: 1 })).rejects.toBeDefined();
    expect(service.getSessionDropped()).toBe(true);
  });

  it("exposes sessionDropped=true via subscriber callback after terminal failure", async () => {
    const service = new WalletSessionService({
      supportedNetworks: ["TESTNET"],
      now: () => 100,
    });
    const adapter = new MockAdapter();
    adapter.willRejectSign = true;
    service.setProviderAdapter(adapter as any);

    await service.connect({ network: "TESTNET" });

    const droppedValues: boolean[] = [];
    service.subscribe((_s, _m, _e, _rs, sessionDropped) => {
      if (sessionDropped !== undefined) droppedValues.push(sessionDropped);
    });

    await expect(service.silentRefresh({ maxAttempts: 1 })).rejects.toBeDefined();
    expect(droppedValues).toContain(true);
  });

  it("clears sessionDropped flag after successful reconnect", async () => {
    const now = { value: 100 };
    const service = new WalletSessionService({
      supportedNetworks: ["TESTNET"],
      now: () => now.value,
    });
    const failingAdapter = new MockAdapter();
    failingAdapter.willRejectSign = true;
    service.setProviderAdapter(failingAdapter as any);

    await service.connect({ network: "TESTNET" });
    await expect(service.silentRefresh({ maxAttempts: 1 })).rejects.toBeDefined();
    expect(service.getSessionDropped()).toBe(true);

    // Reconnect with a working adapter
    const goodAdapter = new MockAdapter();
    now.value = 200;
    const reloaded = new WalletSessionService({
      supportedNetworks: ["TESTNET"],
      now: () => now.value,
    });
    reloaded.setProviderAdapter(goodAdapter as any);
    // Must have a stored session to reconnect — connect first
    await reloaded.connect({ network: "TESTNET" });

    const reloaded2 = new WalletSessionService({
      supportedNetworks: ["TESTNET"],
      now: () => now.value,
    });
    reloaded2.setProviderAdapter(goodAdapter as any);
    await reloaded2.reconnect();
    expect(reloaded2.getSessionDropped()).toBe(false);
  });

  it("does not mark session as dropped on user-initiated disconnect", async () => {
    const service = new WalletSessionService({
      supportedNetworks: ["TESTNET"],
      now: () => 100,
    });
    const adapter = new MockAdapter();
    service.setProviderAdapter(adapter as any);

    await service.connect({ network: "TESTNET" });
    await service.disconnect();

    expect(service.getSessionDropped()).toBe(false);
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

  it("keeps recent session history bounded", async () => {
    const service = new WalletSessionService({
      supportedNetworks: ["TESTNET"],
      now: (() => {
        let tick = 1_000;
        return () => tick++;
      })(),
    });
    const adapter = new MockAdapter();
    service.setProviderAdapter(adapter as any);

    for (let i = 0; i < 10; i++) {
      adapter.address = `GTESTADDRESS${i}XYZ`;
      await service.connect({ network: "TESTNET" });
      await service.disconnect();
    }

    const history = WalletSessionService.getRecentSessionHistory();
    expect(history).toHaveLength(8);
    expect(history[0].type).toBe("disconnected");
    expect(history[0].addressPreview).toContain("...");
  });

  it("records expiration in recent session history", async () => {
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
    expect(WalletSessionService.getRecentSessionHistory()[0]?.type).toBe("expired");
    vi.useRealTimers();
  });

  it("renders recent session history only when entries exist", async () => {
    render(
      React.createElement(WalletStatusCard, {
        status: "DISCONNECTED",
        address: null,
        network: null,
      }),
    );

    expect(screen.queryByTestId("wallet-session-history")).toBeNull();

    cleanup();

    const service = new WalletSessionService({
      supportedNetworks: ["TESTNET"],
      now: () => 100,
    });
    const adapter = new MockAdapter();
    service.setProviderAdapter(adapter as any);
    await service.connect({ network: "TESTNET" });

    render(
      React.createElement(WalletStatusCard, {
        status: "CONNECTED",
        address: adapter.address,
        network: "TESTNET",
        provider: adapter.provider,
      }),
    );

    expect(screen.getByTestId("wallet-session-history")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /recent session/i }));
    expect(
      screen.getByText("Connected", {
        selector: ".wallet-status-card__history-event",
      }),
    ).toBeInTheDocument();
  });
});
