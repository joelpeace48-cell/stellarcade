/**
 * @vitest-environment happy-dom
 */

import { ContractCallSimulatorPanel } from "@/components/dev/ContractCallSimulatorPanel";
import { devClearContractSimResults, devPeekContractSimResult } from "@/services/soroban-contract-dev";
import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

describe("ContractCallSimulatorPanel", () => {
  afterEach(() => {
    devClearContractSimResults();
  });

  it("expands and registers a success mock from the form", () => {
    if (import.meta.env.PROD) return;
    render(<ContractCallSimulatorPanel />);

    fireEvent.click(screen.getByTestId("contract-call-simulator-toggle"));

    fireEvent.change(screen.getByTestId("contract-call-simulator-contract"), {
      target: { value: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4" },
    });
    fireEvent.change(screen.getByTestId("contract-call-simulator-method"), {
      target: { value: "get_pool_state" },
    });
    fireEvent.change(screen.getByTestId("contract-call-simulator-payload"), {
      target: { value: '{"available": "10", "reserved": "2"}' },
    });

    fireEvent.click(screen.getByTestId("contract-call-simulator-register"));

    const hit = devPeekContractSimResult("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4", "get_pool_state");
    expect(hit?.success).toBe(true);
    if (hit?.success) {
      expect(hit.data).toEqual({ available: "10", reserved: "2" });
    }

    expect(screen.getByTestId("contract-call-simulator-keys")).toBeInTheDocument();
  });

  it("clear removes registered mocks", () => {
    if (import.meta.env.PROD) return;
    render(<ContractCallSimulatorPanel />);
    fireEvent.click(screen.getByTestId("contract-call-simulator-toggle"));

    fireEvent.change(screen.getByTestId("contract-call-simulator-contract"), {
      target: { value: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4" },
    });
    fireEvent.change(screen.getByTestId("contract-call-simulator-method"), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByTestId("contract-call-simulator-register"));

    fireEvent.click(screen.getByTestId("contract-call-simulator-clear"));

    expect(
      devPeekContractSimResult("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4", "x"),
    ).toBeNull();
  });
});
