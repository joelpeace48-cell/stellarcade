import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusCard from "../../src/components/v1/StatusCard";

describe("StatusCard", () => {
  it("renders basic info and uses neutral tone by default", () => {
    render(
      <StatusCard
        id="game-123456789"
        name="Test Game"
        status="active"
        wager={10}
      />
    );

    expect(screen.getByText("Test Game")).toBeDefined();
    expect(screen.getByText("#game-123")).toBeDefined();
    expect(screen.getByText("ACTIVE")).toBeDefined();
    expect(screen.getByText("10 XLM")).toBeDefined();
    
    const card = screen.getByTestId("status-card");
    expect(card.className).toContain("tone-neutral");
  });

  it("applies semantic tone classes", () => {
    const { rerender } = render(
      <StatusCard
        id="g1"
        name="N"
        status="S"
        tone="success"
      />
    );
    expect(screen.getByTestId("status-card").className).toContain("tone-success");

    rerender(
      <StatusCard
        id="g1"
        name="N"
        status="S"
        tone="error"
      />
    );
    expect(screen.getByTestId("status-card").className).toContain("tone-error");
  });

  it("renders content in before and after slots", () => {
    render(
      <StatusCard
        id="g1"
        name="N"
        status="S"
        beforeSlot={<span data-testid="before">PRE</span>}
        afterSlot={<span data-testid="after">POST</span>}
      />
    );

    expect(screen.getByTestId("before")).toBeDefined();
    expect(screen.getByTestId("after")).toBeDefined();
  });

  it("renders stale badge and applies stale classes when isStale is true", () => {
    render(
      <StatusCard
        id="g1"
        name="N"
        status="S"
        isStale={true}
      />
    );

    expect(screen.getByTestId("status-card-stale-badge")).toBeInTheDocument();
    expect(screen.getByText("Stale")).toBeInTheDocument();
    
    const card = screen.getByTestId("status-card");
    expect(card.className).toContain("is-stale");
    expect(card.className).toContain("opacity-75");
  });
});
