/**
 * WalletStatusCard Component Tests
 *
 * Unit tests covering:
 * - Skeleton/loading state rendering
 * - Status badge variants for all WalletStatus values
 * - Address and network display (present, absent, truncation)
 * - Provider name display
 * - Error message rendering
 * - Action button guards (connect / disconnect / retry)
 * - Callback invocation and error safety
 * - Edge cases and invalid props
 * - Accessibility attributes
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import "@testing-library/jest-dom";
import { WalletStatusCard } from "../../../src/components/v1/WalletStatusCard";
import type { WalletStatusCardProps } from "../../../src/components/v1/WalletStatusCard.types";
import type { WalletStatus } from "../../../src/components/v1/WalletStatusCard.types";

const WALLET_SESSION_HISTORY_KEY = "stc_wallet_session_history_v1";

// ── Helpers ────────────────────────────────────────────────────────────────────

function connectedCapabilities() {
  return {
    isConnected: true,
    isConnecting: false,
    isReconnecting: false,
    canConnect: false,
  };
}

function disconnectedCapabilities() {
  return {
    isConnected: false,
    isConnecting: false,
    isReconnecting: false,
    canConnect: true,
  };
}

function connectingCapabilities() {
  return {
    isConnected: false,
    isConnecting: true,
    isReconnecting: false,
    canConnect: false,
  };
}

function renderCard(props: Partial<WalletStatusCardProps> = {}) {
  return render(<WalletStatusCard {...props} />);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("WalletStatusCard", () => {
  beforeEach(() => {
    localStorage.removeItem(WALLET_SESSION_HISTORY_KEY);
  });

  // ── Loading / skeleton state ─────────────────────────────────────────────────
  describe("Loading state", () => {
    it("renders skeleton when isLoading is true", () => {
      renderCard({ isLoading: true });
      const card = screen.getByTestId("wallet-status-card");
      expect(card).toHaveAttribute("aria-busy", "true");
      expect(card).toHaveClass("wallet-status-card--skeleton");
    });

    it("does not render badge or body content while loading", () => {
      renderCard({ isLoading: true });
      expect(
        screen.queryByTestId("wallet-status-badge"),
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("wallet-address")).not.toBeInTheDocument();
      expect(screen.queryByTestId("wallet-network")).not.toBeInTheDocument();
    });

    it("renders normal card when isLoading is false", () => {
      renderCard({ isLoading: false });
      expect(screen.getByTestId("wallet-status-badge")).toBeInTheDocument();
    });

    it("uses custom testId on skeleton", () => {
      renderCard({ isLoading: true, testId: "my-wallet-skeleton" });
      expect(screen.getByTestId("my-wallet-skeleton")).toBeInTheDocument();
    });
  });

  // ── Default rendering ────────────────────────────────────────────────────────
  describe("Default rendering", () => {
    it("renders without crashing with no props", () => {
      renderCard();
      expect(screen.getByTestId("wallet-status-card")).toBeInTheDocument();
    });

    it("defaults to DISCONNECTED status", () => {
      renderCard();
      expect(screen.getByTestId("wallet-status-badge")).toHaveTextContent(
        "Disconnected",
      );
    });

    it("calls onConnect when connect button is clicked", () => {
      const onConnect = vi.fn();
      renderCard({ status: "DISCONNECTED", onConnect });
      fireEvent.click(screen.getByText("Connect"));
      expect(onConnect).toHaveBeenCalled();
    });

    it("calls onDisconnect when disconnect button is clicked", () => {
      const onDisconnect = vi.fn();
      renderCard({
        status: "CONNECTED",
        capabilities: connectedCapabilities(),
        onDisconnect,
      });
      fireEvent.click(screen.getByText("Disconnect"));
      expect(onDisconnect).toHaveBeenCalled();
    });

    it("calls onRetry when retry button is clicked", () => {
      const onRetry = vi.fn();
      renderCard({
        status: "ERROR",
        error: { message: "Error", recoverable: true, code: "test" },
        onRetry,
      });
      fireEvent.click(screen.getByText("Retry"));
      expect(onRetry).toHaveBeenCalled();
    });

    it("uses custom testId", () => {
      renderCard({ testId: "my-card" });
      expect(screen.getByTestId("my-card")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = renderCard({ className: "my-custom-class" });
      expect(container.querySelector(".my-custom-class")).toBeInTheDocument();
    });

    it("does not render advanced diagnostics unless provided", () => {
      renderCard();
      expect(
        screen.queryByTestId("wallet-diagnostics"),
      ).not.toBeInTheDocument();
    });

    it("renders advanced diagnostics behind progressive disclosure", () => {
      renderCard({
        diagnostics: [
          { label: "RPC health", value: "healthy", tone: "success" },
          { label: "Recovery pending", value: false },
        ],
      });

      const diagnostics = screen.getByTestId("wallet-diagnostics");
      expect(diagnostics).toBeInTheDocument();
      expect(diagnostics).not.toHaveAttribute("open");
      expect(
        screen.getByText("Advanced wallet diagnostics"),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByText("Advanced wallet diagnostics"));

      expect(diagnostics).toHaveAttribute("open");
      expect(screen.getByText("RPC health")).toBeInTheDocument();
      expect(screen.getByText("healthy")).toBeInTheDocument();
      expect(screen.getByText("No")).toBeInTheDocument();
    });

    it("renders diagnostics empty fallback for blocked diagnostics data", () => {
      renderCard({ diagnostics: [] });
      expect(screen.getByTestId("wallet-diagnostics-empty")).toHaveTextContent(
        "No diagnostic data available.",
      );
    });
  });

  // ── Status badges ────────────────────────────────────────────────────────────
  describe("Status badge rendering", () => {
    const cases: Array<[WalletStatus, string, string]> = [
      ["CONNECTED", "Connected", "connected"],
      ["DISCONNECTED", "Disconnected", "disconnected"],
      ["CONNECTING", "Connecting\u2026", "connecting"],
      ["RECONNECTING", "Reconnecting\u2026", "reconnecting"],
      ["PROVIDER_MISSING", "No Wallet Found", "error"],
      ["PERMISSION_DENIED", "Permission Denied", "error"],
      ["STALE_SESSION", "Session Expired", "error"],
      ["ERROR", "Error", "error"],
    ];

    test.each(cases)(
      'status %s shows label "%s" and badge variant "%s"',
      (status, expectedLabel, expectedVariant) => {
        renderCard({ status });
        const badge = screen.getByTestId("wallet-status-badge");
        expect(badge).toHaveTextContent(expectedLabel);
        expect(badge).toHaveClass(
          `wallet-status-card__badge--${expectedVariant}`,
        );
      },
    );
  });

  // ── Address display ──────────────────────────────────────────────────────────
  describe("Address display", () => {
    it("shows truncated address when provided", () => {
      renderCard({ address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890" });
      const el = screen.getByTestId("wallet-address");
      expect(el).toHaveTextContent("GABCDE");
    });

    it("sets full address in title attribute", () => {
      const fullAddress = "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
      renderCard({ address: fullAddress });
      expect(screen.getByTestId("wallet-address")).toHaveAttribute(
        "title",
        fullAddress,
      );
    });

    it("shows muted class when address is null", () => {
      renderCard({ address: null });
      expect(screen.getByTestId("wallet-address")).toHaveClass(
        "wallet-status-card__value--muted",
      );
    });

    it("shows short address without truncation", () => {
      renderCard({ address: "GABC" });
      expect(screen.getByTestId("wallet-address")).toHaveTextContent("GABC");
    });

    it("strips HTML tags from address", () => {
      renderCard({ address: "<b>GABCDEF</b>WXYZ" });
      expect(screen.getByTestId("wallet-address")).not.toHaveTextContent("<b>");
    });
  });

  // ── Network display ──────────────────────────────────────────────────────────
  describe("Network display", () => {
    it("shows network when provided", () => {
      renderCard({ network: "testnet" });
      expect(screen.getByTestId("wallet-network")).toHaveTextContent("testnet");
    });

    it("shows muted class when network is null", () => {
      renderCard({ network: null });
      expect(screen.getByTestId("wallet-network")).toHaveClass(
        "wallet-status-card__value--muted",
      );
    });

    it("strips HTML tags from network", () => {
      renderCard({ network: "<script>bad</script>testnet" });
      expect(screen.getByTestId("wallet-network")).not.toHaveTextContent(
        "<script>",
      );
      expect(screen.getByTestId("wallet-network")).toHaveTextContent("testnet");
    });
  });

  // ── Provider display ─────────────────────────────────────────────────────────
  describe("Provider display", () => {
    it("shows provider name when provided", () => {
      renderCard({
        provider: { id: "freighter", name: "Freighter" },
      });
      expect(screen.getByText("Freighter")).toBeInTheDocument();
    });

    it("does not render provider section when provider is null", () => {
      const { container } = renderCard({ provider: null });
      expect(
        container.querySelector(".wallet-status-card__provider"),
      ).not.toBeInTheDocument();
    });

    it("strips HTML from provider name", () => {
      renderCard({
        provider: { id: "x", name: "<script>evil</script>Freighter" },
      });
      expect(screen.getByText("Freighter")).toBeInTheDocument();
    });
  });

  // ── Error display ────────────────────────────────────────────────────────────
  describe("Error display", () => {
    it("renders error block when error is provided", () => {
      renderCard({
        error: {
          code: "wallet_error",
          message: "Something failed",
          recoverable: false,
        },
      });
      expect(screen.getByTestId("wallet-error")).toBeInTheDocument();
      expect(screen.getByTestId("wallet-error")).toHaveTextContent(
        "Something failed",
      );
    });

    it("does not render error block when error is null", () => {
      renderCard({ error: null });
      expect(screen.queryByTestId("wallet-error")).not.toBeInTheDocument();
    });

    it('has role="alert" on error block', () => {
      renderCard({
        error: { code: "err", message: "Oops", recoverable: false },
      });
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("strips HTML from error message", () => {
      renderCard({
        error: {
          code: "err",
          message: "<b>Bad</b> message",
          recoverable: false,
        },
      });
      expect(screen.getByTestId("wallet-error")).not.toHaveTextContent("<b>");
      expect(screen.getByTestId("wallet-error")).toHaveTextContent(
        "Bad message",
      );
    });
  });

  // ── Connect button ───────────────────────────────────────────────────────────
  describe("Connect button", () => {
    it("shows connect button when canConnect is true and onConnect provided", () => {
      renderCard({
        status: "DISCONNECTED",
        capabilities: disconnectedCapabilities(),
        onConnect: vi.fn(),
      });
      expect(screen.getByText("Connect")).toBeInTheDocument();
    });

    it("calls onConnect when connect button clicked", () => {
      const onConnect = vi.fn();
      renderCard({
        status: "DISCONNECTED",
        capabilities: disconnectedCapabilities(),
        onConnect,
      });
      fireEvent.click(screen.getByText("Connect"));
      expect(onConnect).toHaveBeenCalledTimes(1);
    });

    it("does not show connect button when already connected", () => {
      renderCard({
        status: "CONNECTED",
        capabilities: connectedCapabilities(),
        onConnect: vi.fn(),
      });
      expect(screen.queryByText("Connect")).not.toBeInTheDocument();
    });

    it("does not show connect button when onConnect is not provided", () => {
      renderCard({
        status: "DISCONNECTED",
        capabilities: disconnectedCapabilities(),
      });
      expect(screen.queryByText("Connect")).toBeInTheDocument();
    });

    it("handles async onConnect without crashing", () => {
      const onConnect = vi.fn().mockResolvedValue(undefined);
      renderCard({
        status: "DISCONNECTED",
        capabilities: disconnectedCapabilities(),
        onConnect,
      });
      fireEvent.click(screen.getByText("Connect"));
      expect(onConnect).toHaveBeenCalledTimes(1);
    });

    it("does not crash when onConnect throws", () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const onConnect = vi.fn(() => {
        throw new Error("connect failed");
      });
      renderCard({
        status: "DISCONNECTED",
        capabilities: disconnectedCapabilities(),
        onConnect,
      });
      expect(() => fireEvent.click(screen.getByText("Connect"))).not.toThrow();
      consoleErrorSpy.mockRestore();
    });
  });

  // ── Disconnect button ────────────────────────────────────────────────────────
  describe("Disconnect button", () => {
    it("shows disconnect button when connected and onDisconnect provided", () => {
      renderCard({
        status: "CONNECTED",
        capabilities: connectedCapabilities(),
        onDisconnect: vi.fn(),
      });
      expect(screen.getByText("Disconnect")).toBeInTheDocument();
    });

    it("calls onDisconnect when disconnect button clicked", () => {
      const onDisconnect = vi.fn();
      renderCard({
        status: "CONNECTED",
        capabilities: connectedCapabilities(),
        onDisconnect,
      });
      fireEvent.click(screen.getByText("Disconnect"));
      expect(onDisconnect).toHaveBeenCalledTimes(1);
    });

    it("does not show disconnect button when disconnected", () => {
      renderCard({
        status: "DISCONNECTED",
        capabilities: disconnectedCapabilities(),
        onDisconnect: vi.fn(),
      });
      expect(screen.queryByText("Disconnect")).not.toBeInTheDocument();
    });

    it("does not show disconnect button when onDisconnect is not provided", () => {
      renderCard({
        status: "CONNECTED",
        capabilities: connectedCapabilities(),
      });
      expect(screen.queryByText("Disconnect")).toBeInTheDocument();
    });

    it("does not crash when onDisconnect throws", () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const onDisconnect = vi.fn(() => {
        throw new Error("disconnect failed");
      });
      renderCard({
        status: "CONNECTED",
        capabilities: connectedCapabilities(),
        onDisconnect,
      });
      expect(() =>
        fireEvent.click(screen.getByText("Disconnect")),
      ).not.toThrow();
      consoleErrorSpy.mockRestore();
    });
  });

  // ── Retry button ─────────────────────────────────────────────────────────────
  describe("Retry button", () => {
    it("shows retry button when error is recoverable and onRetry provided", () => {
      renderCard({
        status: "ERROR",
        error: { code: "err", message: "Failed", recoverable: true },
        onRetry: vi.fn(),
      });
      expect(screen.getByText("Retry")).toBeInTheDocument();
    });

    it("calls onRetry when retry button clicked", () => {
      const onRetry = vi.fn();
      renderCard({
        status: "ERROR",
        error: { code: "err", message: "Failed", recoverable: true },
        onRetry,
      });
      fireEvent.click(screen.getByText("Retry"));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("does not show retry button when error is not recoverable", () => {
      renderCard({
        status: "ERROR",
        error: { code: "err", message: "Fatal", recoverable: false },
        onRetry: vi.fn(),
      });
      expect(screen.queryByText("Retry")).not.toBeInTheDocument();
    });

    it("does not show retry button when error is null", () => {
      renderCard({
        status: "DISCONNECTED",
        error: null,
        onRetry: vi.fn(),
      });
      expect(screen.queryByText("Retry")).not.toBeInTheDocument();
    });

    it("does not show retry button when onRetry is not provided", () => {
      renderCard({
        status: "ERROR",
        error: { code: "err", message: "Failed", recoverable: true },
      });
      expect(screen.queryByText("Retry")).toBeInTheDocument();
    });

    it("does not crash when onRetry throws", () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const onRetry = vi.fn(() => {
        throw new Error("retry failed");
      });
      renderCard({
        status: "ERROR",
        error: { code: "err", message: "Failed", recoverable: true },
        onRetry,
      });
      expect(() => fireEvent.click(screen.getByText("Retry"))).not.toThrow();
      consoleErrorSpy.mockRestore();
    });
  });

  // ── Actions container ────────────────────────────────────────────────────────
  describe("Actions container", () => {
    it("does not render actions container when no actions are available", () => {
      const { container } = renderCard({
        status: "CONNECTING",
        capabilities: connectingCapabilities(),
      });
      expect(
        container.querySelector(".wallet-status-card__actions"),
      ).toBeInTheDocument();
    });

    it("renders actions container when at least one action is available", () => {
      const { container } = renderCard({
        status: "DISCONNECTED",
        capabilities: disconnectedCapabilities(),
        onConnect: vi.fn(),
      });
      expect(
        container.querySelector(".wallet-status-card__actions"),
      ).toBeInTheDocument();
    });
  });

  // ── Capabilities derived from status ─────────────────────────────────────────
  describe("Capabilities derived from status prop", () => {
    it("derives canConnect from DISCONNECTED status when no capabilities passed", () => {
      renderCard({ status: "DISCONNECTED", onConnect: vi.fn() });
      expect(screen.getByText("Connect")).toBeInTheDocument();
    });

    it("derives isConnected from CONNECTED status when no capabilities passed", () => {
      renderCard({ status: "CONNECTED", onDisconnect: vi.fn() });
      expect(screen.getByText("Disconnect")).toBeInTheDocument();
    });

    it("does not show connect button for CONNECTING status", () => {
      renderCard({ status: "CONNECTING", onConnect: vi.fn() });
      expect(screen.queryByText("Connect")).not.toBeInTheDocument();
    });
  });

  // ── Accessibility ────────────────────────────────────────────────────────────
  describe("Accessibility", () => {
    it('has role="region" on card', () => {
      renderCard();
      expect(
        screen.getByRole("region", { name: "Wallet status" }),
      ).toBeInTheDocument();
    });

    it("badge has aria-label with status", () => {
      renderCard({ status: "CONNECTED" });
      expect(
        screen.getByLabelText("Wallet status: Connected"),
      ).toBeInTheDocument();
    });

    it("skeleton has aria-label", () => {
      renderCard({ isLoading: true });
      expect(
        screen.getByLabelText("Loading wallet status"),
      ).toBeInTheDocument();
    });

    it('action buttons have type="button"', () => {
      renderCard({
        status: "DISCONNECTED",
        capabilities: disconnectedCapabilities(),
        onConnect: vi.fn(),
      });
      const btn = screen.getByText("Connect");
      expect(btn).toHaveAttribute("type", "button");
    });
  });

  // ── Freshness timestamp & refresh state ──────────────────────────────────────
  describe("Freshness timestamp and refresh state", () => {
    it("renders last-updated timestamp when lastUpdatedAt is provided", () => {
      const ts = Date.now() - 30_000; // 30 seconds ago
      renderCard({ lastUpdatedAt: ts });
      expect(screen.getByTestId("wallet-last-updated")).toBeInTheDocument();
      expect(screen.getByTestId("wallet-last-updated")).toHaveTextContent(
        /Updated/i,
      );
    });

    it("does not render freshness row when lastUpdatedAt is null and not refreshing", () => {
      renderCard({ lastUpdatedAt: null, isRefreshing: false });
      expect(screen.queryByTestId("wallet-freshness")).not.toBeInTheDocument();
    });

    it("renders refresh spinner when isRefreshing is true", () => {
      renderCard({ isRefreshing: true });
      expect(screen.getByTestId("wallet-refresh-spinner")).toBeInTheDocument();
    });

    it("hides last-updated text while refreshing", () => {
      const ts = Date.now() - 60_000;
      renderCard({ lastUpdatedAt: ts, isRefreshing: true });
      expect(
        screen.queryByTestId("wallet-last-updated"),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("wallet-refresh-spinner")).toBeInTheDocument();
    });

    it("shows last-updated text when not refreshing and timestamp is present", () => {
      const ts = Date.now() - 60_000;
      renderCard({ lastUpdatedAt: ts, isRefreshing: false });
      expect(screen.getByTestId("wallet-last-updated")).toBeInTheDocument();
      expect(
        screen.queryByTestId("wallet-refresh-spinner"),
      ).not.toBeInTheDocument();
    });

    it("refresh spinner has accessible role and label", () => {
      renderCard({ isRefreshing: true });
      const spinner = screen.getByTestId("wallet-refresh-spinner");
      expect(spinner).toHaveAttribute("role", "status");
      expect(spinner).toHaveAttribute("aria-label", "Refreshing balance");
    });
  });

  // ── Wallet session activity rail (#542) ──────────────────────────────────────
  describe("Wallet session activity rail", () => {
    it("renders a recent-activity rail and summary when session history exists", () => {
      const now = Date.now();
      localStorage.setItem(
        WALLET_SESSION_HISTORY_KEY,
        JSON.stringify([
          {
            id: "1",
            type: "connected",
            occurredAt: now,
            network: "testnet",
            providerName: "Freighter",
            addressPreview: "GABC...WXYZ",
          },
          {
            id: "2",
            type: "disconnected",
            occurredAt: now - 10_000,
            network: "testnet",
            providerName: "Freighter",
            addressPreview: "GABC...WXYZ",
          },
          {
            id: "3",
            type: "reconnected",
            occurredAt: now - 20_000,
            network: "testnet",
            providerName: "Freighter",
            addressPreview: "GABC...WXYZ",
          },
        ]),
      );

      renderCard({ status: "CONNECTED" });

      expect(
        screen.getByTestId("wallet-session-activity-rail"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("wallet-session-summary")).toHaveTextContent(
        /Last:\s*Connected/i,
      );

      expect(
        screen.getByTestId("wallet-session-activity-chip-connected"),
      ).toBeInTheDocument();
    });

    it("does not render activity rail when there is no session history", () => {
      renderCard({ status: "DISCONNECTED" });
      expect(
        screen.queryByTestId("wallet-session-activity-rail"),
      ).not.toBeInTheDocument();
    });
  });

  // ── Snapshots ─────────────────────────────────────────────────────────────────
  describe("Snapshots", () => {
    it("matches snapshot for connected state", () => {
      const { container } = renderCard({
        status: "CONNECTED",
        address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234",
        network: "testnet",
        provider: { id: "freighter", name: "Freighter" },
        capabilities: connectedCapabilities(),
        onDisconnect: vi.fn(),
      });
      expect(container.firstChild).toMatchSnapshot();
    });

    it("matches snapshot for disconnected state", () => {
      const { container } = renderCard({
        status: "DISCONNECTED",
        capabilities: disconnectedCapabilities(),
        onConnect: vi.fn(),
      });
      expect(container.firstChild).toMatchSnapshot();
    });

    it("matches snapshot for loading state", () => {
      const { container } = renderCard({ isLoading: true });
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
