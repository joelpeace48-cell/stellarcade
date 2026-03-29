import { describe, it, expect, beforeEach, vi } from "vitest";


import GlobalStateStore from "../src/services/global-state-store";
import {
  isBannerDismissed,
  persistBannerDismissal,
  getSavedFilterPresets,
  saveFilterPreset,
  deleteSavedFilterPreset,
} from "../src/services/global-state-store";
import { render, screen, fireEvent } from "@testing-library/react";
import { NetworkGuardBanner } from "../src/components/v1/NetworkGuardBanner";
import { ErrorNotice } from "../src/components/v1/ErrorNotice";
import type { AppError } from "../src/types/errors";
import React from "react";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("GlobalStateStore", () => {
  it("initializes with defaults and persists auth/flags", () => {
    const store = new GlobalStateStore({ storageKey: "test_state" });
    expect(store.getState().auth.isAuthenticated).toBe(false);

    store.dispatch({
      type: "AUTH_SET",
      payload: { userId: "u1", token: "t1" },
    });
    store.dispatch({
      type: "FLAGS_SET",
      payload: { key: "feature_x", value: true },
    });

    const raw = JSON.parse(localStorage.getItem("test_state") as string);
    expect(raw.auth.userId).toBe("u1");
    expect(raw.flags.feature_x).toBe(true);
  });

  it("clears wallet as ephemeral and does not persist", () => {
    const store = new GlobalStateStore({ storageKey: "test_state2" });
    store.dispatch({
      type: "WALLET_SET",
      payload: {
        meta: {
          address: "GABC",
          provider: { id: "m", name: "m" },
          network: "TESTNET",
          connectedAt: Date.now(),
        },
      } as any,
    });
    const raw = JSON.parse(localStorage.getItem("test_state2") as string);
    expect(raw.wallet).toBeUndefined();
  });

  it("persists and restores banner dismissals by key and identity", () => {
    expect(isBannerDismissed("network-guard-banner", "testnet:v1")).toBe(false);

    persistBannerDismissal("network-guard-banner", "testnet:v1", true);
    expect(isBannerDismissed("network-guard-banner", "testnet:v1")).toBe(true);
  });

  it("resets dismissal when banner identity changes", () => {
    persistBannerDismissal("network-guard-banner", "testnet:v1", true);
    expect(isBannerDismissed("network-guard-banner", "testnet:v1")).toBe(true);
    expect(isBannerDismissed("network-guard-banner", "testnet:v2")).toBe(false);
  });

  it("does not persist dismissals unless banner opts in", () => {
    render(
      React.createElement(NetworkGuardBanner, {
        network: "PUBLIC",
        normalizedNetwork: "PUBLIC",
        supportedNetworks: ["TESTNET"],
        isSupported: false,
        dismissible: true,
        persistDismissal: false,
      }),
    );

    fireEvent.click(screen.getByTestId("network-dismiss-button"));
    expect(isBannerDismissed("network-guard-banner", "PUBLIC:PUBLIC:TESTNET")).toBe(false);
  });

  it("persists dismissals for ErrorNotice when enabled", () => {
    const error: AppError = {
      code: "RPC_NODE_UNAVAILABLE",
      domain: "rpc",
      severity: "retryable",
      message: "Network is down",
    };

    render(
      React.createElement(ErrorNotice, {
        error,
        onDismiss: () => {},
        persistDismissal: true,
        dismissalKey: "error-notice",
        dismissalIdentity: "rpc-node:v1",
        testId: "persisted-error",
      }),
    );

    fireEvent.click(screen.getByTestId("persisted-error-dismiss"));
    expect(isBannerDismissed("error-notice", "rpc-node:v1")).toBe(true);
  });

  it("persists and restores pending transactions", () => {
    const store = new GlobalStateStore({ storageKey: "pending_tx_test" });
    const snapshot = {
      operation: "swap.play",
      phase: "CONFIRMING",
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };

    store.dispatch({
      type: "PENDING_TX_SET",
      payload: { snapshot },
    });

    const store2 = new GlobalStateStore({ storageKey: "pending_tx_test" });
    expect(store2.getState().pendingTransaction).toEqual(snapshot);
  });

  it("invalidates stale pending transactions after 30 minutes", async () => {
    const started = Date.now() - 31 * 60 * 1000;

    // Simulate manual persistence of stale content
    const payload = {
      auth: { isAuthenticated: false },
      flags: {},
      pendingTransaction: {
        operation: "swap.play",
        phase: "SUBMITTING",
        startedAt: started,
        updatedAt: started,
      },
      storedAt: started,
    };
    localStorage.setItem("stale_tx_test", JSON.stringify(payload));

    const store2 = new GlobalStateStore({ storageKey: "stale_tx_test" });
    expect(store2.getState().pendingTransaction).toBeNull();
  });

  it("saves and restores filter presets by scope", () => {
    const saved = saveFilterPreset("events", "High signal", ["coin_flip", "transfer"]);
    expect(saved?.name).toBe("High signal");

    const presets = getSavedFilterPresets("events");
    expect(presets).toHaveLength(1);
    expect(presets[0].values).toEqual(["coin_flip", "transfer"]);
  });

  it("deletes saved presets without affecting other scopes", () => {
    const first = saveFilterPreset("events", "Errors", ["error"]);
    saveFilterPreset("activity", "Wins", ["win"]);

    deleteSavedFilterPreset("events", first?.id ?? "");

    expect(getSavedFilterPresets("events")).toEqual([]);
    expect(getSavedFilterPresets("activity")).toHaveLength(1);
  });

  it("overwrites deterministic preset ids within the same scope", () => {
    saveFilterPreset("events", "Focus", ["coin_flip"]);
    saveFilterPreset("events", "Focus", ["transfer"]);

    const presets = getSavedFilterPresets("events");
    expect(presets).toHaveLength(1);
    expect(presets[0].values).toEqual(["transfer"]);
  });
});
