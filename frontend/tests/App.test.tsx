/**
 * @vitest-environment happy-dom --
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock("@/pages/GameLobby");
  vi.restoreAllMocks();
});

describe("App", () => {
  it("provides a skip link that moves focus to the dashboard main region", async () => {
    vi.doMock("@/pages/GameLobby", () => ({
      __esModule: true,
      default: () => <h1 id="games-heading">Mock Lobby Content</h1>,
    }));

    const { default: App } = await import("@/App");
    render(<App />);

    const skipLink = screen.getByRole("link", { name: /skip to main content/i });
    const main = screen.getByRole("main");

    expect(skipLink).toHaveAttribute("href", "#main-content");
    expect(skipLink).toHaveClass("skip-link");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabindex", "-1");

    fireEvent.click(skipLink);

    expect(main).toHaveFocus();
  });

  it("exposes one stable main landmark and named dashboard navigation landmarks", async () => {
    vi.doMock("@/pages/GameLobby", () => ({
      __esModule: true,
      default: () => <h1 id="games-heading">Mock Lobby Content</h1>,
    }));

    const { default: App } = await import("@/App");
    render(<App />);

    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /primary dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /breadcrumb/i })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /sidebar navigation/i })).not.toBeInTheDocument();
  });

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
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.doMock("@/pages/GameLobby", () => ({
      __esModule: true,
      default: () => {
        throw new Error("render failed");
      },
    }));

    const { default: App } = await import("@/App");
    render(<App />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("render failed")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
describe("Breadcrumb Navigation", () => {
  it("renders the breadcrumb container with a link to home", async () => {
    const { default: App } = await import("@/App");
    render(<App />);

    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(nav).toBeInTheDocument();
    expect(screen.getByTitle("Home")).toBeInTheDocument();
  });

  it("dynamically generates segments based on the URL path", async () => {
    // Manually push a nested state to the history
    window.history.pushState({}, "Test Page", "/games/stellarcade-classic");

    const { default: App } = await import("@/App");
    render(<App />);

    // Check for intermediate segments
    expect(screen.getByText("games")).toBeInTheDocument();

    // Check for the active leaf node
    const currentPage = screen.getByText("stellarcade classic");
    expect(currentPage).toBeInTheDocument();
    expect(currentPage).toHaveAttribute("aria-current", "page");
  });

  it("omits breadcrumbs when on the root route", async () => {
    window.history.pushState({}, "Home", "/");

    const { default: App } = await import("@/App");
    render(<App />);

    // Since 'pathnames' will be empty at '/', only the Home link remains.
    // If your logic hides the whole nav when pathnames.length === 0,
    // you would test for queryByRole(...) to be null.
    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    const breadcrumbLinks = nav.querySelectorAll("li");
    expect(breadcrumbLinks).toHaveLength(1);
    expect(screen.getByTitle("Home")).toBeInTheDocument();
  });
});

describe("Drawer Framework (#475)", () => {
  it("renders an open drawer with title and body content", async () => {
    const { Drawer } = await import("@/App");
    const onClose = vi.fn();
    render(
      <Drawer open={true} onClose={onClose} title="Test Drawer">
        <p>Drawer content here</p>
      </Drawer>,
    );

    const drawer = screen.getByTestId("drawer");
    expect(drawer).toBeInTheDocument();
    expect(screen.getByText("Test Drawer")).toBeInTheDocument();
    expect(screen.getByText("Drawer content here")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const { Drawer } = await import("@/App");
    const onClose = vi.fn();
    render(<Drawer open={true} onClose={onClose} title="Close Me" />);

    const closeBtn = screen.getByTestId("drawer-close");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop is clicked", async () => {
    const { Drawer } = await import("@/App");
    const onClose = vi.fn();
    render(<Drawer open={true} onClose={onClose} title="Backdrop" />);

    const backdrop = screen.getByTestId("drawer-backdrop");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", async () => {
    const { Drawer } = await import("@/App");
    const onClose = vi.fn();
    render(<Drawer open={true} onClose={onClose} title="Escape Test" />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose on Escape when drawer is closed", async () => {
    const { Drawer } = await import("@/App");
    const onClose = vi.fn();
    render(<Drawer open={false} onClose={onClose} title="Closed" />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("sets inert on the drawer element when closed for background content protection", async () => {
    const { Drawer } = await import("@/App");
    const onClose = vi.fn();
    render(<Drawer open={false} onClose={onClose} title="Inert Test" />);

    const drawer = screen.getByTestId("drawer");
    expect(drawer).toHaveAttribute("inert");
  });

  it("has role dialog and aria-modal when open", async () => {
    const { Drawer } = await import("@/App");
    const onClose = vi.fn();
    render(<Drawer open={true} onClose={onClose} title="A11y check" />);

    const drawer = screen.getByRole("dialog");
    expect(drawer).toHaveAttribute("aria-modal", "true");
    expect(drawer).toHaveAttribute("aria-label", "A11y check");
  });

  it("moves focus to close button when drawer opens (focus handoff)", async () => {
    const { Drawer } = await import("@/App");
    const onClose = vi.fn();
    const { rerender } = render(
      <Drawer open={false} onClose={onClose} title="Focus" />,
    );

    rerender(<Drawer open={true} onClose={onClose} title="Focus" />);

    // requestAnimationFrame fires asynchronously
    await waitFor(() => {
      const closeBtn = screen.getByTestId("drawer-close");
      expect(document.activeElement).toBe(closeBtn);
    });
  });

  it("supports left-side drawer variant", async () => {
    const { Drawer } = await import("@/App");
    const onClose = vi.fn();
    render(<Drawer open={true} onClose={onClose} side="left" title="Left" />);

    const drawer = screen.getByTestId("drawer");
    expect(drawer.className).toContain("drawer--left");
  });

  it("traps focus within the drawer while it is open", async () => {
    const { Drawer } = await import("@/App");
    const onClose = vi.fn();
    render(
      <Drawer open={true} onClose={onClose} title="Trap">
        <button type="button">Secondary action</button>
      </Drawer>,
    );

    const closeBtn = screen.getByTestId("drawer-close");
    const secondaryAction = screen.getByRole("button", { name: "Secondary action" });

    closeBtn.focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(secondaryAction).toHaveFocus();

    fireEvent.keyDown(window, { key: "Tab" });
    expect(closeBtn).toHaveFocus();
  });
});
