/**
 * @vitest-environment happy-dom
 */

import App from "@/App";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("App", () => {
  it("lazy-loads the dev contract simulator panel in development", async () => {
    if (!import.meta.env.DEV) return;
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId("contract-call-simulator-panel")).toBeInTheDocument();
    });
  });
});
