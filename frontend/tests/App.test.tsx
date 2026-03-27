/**
 * @vitest-environment happy-dom
 */

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("App", () => {
  it("lazy-loads the dev contract simulator panel in development", async () => {
    const { default: App } = await import("@/App");
    if (!import.meta.env.DEV) return;
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId("contract-call-simulator-panel")).toBeInTheDocument();
    });
  });

  it("renders the GameLobby route when no route error occurs", async () => {
    vi.doMock("@/pages/GameLobby", () => ({
      __esModule: true,
      default: () => <div>Mock Lobby Content</div>,
    }));

    const { default: App } = await import("@/App");
    render(<App />);

    expect(screen.getByText("Mock Lobby Content")).toBeInTheDocument();
    expect(screen.queryByText("Lobby temporarily unavailable")).toBeNull();
  });

  it("renders a route-level fallback when GameLobby throws during render", async () => {
    const reloadSpy = vi
      .spyOn(window.location, "reload")
      .mockImplementation(() => undefined);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.doMock("@/pages/GameLobby", () => ({
      __esModule: true,
      default: () => {
        throw new Error("render failed");
      },
    }));

    const { default: App } = await import("@/App");
    render(<App />);

    expect(screen.getByText("Lobby temporarily unavailable")).toBeInTheDocument();
    expect(
      screen.getByText("Reload the route to try fetching the latest game state again."),
    ).toBeInTheDocument();

    screen.getByRole("button", { name: "Reload" }).click();
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockRestore();
  });
});
