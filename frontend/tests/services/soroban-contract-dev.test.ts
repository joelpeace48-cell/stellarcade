import {
  devClearContractSimResults,
  devListContractSimKeys,
  devParseMockResultPayload,
  devPeekContractSimResult,
  devRegisterContractSimResult,
} from "@/services/soroban-contract-dev";
import { SorobanErrorCode } from "@/types/errors";
import { afterEach, describe, expect, it } from "vitest";

describe("soroban-contract-dev", () => {
  afterEach(() => {
    devClearContractSimResults();
  });

  it("registers and peeks mock results in development", () => {
    if (import.meta.env.PROD) return;
    devRegisterContractSimResult("CID", "foo", { success: true, data: { x: 1 } });
    expect(devPeekContractSimResult("CID", "foo")).toEqual({
      success: true,
      data: { x: 1 },
    });
    expect(devListContractSimKeys()).toContain("CID|foo");
  });

  it("parse success mode accepts JSON object", () => {
    if (import.meta.env.PROD) return;
    const r = devParseMockResultPayload("success", '{"a":1}', SorobanErrorCode.RpcError);
    expect(r).toEqual({ success: true, data: { a: 1 } });
  });

  it("parse success mode returns error for invalid JSON", () => {
    if (import.meta.env.PROD) return;
    const r = devParseMockResultPayload("success", "not-json", SorobanErrorCode.RpcError);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.code).toBe(SorobanErrorCode.InvalidParameter);
    }
  });

  it("parse failure mode builds SorobanClientError", () => {
    if (import.meta.env.PROD) return;
    const r = devParseMockResultPayload(
      "failure",
      "boom",
      SorobanErrorCode.SimulationFailed,
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.message).toBe("boom");
      expect(r.error.code).toBe(SorobanErrorCode.SimulationFailed);
    }
  });
});
